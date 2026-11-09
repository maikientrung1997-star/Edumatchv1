import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/feedback/Modal';
import { RoleAvatar } from '@/components/common/DefaultRoleAvatar';
import { ContentMenu } from '@/components/feedback/ContentMenu';
import { ROUTES } from '@/constants/routes';
import './postImageDialog.css';

const mobileQuery = '(max-width: 760px)';
const isMobileViewport = () => window.matchMedia(mobileQuery).matches;
function subscribeToViewport(callback) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

function focusDiscussion(section) {
  section?.focus({ preventScroll: true });
  section?.scrollIntoView({ block: 'start' });
}

function MobileMediaList({ activeIndex, children }) {
  const listRef = useRef(null);
  const initialIndex = useRef(activeIndex);

  useLayoutEffect(() => {
    const list = listRef.current;
    const entry = list.children[initialIndex.current];
    if (entry && initialIndex.current > 0) list.scrollTop = entry.offsetTop;
  }, []);

  return <div className="post-image-dialog__mobile-list" ref={listRef}>{children}</div>;
}

function MobileCommentsSheet({ children, onClose }) {
  const dragStart = useRef(null);

  return (
    <Modal open title="Bình luận" onClose={onClose} className="post-image-comments-sheet" overlayClassName="post-image-comments-overlay">
      <div
        className="post-image-comments-sheet__handle"
        aria-hidden="true"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          dragStart.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { dragStart.current = null; }}
        onPointerUp={(event) => {
          if (!event.isPrimary || !dragStart.current) return;
          const { x, y } = dragStart.current;
          dragStart.current = null;
          const downward = event.clientY - y;
          if (downward >= 56 && downward > Math.abs(event.clientX - x)) onClose();
        }}
      />
      {children}
    </Modal>
  );
}

export function PostImageDialog(props) {
  return props.viewer?.post ? <OpenPostImageDialog {...props} /> : null;
}

function OpenPostImageDialog({
  viewer,
  onClose,
  onAuthorClick,
  discussion,
  getInteractions,
  onActiveIndexChange,
  onShowLikes,
  onShowShares,
  ownerActions = null,
  onEditMedia,
  onDeleteMedia,
}) {
  const isMobile = useSyncExternalStore(subscribeToViewport, isMobileViewport, () => false);
  const [openMediaMenu, setOpenMediaMenu] = useState(null);
  const [mediaEditor, setMediaEditor] = useState(null);
  const [openDiscussionIndex, setOpenDiscussionIndex] = useState(null);
  const discussionRef = useRef(null);
  const requestedDiscussionIndex = useRef(null);
  const activeIndex = viewer.activeIndex || 0;
  const mediaItems = viewer.mediaItems || [];
  const activeMedia = mediaItems[activeIndex];
  const useCommentsSheet = isMobile && !viewer.fromAlbum && mediaItems.length > 1;
  const showCommentsSheet = useCommentsSheet && openDiscussionIndex === activeIndex && Boolean(discussion);

  useLayoutEffect(() => {
    if (isMobile && !useCommentsSheet && requestedDiscussionIndex.current === activeIndex) {
      focusDiscussion(discussionRef.current);
    }
    requestedDiscussionIndex.current = null;
  }, [activeIndex, isMobile, useCommentsSheet]);

  if (!activeMedia) return null;

  const { post, author, publishedAt } = viewer;
  const rawAlbumName = viewer.albumName || post.albumName || activeMedia.albumName;
  const isGenericTab = ['Tất cả', 'Ảnh', 'Video', 'Album', 'all-media', 'photos', 'videos', 'albums'].includes(String(rawAlbumName || '').trim());
  const albumName = isGenericTab ? '' : rawAlbumName;
  const activeInteractions = getInteractions(activeIndex);
  const postTitle = author?.name ? `Bài viết của ${author.name}` : 'Bài viết';
  const dialogTitle = isMobile
    ? (viewer.fromAlbum ? albumName || 'Ảnh' : postTitle)
    : albumName || 'Ảnh bài viết';
  const authorName = author?.name || 'Thành viên EduMatch';
  const authorLink = author?.id ? ROUTES.TEACHER_PROFILE(author.id) : '';
  const avatar = <RoleAvatar src={author?.avatar} userId={author?.id} name={authorName} role={author?.role} size={18} alt="" />;
  const changeIndex = (offset) => {
    setMediaEditor(null);
    setOpenMediaMenu(null);
    onActiveIndexChange((activeIndex + offset + mediaItems.length) % mediaItems.length);
  };
  const goToComments = (index) => {
    if (useCommentsSheet) {
      setOpenDiscussionIndex(index);
      if (index !== activeIndex) onActiveIndexChange(index);
    } else if (index === activeIndex) {
      focusDiscussion(discussionRef.current);
    } else {
      requestedDiscussionIndex.current = index;
      onActiveIndexChange(index);
    }
  };

  const renderEntry = (item, index) => {
    const { likes, commentCount, shareIds, isLiked, isMedia, like, share, canManageMedia } = index === activeIndex ? activeInteractions : getInteractions(index);
    const kind = isMedia ? 'ảnh/video' : 'bài viết';
    const isVideo = item.type === 'video';
    const mediaType = isVideo ? 'video' : 'ảnh';
    const mediaLabel = `${isVideo ? 'Video' : 'Ảnh'} ${index + 1} trong ${dialogTitle}`;
    const itemKey = item.id || item.storageKey || item.src;
    const showInlineDiscussion = index === activeIndex && !useCommentsSheet && Boolean(discussion);
    const discussionIsOpen = showInlineDiscussion || (index === activeIndex && showCommentsSheet);
    const editor = mediaEditor?.key === itemKey ? mediaEditor : null;
    const mediaMenu = canManageMedia && <ContentMenu
      id={`viewer-media-${index}`}
      openId={openMediaMenu}
      onToggle={setOpenMediaMenu}
      onEdit={() => {
        onActiveIndexChange(index);
        setMediaEditor({ key: itemKey, caption: item.description || '' });
      }}
      onDelete={() => {
        onActiveIndexChange(index);
        setMediaEditor({ key: itemKey, confirmingDelete: true });
      }}
      label={mediaType}
    />;

    const media = <section className="post-image-dialog__media" aria-label={mediaLabel}>
      {isVideo
        ? <video key={itemKey} src={item.src} controls playsInline autoPlay={!isMobile} preload="metadata" />
        : <img src={item.src} alt={mediaLabel} loading={isMobile && index > activeIndex ? 'lazy' : undefined} />}
      {!isMobile && mediaItems.length > 1 && <>
        <button type="button" className="post-image-dialog__nav post-image-dialog__nav--previous" onClick={() => changeIndex(-1)} aria-label="Ảnh trước"><ChevronLeft size={22} /></button>
        <button type="button" className="post-image-dialog__nav post-image-dialog__nav--next" onClick={() => changeIndex(1)} aria-label="Ảnh tiếp theo"><ChevronRight size={22} /></button>
        <span className="post-image-dialog__counter">{index + 1} / {mediaItems.length}</span>
      </>}
    </section>;
    const details = <>
      <header className="post-image-dialog__author">
        {authorLink ? <Link to={authorLink} onClick={onAuthorClick || onClose} aria-label={authorName}>{avatar}</Link> : <span>{avatar}</span>}
        <div>{authorLink ? <Link to={authorLink} onClick={onAuthorClick || onClose}>{authorName}</Link> : <strong>{authorName}</strong>}<small>{publishedAt}</small></div>
        {mediaMenu}
        {ownerActions && <div className="post-image-dialog__owner-actions">{ownerActions}</div>}
      </header>
      {editor && !editor.confirmingDelete ? <section className="post-image-dialog__media-editor" aria-label="Chỉnh sửa chú thích">
        <textarea autoFocus value={editor.caption} onChange={(event) => setMediaEditor({ ...editor, caption: event.target.value })} placeholder="Viết chú thích cho ảnh hoặc video này..." rows="3" />
        <div><button type="button" onClick={() => setMediaEditor(null)}>Hủy</button><button type="button" onClick={() => { onEditMedia?.(item, editor.caption); setMediaEditor(null); }}>Lưu</button></div>
      </section> : item.description && <p className="post-image-dialog__media-description">{item.description}</p>}
      {editor?.confirmingDelete && <section className="post-image-dialog__delete-confirm" role="alert">
        <p>Bạn có chắc muốn xóa {mediaType} này?</p>
        <div><button type="button" onClick={() => setMediaEditor(null)}>Hủy</button><button type="button" onClick={() => { onDeleteMedia?.(item); setMediaEditor(null); }}>Xóa</button></div>
      </section>}
    </>;
    const interactions = <>
      <div className="post-image-dialog__stats">
        {likes.length
          ? <button type="button" onClick={() => onShowLikes(likes, kind)}>{likes.length} lượt thích</button>
          : <span>Chưa có lượt thích</span>}
        {isMobile
          ? <button type="button" aria-expanded={discussionIsOpen} aria-haspopup={useCommentsSheet ? 'dialog' : undefined} onClick={() => goToComments(index)}>{commentCount} bình luận</button>
          : <span>{commentCount} bình luận</span>}
        {shareIds.length > 0 && <button type="button" onClick={() => onShowShares(shareIds, kind)}>{shareIds.length} lượt chia sẻ</button>}
      </div>
      <div className="post-image-dialog__actions">
        <button type="button" className={isLiked ? 'is-liked' : ''} aria-pressed={isLiked} onClick={like}><Heart size={16} fill={isLiked ? 'currentColor' : 'none'} /> {isLiked ? 'Đã thích' : 'Thích'}</button>
        {isMobile && <button type="button" aria-expanded={discussionIsOpen} aria-haspopup={useCommentsSheet ? 'dialog' : undefined} onClick={() => goToComments(index)}><MessageCircle size={16} /> Bình luận</button>}
        <button type="button" onClick={share}><Share2 size={16} /> Chia sẻ</button>
      </div>
    </>;

    return isMobile
      ? <article key={`${itemKey}-${index}`} className="post-image-dialog__mobile-entry">
          {details}{media}{interactions}
          {showInlineDiscussion && (
            <section ref={discussionRef} className="post-image-dialog__discussion" aria-label="Bình luận" tabIndex={-1}>
              {discussion}
            </section>
          )}
        </article>
      : <div className="post-image-dialog__layout">{media}<aside className="post-image-dialog__panel">
          {details}{interactions}
          <div className="post-image-dialog__discussion">{discussion}</div>
        </aside></div>;
  };

  return (<>
    <Modal
      open
      onClose={onClose}
      title={dialogTitle}
      size="xl"
      className="post-image-dialog"
      overlayClassName="post-image-dialog-overlay"
      backButton={isMobile}
      onKeyDown={(event) => {
        if (isMobile || mediaItems.length < 2 || event.defaultPrevented || event.target.closest('input, textarea, select, video, [contenteditable="true"]')) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        changeIndex(event.key === 'ArrowLeft' ? -1 : 1);
      }}
    >
      {isMobile
        ? <MobileMediaList activeIndex={activeIndex}>{mediaItems.map(renderEntry)}</MobileMediaList>
        : renderEntry(activeMedia, activeIndex)}
    </Modal>
    {showCommentsSheet && (
      <MobileCommentsSheet onClose={() => setOpenDiscussionIndex(null)}>
        {discussion}
      </MobileCommentsSheet>
    )}
  </>);
}
