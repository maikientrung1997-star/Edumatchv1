import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/feedback/Modal';
import { DefaultRoleAvatar } from '@/components/common/DefaultRoleAvatar';
import { ROUTES } from '@/constants/routes';
import './postImageDialog.css';

export function PostImageDialog({ viewer, onClose, discussion, interactionTarget = null, onActiveIndexChange, onLike, onShowLikes, onShare, onShowShares, shareCount = 0, isLiked = false, ownerActions = null }) {
  const [activeIndex, setActiveIndex] = useState(viewer?.activeIndex || 0);
  const mediaItems = viewer?.mediaItems || [];
  const activeMedia = mediaItems[activeIndex] || mediaItems[0];
  const post = viewer?.post;
  const author = viewer?.author;
  const target = interactionTarget || post;
  const likes = target?.likes || [];
  const comments = target?.comments || [];

  const changeActiveIndex = useCallback((nextIndex) => {
    setActiveIndex(nextIndex);
    onActiveIndexChange?.(nextIndex);
  }, [onActiveIndexChange]);
  const showPrevious = () => changeActiveIndex((activeIndex - 1 + mediaItems.length) % mediaItems.length);
  const showNext = () => changeActiveIndex((activeIndex + 1) % mediaItems.length);

  useEffect(() => {
    if (!viewer || mediaItems.length < 2) return undefined;

    const handleAlbumKeyDown = (event) => {
      const tagName = event.target?.tagName;
      if (event.defaultPrevented || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        changeActiveIndex((activeIndex - 1 + mediaItems.length) % mediaItems.length);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        changeActiveIndex((activeIndex + 1) % mediaItems.length);
      }
    };

    window.addEventListener('keydown', handleAlbumKeyDown);
    return () => window.removeEventListener('keydown', handleAlbumKeyDown);
  }, [activeIndex, changeActiveIndex, mediaItems.length, viewer]);

  if (!viewer || !post || !activeMedia) return null;

  return <Modal open onClose={onClose} title={interactionTarget ? 'Ảnh / video trong album' : 'Ảnh bài viết'} size="xl" className="post-image-dialog">
    <div className="post-image-dialog__layout">
      <section className="post-image-dialog__media" aria-label={`Ảnh ${activeIndex + 1} trong bài viết`}>
        {activeMedia.type === 'video'
          ? <video src={activeMedia.src} controls autoPlay preload="metadata" />
          : <img src={activeMedia.src} alt={`Ảnh ${activeIndex + 1} trong bài viết`} />}
        {mediaItems.length > 1 && <><button type="button" className="post-image-dialog__nav post-image-dialog__nav--previous" onClick={showPrevious} aria-label="Ảnh trước"><ChevronLeft size={22} /></button><button type="button" className="post-image-dialog__nav post-image-dialog__nav--next" onClick={showNext} aria-label="Ảnh tiếp theo"><ChevronRight size={22} /></button><span className="post-image-dialog__counter">{activeIndex + 1} / {mediaItems.length}</span><span className="post-image-dialog__keyboard-hint">Dùng phím ← → để xem ảnh</span></>}
      </section>
      <aside className="post-image-dialog__panel">
        <header className="post-image-dialog__author">
          <span>{author?.avatar ? <img src={author.avatar} alt="" /> : <DefaultRoleAvatar role={author?.role} size={18} />}</span>
          <div>{author?.id ? <Link to={ROUTES.TEACHER_PROFILE(author.id)}>{author.name}</Link> : <strong>{author?.name || 'Thành viên EduMatch'}</strong>}<small>{viewer.publishedAt}</small></div>
          {ownerActions && <div className="post-image-dialog__owner-actions">{ownerActions}</div>}
        </header>
        {post.text && <p className="post-image-dialog__text">{post.text}</p>}
        <div className="post-image-dialog__stats"><button type="button" onClick={onShowLikes}>{likes.length ? `${likes.length} lượt thích` : 'Chưa có lượt thích'}</button><span>{comments.length} bình luận</span>{shareCount > 0 && <button type="button" onClick={onShowShares}>{shareCount} lượt chia sẻ</button>}</div>
        <div className="post-image-dialog__actions"><button type="button" className={isLiked ? 'is-liked' : ''} onClick={onLike}><Heart size={16} fill={isLiked ? 'currentColor' : 'none'} /> {isLiked ? 'Đã thích' : 'Thích'}</button><button type="button" onClick={onShare}><Share2 size={16} /> Chia sẻ</button></div>
        <div className="post-image-dialog__discussion">{discussion}</div>
      </aside>
    </div>
  </Modal>;
}
