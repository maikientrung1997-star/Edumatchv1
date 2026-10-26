import { ImagePlus, LoaderCircle, Video, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRef, useState } from 'react';
import { saveVideoMedia } from '@/utils/mediaLibrary';

export function MediaAttachment({ value, onChange, id, label = 'Ảnh / video', multiple = false }) {
  const inputRef = useRef(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const readAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không thể đọc tệp đã chọn.'));
    reader.readAsDataURL(file);
  });

  const optimiseImage = async (file) => {
    const source = await readAsDataUrl(file);
    const image = await new Promise((resolve, reject) => {
      const preview = new Image();
      preview.onload = () => resolve(preview);
      preview.onerror = reject;
      preview.src = source;
    });
    const maximumDimension = 960;
    const scale = Math.min(1, maximumDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.72);
  };

  const chooseMedia = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const input = event.target;
    const validFiles = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (validFiles.length !== files.length) toast.error('Chỉ có thể chọn tệp ảnh hoặc video.');
    if (!validFiles.length) {
      input.value = '';
      return;
    }
    const readFile = async (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        // Video must stay a Blob in IndexedDB. Converting it to Base64 would
        // exhaust localStorage and make publishing fail for otherwise valid videos.
        const storedVideo = await saveVideoMedia(file);
        return { src: storedVideo.src, storageKey: storedVideo.storageKey, name: file.name, type: 'video' };
      }

      let src;
      try {
        // Large source images are accepted, then stored in an optimized form so
        // posting remains reliable in the browser's local storage.
        src = await optimiseImage(file);
      } catch {
        src = await readAsDataUrl(file);
      }
      return { src, name: file.name, type: 'image' };
    };

    setIsPreparing(true);
    try {
      const nextItems = await Promise.all(validFiles.map(readFile));
      if (!multiple) {
        onChange(nextItems[0] || null);
        return;
      }
      const currentItems = Array.isArray(value) ? value : [];
      onChange([...currentItems, ...nextItems]);
    } catch (error) {
      toast.error(validFiles.some((file) => file.type.startsWith('video/'))
        ? (error?.message || 'Không thể chuẩn bị video. Vui lòng thử lại.')
        : 'Không thể chuẩn bị ảnh để đăng. Vui lòng chọn lại ảnh khác.');
    } finally {
      setIsPreparing(false);
      input.value = '';
    }
  };

  const clearImage = (index = null) => {
    if (multiple) {
      onChange((Array.isArray(value) ? value : []).filter((_, itemIndex) => itemIndex !== index));
    } else {
      onChange(null);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const previewItems = multiple ? (Array.isArray(value) ? value : []) : value ? [value] : [];

  return <span className="image-attachment" aria-busy={isPreparing}>
    <input ref={inputRef} id={id} type="file" accept="image/*,video/*" multiple={multiple} onChange={chooseMedia} disabled={isPreparing} />
    <label className={isPreparing ? 'is-preparing' : ''} htmlFor={id} title={isPreparing ? 'Đang chuẩn bị tệp đính kèm' : 'Đính kèm ảnh hoặc video'}>{isPreparing ? <LoaderCircle className="image-attachment__spinner" size={16} /> : previewItems.some((item) => item.type === 'video') ? <Video size={16} /> : <ImagePlus size={16} />}<span>{isPreparing ? 'Đang chuẩn bị…' : label}</span></label>
    {previewItems.map((item, index) => <span className="image-attachment__preview" key={`${item.name || item.src}-${index}`}>{item.type === 'video' ? <video src={item.src} muted /> : <img src={item.src} alt="Ảnh đính kèm xem trước" />}<button type="button" onClick={() => clearImage(index)} aria-label="Xóa tệp đính kèm"><X size={12} /></button></span>)}
  </span>;
}

export const ImageAttachment = MediaAttachment;
export default MediaAttachment;
