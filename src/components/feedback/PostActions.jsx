import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import './postActions.css';

export function PostActions({
  isLiked,
  likeCount,
  commentCount,
  shareCount,
  onLike,
  onShowLikes,
  onComment,
  commentsTo,
  commentsOpen,
  commentsInDialog,
  onShare,
  onShowShares,
}) {
  const commentLabel = commentCount > 0 ? `${commentCount} bình luận` : 'Bình luận';
  const commentContent = <><MessageCircle size={19} aria-hidden="true" />{commentCount > 0 && <span>{commentCount}</span>}</>;

  return <div className="post-actions" role="group" aria-label="Tương tác">
    <div className="post-actions__group">
      <button type="button" className="post-actions__icon" aria-label="Thích" aria-pressed={isLiked} title={isLiked ? 'Bỏ thích' : 'Thích'} onClick={onLike}>
        <Heart size={19} aria-hidden="true" fill={isLiked ? 'currentColor' : 'none'} />
      </button>
      {likeCount > 0 && <button type="button" className="post-actions__count" aria-label={`Xem ${likeCount} lượt thích`} title="Xem người đã thích" onClick={onShowLikes}>{likeCount}</button>}
    </div>
    {commentsTo
      ? <Link className="post-actions__icon" to={commentsTo} state={{ fromPostList: true }} aria-label={commentLabel} title="Bình luận">{commentContent}</Link>
      : <button type="button" className="post-actions__icon" aria-label={commentLabel} title="Bình luận" aria-expanded={commentsOpen} aria-haspopup={commentsInDialog ? 'dialog' : undefined} onClick={onComment}>{commentContent}</button>}
    <div className="post-actions__group">
      <button type="button" className="post-actions__icon" aria-label="Chia sẻ" title="Chia sẻ" onClick={onShare}><Share2 size={19} aria-hidden="true" /></button>
      {shareCount > 0 && <button type="button" className="post-actions__count" aria-label={`Xem ${shareCount} lượt chia sẻ`} title="Xem người đã chia sẻ" onClick={onShowShares}>{shareCount}</button>}
    </div>
  </div>;
}
