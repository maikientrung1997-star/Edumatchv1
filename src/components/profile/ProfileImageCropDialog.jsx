import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Move, Plus } from 'lucide-react';
import { Modal } from '@/components/feedback/Modal';
import './profileImageCropDialog.css';

const OUTPUT_SIZES = {
  avatar: { width: 720, height: 720 },
  cover: { width: 1200, height: 375 },
};

const loadImage = (source) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Không thể tải ảnh để cắt.'));
  image.src = source;
});

const toFile = async (dataUrl, name) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
};

export function ProfileImageCropDialog({ draft, onClose, onSave }) {
  const variant = draft?.variant === 'cover' ? 'cover' : 'avatar';
  const output = OUTPUT_SIZES[variant];
  const cropAreaRef = useRef(null);
  const dragRef = useRef(null);
  const imageRef = useRef(null);
  const [imageSize, setImageSize] = useState(null);
  const [areaSize, setAreaSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const isOpen = Boolean(draft?.source);

  useEffect(() => {
    if (!isOpen || !draft?.source) {
      setImageSize(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      return undefined;
    }
    let active = true;
    setImageSize(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    loadImage(draft.source)
      .then((image) => {
        if (active) setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
      })
      .catch(() => {
        if (active) setImageSize(null);
      });
    return () => { active = false; };
  }, [draft?.source, isOpen]);

  useEffect(() => {
    const target = cropAreaRef.current;
    if (!isOpen || !target) return undefined;
    const syncSize = () => setAreaSize({ width: target.clientWidth, height: target.clientHeight });
    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(target);
    return () => observer.disconnect();
  }, [isOpen, variant]);

  const cropMetrics = useMemo(() => {
    if (!imageSize) return null;
    const baseScale = Math.max(output.width / imageSize.width, output.height / imageSize.height);
    const renderedWidth = imageSize.width * baseScale * zoom;
    const renderedHeight = imageSize.height * baseScale * zoom;
    return {
      baseScale,
      renderedWidth,
      renderedHeight,
      maxX: Math.max(0, (renderedWidth - output.width) / 2),
      maxY: Math.max(0, (renderedHeight - output.height) / 2),
    };
  }, [imageSize, output.height, output.width, zoom]);

  const clampOffset = (nextOffset, metrics = cropMetrics) => {
    if (!metrics) return { x: 0, y: 0 };
    return {
      x: Math.min(metrics.maxX, Math.max(-metrics.maxX, nextOffset.x)),
      y: Math.min(metrics.maxY, Math.max(-metrics.maxY, nextOffset.y)),
    };
  };

  const setZoomLevel = (nextZoom) => {
    const safeZoom = Math.min(2.5, Math.max(1, nextZoom));
    if (!imageSize) {
      setZoom(safeZoom);
      return;
    }
    const baseScale = Math.max(output.width / imageSize.width, output.height / imageSize.height);
    const nextMetrics = {
      maxX: Math.max(0, (imageSize.width * baseScale * safeZoom - output.width) / 2),
      maxY: Math.max(0, (imageSize.height * baseScale * safeZoom - output.height) / 2),
    };
    setZoom(safeZoom);
    setOffset((current) => clampOffset(current, nextMetrics));
  };

  const beginDrag = (event) => {
    if (!cropMetrics) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset,
    };
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !areaSize.width) return;
    const outputPerPixel = output.width / areaSize.width;
    setOffset(clampOffset({
      x: drag.offset.x + (event.clientX - drag.startX) * outputPerPixel,
      y: drag.offset.y + (event.clientY - drag.startY) * outputPerPixel,
    }));
  };

  const stopDrag = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const moveWithKeyboard = (event) => {
    const step = event.shiftKey ? 30 : 10;
    const moves = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setOffset((current) => clampOffset({ x: current.x + move.x, y: current.y + move.y }));
  };

  const save = async () => {
    if (!imageSize || !cropMetrics || saving || !draft?.source) return;
    setSaving(true);
    try {
      const image = imageRef.current || await loadImage(draft.source);
      const canvas = document.createElement('canvas');
      canvas.width = output.width;
      canvas.height = output.height;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, output.width, output.height);
      context.drawImage(
        image,
        (output.width - cropMetrics.renderedWidth) / 2 + offset.x,
        (output.height - cropMetrics.renderedHeight) / 2 + offset.y,
        cropMetrics.renderedWidth,
        cropMetrics.renderedHeight,
      );
      // A restrained output size prevents local profile persistence from
      // exhausting browser storage and keeps the cover quick to repaint.
      const imageDataUrl = canvas.toDataURL('image/jpeg', variant === 'cover' ? 0.74 : 0.82);
      const baseName = String(draft?.file?.name || `edumatch-${variant}`).replace(/\.[^.]+$/, '');
      await onSave?.({
        image: imageDataUrl,
        file: await toFile(imageDataUrl, `${baseName}-${variant}.jpg`),
      });
    } finally {
      setSaving(false);
    }
  };

  const imageStyle = useMemo(() => {
    if (!cropMetrics || !areaSize.width) return undefined;
    const scaleForPreview = areaSize.width / output.width;
    return {
      width: `${cropMetrics.renderedWidth * scaleForPreview}px`,
      height: `${cropMetrics.renderedHeight * scaleForPreview}px`,
      transform: `translate(calc(-50% + ${offset.x * scaleForPreview}px), calc(-50% + ${offset.y * scaleForPreview}px))`,
    };
  }, [areaSize.width, cropMetrics, offset.x, offset.y, output.width]);

  const title = variant === 'avatar' ? 'Chọn vùng ảnh đại diện' : 'Chọn vùng ảnh bìa';

  if (!isOpen || !draft?.source) {
    return null;
  }

  return (
    <Modal
      open={isOpen}
      onClose={saving ? undefined : onClose}
      title={title}
      description="Kéo ảnh để chọn vùng hiển thị, hoặc dùng phím mũi tên để điều chỉnh."
      size="xl"
      className="profile-image-crop-dialog"
      footer={(
        <>
          <button type="button" className="profile-image-crop-dialog__cancel" onClick={onClose} disabled={saving}>Hủy</button>
          <button type="button" className="profile-image-crop-dialog__save" onClick={save} disabled={!imageSize || saving}>{saving ? 'Đang lưu...' : 'Lưu ảnh'}</button>
        </>
      )}
    >
      <div className="profile-image-crop-dialog__body">
        <div
          ref={cropAreaRef}
          className={`profile-image-crop-area profile-image-crop-area--${variant}`}
          role="application"
          aria-label="Vùng cắt ảnh. Kéo ảnh hoặc dùng phím mũi tên để điều chỉnh vị trí."
          tabIndex={0}
          onKeyDown={moveWithKeyboard}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          {imageSize && draft?.source ? <img ref={imageRef} src={draft.source} alt="Xem trước vùng ảnh" draggable={false} style={imageStyle} /> : <span>Đang chuẩn bị ảnh...</span>}
        </div>
        <div className="profile-image-crop-dialog__controls">
          <span className="profile-image-crop-dialog__hint"><Move size={16} /> Kéo ảnh để đặt lại vị trí hiển thị</span>
          <div className="profile-image-crop-dialog__zoom">
            <button type="button" onClick={() => setZoomLevel(zoom - 0.1)} disabled={zoom <= 1 || saving} aria-label="Thu nhỏ ảnh"><Minus size={16} /></button>
            <input type="range" min="1" max="2.5" step="0.01" value={zoom} onChange={(event) => setZoomLevel(Number(event.target.value))} aria-label="Phóng to hoặc thu nhỏ ảnh" disabled={!imageSize || saving} />
            <button type="button" onClick={() => setZoomLevel(zoom + 0.1)} disabled={zoom >= 2.5 || saving} aria-label="Phóng to ảnh"><Plus size={16} /></button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
