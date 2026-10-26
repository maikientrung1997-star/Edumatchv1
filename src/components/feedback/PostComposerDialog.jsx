import { ImagePlus, Send } from 'lucide-react';
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
}) {
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

export default PostComposerDialog;
