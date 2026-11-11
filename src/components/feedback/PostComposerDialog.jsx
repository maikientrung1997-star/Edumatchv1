import { ArrowDown, ArrowUp, GripVertical, Send, Trash2, Video, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Modal } from '@/components/feedback/Modal';
import { ImageAttachment } from '@/components/forms/ImageAttachment';
import { RoleAvatar } from '@/components/common/DefaultRoleAvatar';
import './post-composer-dialog.css';

function useMediaReorder(media, onMediaChange, itemSelector) {
  const [draggedMediaIndex, setDraggedMediaIndex] = useState(null);
  const draggedMediaKey = useRef('');
  const pointerDragRef = useRef(null);
  const fallbackKeysRef = useRef(new WeakMap());
  const nextKeyIdRef = useRef(1);
  const mediaRef = useRef(media);
  useLayoutEffect(() => { mediaRef.current = media; }, [media]);

  const getMediaKey = (item, index) => {
    if (!item || typeof item !== 'object') return `media-${index}`;
    if (item.id) return String(item.id);
    if (item.storageKey) return String(item.storageKey);
    let assigned = fallbackKeysRef.current.get(item);
    if (!assigned) {
      assigned = `media-obj-${nextKeyIdRef.current++}-${item.name || ''}`;
      fallbackKeysRef.current.set(item, assigned);
    }
    return assigned;
  };

  const moveMedia = (fromIndex, toIndex) => {
    const currentMedia = mediaRef.current;
    if (
      fromIndex === toIndex
      || fromIndex < 0
      || toIndex < 0
      || fromIndex >= currentMedia.length
      || toIndex >= currentMedia.length
    ) {
      return;
    }
    const reorderedMedia = [...currentMedia];
    const [movedItem] = reorderedMedia.splice(fromIndex, 1);
    reorderedMedia.splice(toIndex, 0, movedItem);
    onMediaChange(reorderedMedia);
  };

  const reorderToPoint = (clientX, clientY) => {
    if (!draggedMediaKey.current) return;
    const targetElement = document.elementFromPoint(clientX, clientY)?.closest(itemSelector);
    if (!targetElement) return;
    const targetIndex = Number(targetElement.getAttribute('data-media-index'));
    if (!Number.isInteger(targetIndex)) return;
    const currentMedia = mediaRef.current;
    const fromIndex = currentMedia.findIndex(
      (candidate, candidateIndex) => getMediaKey(candidate, candidateIndex) === draggedMediaKey.current
    );
    if (fromIndex < 0 || fromIndex === targetIndex) return;
    moveMedia(fromIndex, targetIndex);
    setDraggedMediaIndex(targetIndex);
  };

  const startMediaDrag = (event, item, index) => {
    if (mediaRef.current.length <= 1) return;
    if (pointerDragRef.current) {
      event.preventDefault();
      return;
    }
    const key = getMediaKey(item, index);
    draggedMediaKey.current = key;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', key);
    }
    setDraggedMediaIndex(index);
  };

  const reorderDuringDrag = (event, item, index) => {
    event.preventDefault();
    if (!draggedMediaKey.current) return;
    const currentMedia = mediaRef.current;
    const fromIndex = currentMedia.findIndex(
      (candidate, candidateIndex) => getMediaKey(candidate, candidateIndex) === draggedMediaKey.current
    );
    if (fromIndex < 0 || fromIndex === index) return;
    moveMedia(fromIndex, index);
    setDraggedMediaIndex(index);
  };

  const endMediaDrag = () => {
    draggedMediaKey.current = '';
    pointerDragRef.current = null;
    setDraggedMediaIndex(null);
  };

  const startPointerDrag = (event, item, index) => {
    if (mediaRef.current.length <= 1) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const key = getMediaKey(item, index);
    draggedMediaKey.current = key;
    pointerDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: event.pointerType !== 'mouse',
    };
    setDraggedMediaIndex(index);
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported on synthetic events.
    }
  };

  const movePointerDrag = (event) => {
    const state = pointerDragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (!state.active) {
      if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 4) return;
      state.active = true;
    }
    if (event.cancelable) event.preventDefault();
    reorderToPoint(event.clientX, event.clientY);
  };

  const endPointerDrag = (event) => {
    const state = pointerDragRef.current;
    if (!state || (event.pointerId != null && state.pointerId !== event.pointerId)) return;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // Ignore release errors.
    }
    endMediaDrag();
  };

  const startTouchDrag = (event, item, index) => {
    if (mediaRef.current.length <= 1 || pointerDragRef.current) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    const key = getMediaKey(item, index);
    draggedMediaKey.current = key;
    setDraggedMediaIndex(index);
  };

  const moveTouchDrag = (event) => {
    if (!draggedMediaKey.current || pointerDragRef.current) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    if (event.cancelable) event.preventDefault();
    reorderToPoint(touch.clientX, touch.clientY);
  };

  return {
    draggedMediaIndex,
    getMediaKey,
    moveMedia,
    startMediaDrag,
    reorderDuringDrag,
    endMediaDrag,
    startPointerDrag,
    movePointerDrag,
    endPointerDrag,
    startTouchDrag,
    moveTouchDrag,
  };
}

export function PostComposerDialog({
  open,
  onClose,
  draft,
  onDraftChange,
  media,
  onMediaChange,
  onPublish,
  placeholder,
  attachmentId,
  albums = [],
  selectedAlbumId = '',
  onSelectedAlbumChange,
  onCreateAlbum,
}) {
  const [isAlbumPickerOpen, setIsAlbumPickerOpen] = useState(false);
  const [isAlbumCreationOpen, setIsAlbumCreationOpen] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');
  const albumSectionRef = useRef(null);

  useEffect(() => {
    if (!isAlbumPickerOpen) return;
    const closeAlbumPickerOutside = (event) => {
      if (!albumSectionRef.current?.contains(event.target)) {
        setIsAlbumPickerOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeAlbumPickerOutside, true);
    return () => document.removeEventListener('pointerdown', closeAlbumPickerOutside, true);
  }, [isAlbumPickerOpen]);
  const {
    draggedMediaIndex,
    getMediaKey,
    startMediaDrag,
    reorderDuringDrag,
    endMediaDrag,
    startPointerDrag,
    movePointerDrag,
    endPointerDrag,
    startTouchDrag,
    moveTouchDrag,
  } = useMediaReorder(media, onMediaChange, '[data-composer-media-item]');

  const updateMediaDescription = (index, description) => {
    onMediaChange(media.map((item, itemIndex) => itemIndex === index ? { ...item, description } : item));
  };
  const createAlbum = async () => {
    const name = newAlbumName.trim();
    if (!name || !onCreateAlbum) return;
    const album = await onCreateAlbum({ name, description: newAlbumDescription.trim() });
    if (!album?.id) return;
    onSelectedAlbumChange?.(album.id);
    setNewAlbumName('');
    setNewAlbumDescription('');
    setIsAlbumCreationOpen(false);
    setIsAlbumPickerOpen(false);
  };
  const isMultiMedia = media.length > 1;

  return (
    <Modal open={open} onClose={onClose} title="Tạo bài viết" size="xl" className="post-composer-dialog">
      <form className="post-composer-dialog__form" onSubmit={onPublish}>
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={placeholder}
          rows="5"
          autoFocus
          aria-label="Nội dung bài viết"
        />
        {media.length > 0 && <section className={`post-composer-dialog__media-descriptions ${!isMultiMedia ? 'is-single' : ''}`.trim()} aria-label={isMultiMedia ? 'Chú thích từng ảnh và video' : 'Tệp đính kèm'}>
          <div className="post-composer-dialog__media-description-list">
            {media.map((item, index) => <div
              className={`${draggedMediaIndex === index ? 'is-dragging' : ''} ${!isMultiMedia ? 'is-single' : ''}`.trim()}
              key={getMediaKey(item, index)}
              data-composer-media-item
              data-media-index={index}
              onDragOver={isMultiMedia ? (event) => reorderDuringDrag(event, item, index) : undefined}
              onDrop={isMultiMedia ? endMediaDrag : undefined}
            >
              <span
                className={`post-composer-dialog__media-thumbnail ${isMultiMedia ? 'is-draggable' : ''}`.trim()}
                draggable={isMultiMedia}
                onDragStart={isMultiMedia ? (event) => startMediaDrag(event, item, index) : undefined}
                onDragEnd={isMultiMedia ? endMediaDrag : undefined}
                onPointerDown={isMultiMedia ? (event) => startPointerDrag(event, item, index) : undefined}
                onPointerMove={isMultiMedia ? movePointerDrag : undefined}
                onPointerUp={isMultiMedia ? endPointerDrag : undefined}
                onPointerCancel={isMultiMedia ? endPointerDrag : undefined}
                onTouchStart={isMultiMedia ? (event) => startTouchDrag(event, item, index) : undefined}
                onTouchMove={isMultiMedia ? moveTouchDrag : undefined}
                onTouchEnd={isMultiMedia ? endMediaDrag : undefined}
                title={isMultiMedia ? 'Kéo để đổi thứ tự' : undefined}
              >
                {item.type === 'video' ? <video src={item.src} muted playsInline /> : <img src={item.src} alt="" draggable={false} />}
              </span>
              {isMultiMedia && <span
                className="post-composer-dialog__drag-handle"
                draggable
                onDragStart={(event) => startMediaDrag(event, item, index)}
                onDragEnd={endMediaDrag}
                onPointerDown={(event) => startPointerDrag(event, item, index)}
                onPointerMove={movePointerDrag}
                onPointerUp={endPointerDrag}
                onPointerCancel={endPointerDrag}
                onTouchStart={(event) => startTouchDrag(event, item, index)}
                onTouchMove={moveTouchDrag}
                onTouchEnd={endMediaDrag}
                title="Kéo để đổi thứ tự"
              >
                <GripVertical size={17} />
              </span>}
              {isMultiMedia && <textarea value={item.description || ''} onChange={(event) => updateMediaDescription(index, event.target.value)} aria-label={`Chú thích ${item.type === "video" ? "video" : "ảnh"} ${index + 1}`} rows="2" />}
              <button className="post-composer-dialog__remove-media" type="button" onClick={() => onMediaChange(media.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Xóa tệp ${index + 1}`}><X size={16} /></button>
            </div>)}
          </div>
        </section>}
        {media.length > 0 && <section ref={albumSectionRef} className="post-composer-dialog__album">
          <button className="post-composer-dialog__album-trigger" type="button" onClick={() => setIsAlbumPickerOpen((open) => !open)} aria-expanded={isAlbumPickerOpen} aria-controls="post-composer-album-picker">Thêm vào album</button>
          {selectedAlbumId && <span className="post-composer-dialog__album-selected">{albums.find((album) => album.id === selectedAlbumId)?.name}</span>}
          {isAlbumPickerOpen && <section id="post-composer-album-picker" className="post-composer-dialog__album-picker" aria-label="Chọn album">
            <div className="post-composer-dialog__album-picker-header"><strong>Chọn album</strong><button type="button" onClick={() => setIsAlbumPickerOpen(false)} aria-label="Đóng danh sách album"><X size={16} /></button></div>
            {albums.length > 0 ? <div className="post-composer-dialog__album-list">{albums.map((album) => <button type="button" key={album.id} className={album.id === selectedAlbumId ? 'is-selected' : ''} onClick={() => { onSelectedAlbumChange?.(album.id); setIsAlbumPickerOpen(false); }}><span>{album.name}</span><small>{album.media.length} mục</small></button>)}</div> : <p className="post-composer-dialog__album-empty">Chưa có album nào.</p>}
            {!isAlbumCreationOpen ? <button type="button" className="post-composer-dialog__album-new-trigger" onClick={() => setIsAlbumCreationOpen(true)}>Tạo album mới</button> : <div className="post-composer-dialog__album-create">
              <input value={newAlbumName} onChange={(event) => setNewAlbumName(event.target.value.slice(0, 80))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void createAlbum(); } }} placeholder="Tên album" maxLength="80" autoFocus />
              <textarea value={newAlbumDescription} onChange={(event) => setNewAlbumDescription(event.target.value.slice(0, 500))} placeholder="Mô tả album" rows="2" maxLength="500" />
              <div><button type="button" onClick={() => { setIsAlbumCreationOpen(false); setNewAlbumName(''); setNewAlbumDescription(''); }}>Hủy</button><button type="button" onClick={createAlbum} disabled={!newAlbumName.trim()}>Tạo album</button></div>
            </div>}
          </section>}
        </section>}
        <div className="post-composer-dialog__actions">
          <ImageAttachment id={attachmentId} value={media} onChange={onMediaChange} multiple hidePreviews />
          <button type="submit" className="post-composer-dialog__publish" disabled={!draft.trim() && !media.length}>
            <Send size={17} /> Đăng bài
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PostComposerTrigger({ avatar, role, userId, name, placeholder, onOpen, media, onMediaChange }) {

  return (
    <section className="post-composer-trigger" aria-label="Tạo bài viết">
      <div className="post-composer-trigger__top">
        <div className="post-composer-trigger__avatar" aria-hidden="true">
          <RoleAvatar src={avatar} userId={userId} name={name} role={role} size={19} alt="" />
        </div>
        <button type="button" className="post-composer-trigger__prompt" onClick={onOpen}>
          {placeholder}
        </button>
        <ImageAttachment
          value={media}
          onChange={(items) => {
            onMediaChange(items);
            onOpen();
          }}
          multiple
          hidePreviews
        />
      </div>
    </section>
  );
}

export function InlinePostEditor({ draft, onDraftChange, media, onMediaChange, onCancel, onSave, attachmentId }) {
  const {
    draggedMediaIndex,
    getMediaKey,
    moveMedia,
    startMediaDrag,
    reorderDuringDrag,
    endMediaDrag,
    startPointerDrag,
    movePointerDrag,
    endPointerDrag,
    startTouchDrag,
    moveTouchDrag,
  } = useMediaReorder(media, onMediaChange, '[data-inline-media-item]');

  const moveMediaStep = (index, direction) => {
    moveMedia(index, index + direction);
  };
  const removeMedia = (index) => onMediaChange(media.filter((_, itemIndex) => itemIndex !== index));
  const updateMediaDescription = (index, description) => onMediaChange(media.map((item, itemIndex) => itemIndex === index ? { ...item, description } : item));
  const isMultiMedia = media.length > 1;

  return <form className="inline-post-editor" onSubmit={onSave}>
    <textarea autoFocus value={draft} onChange={(event) => onDraftChange(event.target.value)} rows="3" aria-label="Nội dung bài viết" />
    {media.length > 0 && <section className={`inline-post-editor__media ${!isMultiMedia ? 'is-single' : ''}`.trim()} aria-label="Chỉnh sửa ảnh và video của bài viết">
      <div className="inline-post-editor__media-list">{media.map((item, index) => <article
        key={getMediaKey(item, index)}
        data-inline-media-item
        data-media-index={index}
        className={`${draggedMediaIndex === index ? 'is-dragging' : ''} ${!isMultiMedia ? 'is-single' : ''}`.trim()}
        onDragOver={isMultiMedia ? (event) => reorderDuringDrag(event, item, index) : undefined}
        onDrop={isMultiMedia ? endMediaDrag : undefined}
      >
        <div
          className={`inline-post-editor__media-preview ${isMultiMedia ? 'is-draggable' : ''}`.trim()}
          draggable={isMultiMedia}
          onDragStart={isMultiMedia ? (event) => startMediaDrag(event, item, index) : undefined}
          onDragEnd={isMultiMedia ? endMediaDrag : undefined}
          onPointerDown={isMultiMedia ? (event) => startPointerDrag(event, item, index) : undefined}
          onPointerMove={isMultiMedia ? movePointerDrag : undefined}
          onPointerUp={isMultiMedia ? endPointerDrag : undefined}
          onPointerCancel={isMultiMedia ? endPointerDrag : undefined}
          onTouchStart={isMultiMedia ? (event) => startTouchDrag(event, item, index) : undefined}
          onTouchMove={isMultiMedia ? moveTouchDrag : undefined}
          onTouchEnd={isMultiMedia ? endMediaDrag : undefined}
          title={isMultiMedia ? 'Kéo để đổi thứ tự' : undefined}
        >
          {item.type === 'video' ? <><video src={item.src} muted playsInline /><span><Video size={14} /></span></> : <img src={item.src} alt="" draggable={false} />}
        </div>
        <div className="inline-post-editor__media-controls">
          <div>
            {isMultiMedia && <>
              <span
                className="inline-post-editor__drag-handle"
                draggable
                onDragStart={(event) => startMediaDrag(event, item, index)}
                onDragEnd={endMediaDrag}
                onPointerDown={(event) => startPointerDrag(event, item, index)}
                onPointerMove={movePointerDrag}
                onPointerUp={endPointerDrag}
                onPointerCancel={endPointerDrag}
                onTouchStart={(event) => startTouchDrag(event, item, index)}
                onTouchMove={moveTouchDrag}
                onTouchEnd={endMediaDrag}
                title="Kéo để đổi thứ tự"
              >
                <GripVertical size={15} />
              </span>
              <button type="button" onClick={() => moveMediaStep(index, -1)} disabled={index === 0} aria-label={`Đưa ${item.type === 'video' ? 'video' : 'ảnh'} ${index + 1} lên trước`}><ArrowUp size={15} /></button>
              <button type="button" onClick={() => moveMediaStep(index, 1)} disabled={index === media.length - 1} aria-label={`Đưa ${item.type === 'video' ? 'video' : 'ảnh'} ${index + 1} xuống sau`}><ArrowDown size={15} /></button>
            </>}
            <button type="button" className="inline-post-editor__remove-media" onClick={() => removeMedia(index)} aria-label={`Xóa ${item.type === 'video' ? 'video' : 'ảnh'} ${index + 1}`}><Trash2 size={15} /></button>
          </div>
          {isMultiMedia && <textarea value={item.description || ''} onChange={(event) => updateMediaDescription(index, event.target.value)} aria-label={`Chú thích ${item.type === "video" ? "video" : "ảnh"} ${index + 1}`} rows="2" />}
        </div>
      </article>)}</div>
    </section>}
    <div className="inline-post-editor__actions">
      <ImageAttachment id={attachmentId} value={media} onChange={onMediaChange} multiple hidePreviews />
      <button type="button" onClick={onCancel}>Hủy</button>
      <button type="submit">Lưu</button>
    </div>
  </form>;
}

export default PostComposerDialog;
