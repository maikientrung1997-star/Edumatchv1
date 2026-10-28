import { ArrowDown, ArrowUp, GripVertical, ImagePlus, Send, Trash2, Video, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Modal } from '@/components/feedback/Modal';
import { ImageAttachment } from '@/components/forms/ImageAttachment';
import { DefaultRoleAvatar } from '@/components/common/DefaultRoleAvatar';
import './post-composer-dialog.css';

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
  const [draggedMediaIndex, setDraggedMediaIndex] = useState(null);
  const draggedMediaKey = useRef('');
  const updateMediaDescription = (index, description) => {
    onMediaChange(media.map((item, itemIndex) => itemIndex === index ? { ...item, description } : item));
  };
  const moveMedia = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= media.length || toIndex >= media.length) return;
    const reorderedMedia = [...media];
    const [movedItem] = reorderedMedia.splice(fromIndex, 1);
    reorderedMedia.splice(toIndex, 0, movedItem);
    onMediaChange(reorderedMedia);
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
  const mediaKey = (item, index) => item.id || item.storageKey || `${item.name || item.src}-${index}`;
  const startMediaDrag = (event, item, index) => {
    const key = mediaKey(item, index);
    draggedMediaKey.current = key;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
    setDraggedMediaIndex(index);
  };
  const reorderDuringDrag = (event, item, index) => {
    event.preventDefault();
    if (!draggedMediaKey.current) return;
    const fromIndex = media.findIndex((candidate, candidateIndex) => mediaKey(candidate, candidateIndex) === draggedMediaKey.current);
    if (fromIndex < 0 || fromIndex === index) return;
    moveMedia(fromIndex, index);
    setDraggedMediaIndex(index);
  };
  const endMediaDrag = () => {
    draggedMediaKey.current = '';
    setDraggedMediaIndex(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="Tạo bài viết" size="xl" className="post-composer-dialog">
      <form className="post-composer-dialog__form" onSubmit={onPublish}>
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={placeholder}
          rows="12"
          autoFocus
          aria-label="Nội dung bài viết"
        />
        <div className="post-composer-dialog__media">
          <ImageAttachment
            id={attachmentId}
            value={media}
            onChange={onMediaChange}
            label="Thêm ảnh / video"
            multiple
          />
        </div>
        {media.length > 0 && <section className="post-composer-dialog__media-descriptions" aria-label="Chú thích từng ảnh và video">
          <div className="post-composer-dialog__media-description-list">
            {media.map((item, index) => <label className={draggedMediaIndex === index ? 'is-dragging' : ''} key={mediaKey(item, index)} onDragOver={(event) => reorderDuringDrag(event, item, index)} onDrop={endMediaDrag}>
              <span className="post-composer-dialog__media-thumbnail">{item.type === 'video' ? <video src={item.src} muted /> : <img src={item.src} alt="" />}</span>
              {media.length > 1 && <span className="post-composer-dialog__drag-handle" draggable onDragStart={(event) => startMediaDrag(event, item, index)} onDragEnd={endMediaDrag} title="Kéo để đổi thứ tự"><GripVertical size={17} /></span>}
              <textarea value={item.description || ''} onChange={(event) => updateMediaDescription(index, event.target.value)} placeholder="Chú thích" rows="2" />
            </label>)}
          </div>
        </section>}
        {media.length > 0 && <section className="post-composer-dialog__album">
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
          <button type="submit" className="post-composer-dialog__publish" disabled={!draft.trim() && !media.length}>
            <Send size={17} /> Đăng bài
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PostComposerTrigger({ avatar, role, placeholder, onOpen }) {

  return (
    <section className="post-composer-trigger" aria-label="Tạo bài viết">
      <div className="post-composer-trigger__top">
        <div className="post-composer-trigger__avatar" aria-hidden="true">
          {avatar ? <img src={avatar} alt="" /> : <DefaultRoleAvatar role={role} size={19} />}
        </div>
        <button type="button" className="post-composer-trigger__prompt" onClick={onOpen}>
          {placeholder}
        </button>
      </div>
      <div className="post-composer-trigger__footer">
        <button type="button" className="post-composer-trigger__media" onClick={onOpen}>
          <ImagePlus size={18} aria-hidden="true" />
          <span>Ảnh / video</span>
        </button>
      </div>
    </section>
  );
}

export function InlinePostEditor({ draft, onDraftChange, media, onMediaChange, onCancel, onSave, attachmentId }) {
  const moveMedia = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= media.length) return;
    const nextMedia = [...media];
    [nextMedia[index], nextMedia[nextIndex]] = [nextMedia[nextIndex], nextMedia[index]];
    onMediaChange(nextMedia);
  };
  const removeMedia = (index) => onMediaChange(media.filter((_, itemIndex) => itemIndex !== index));
  const updateMediaDescription = (index, description) => onMediaChange(media.map((item, itemIndex) => itemIndex === index ? { ...item, description } : item));

  return <form className="inline-post-editor" onSubmit={onSave}>
    <textarea autoFocus value={draft} onChange={(event) => onDraftChange(event.target.value)} rows="3" placeholder="Viết nội dung bài đăng..." />
    <section className="inline-post-editor__media" aria-label="Chỉnh sửa ảnh và video của bài viết">
      <div className="inline-post-editor__media-header"><div><strong>Ảnh và video</strong><small>Thay đổi thứ tự để chọn tệp hiển thị trước.</small></div><ImageAttachment id={attachmentId} value={media} onChange={onMediaChange} label="Thêm ảnh / video" multiple hidePreviews /></div>
      {media.length ? <div className="inline-post-editor__media-list">{media.map((item, index) => <article key={`${item.id || item.name || item.src}-${index}`}><div className="inline-post-editor__media-preview">{item.type === 'video' ? <><video src={item.src} muted /><span><Video size={14} /></span></> : <img src={item.src} alt="" />}</div><div className="inline-post-editor__media-controls"><div><strong>{item.type === 'video' ? 'Video' : 'Ảnh'} {index + 1}</strong><div><button type="button" onClick={() => moveMedia(index, -1)} disabled={index === 0} aria-label={`Đưa ${item.type === 'video' ? 'video' : 'ảnh'} ${index + 1} lên trước`}><ArrowUp size={15} /></button><button type="button" onClick={() => moveMedia(index, 1)} disabled={index === media.length - 1} aria-label={`Đưa ${item.type === 'video' ? 'video' : 'ảnh'} ${index + 1} xuống sau`}><ArrowDown size={15} /></button><button type="button" className="inline-post-editor__remove-media" onClick={() => removeMedia(index)} aria-label={`Xóa ${item.type === 'video' ? 'video' : 'ảnh'} ${index + 1}`}><Trash2 size={15} /></button></div></div><textarea value={item.description || ''} onChange={(event) => updateMediaDescription(index, event.target.value)} placeholder="Chú thích" rows="2" /></div></article>)}</div> : <p className="inline-post-editor__media-empty">Bài viết chưa có ảnh hoặc video.</p>}
    </section>
    <div><button type="button" onClick={onCancel}>Hủy</button><button type="submit">Lưu thay đổi</button></div>
  </form>;
}

export default PostComposerDialog;
