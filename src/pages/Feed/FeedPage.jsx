import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, BookOpen, CornerDownRight, Heart, Image as ImageIcon, MessageCircle, Newspaper, Send, Share2, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createNotification, deletePost, getCourses, getPostMediaItems, getPosts, getProviderAffinity, savePost, trackProviderAffinity, updatePost, updatePostMediaItem } from '@/features/learning/marketplace';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { ImageAttachment } from '@/components/forms/ImageAttachment';
import { DefaultRoleAvatar } from '@/components/common/DefaultRoleAvatar';
import { ContentMenu } from '@/components/feedback/ContentMenu';
import { ExpandableImage } from '@/components/feedback/ExpandableImage';
import { LikesModal } from '@/components/feedback/LikesModal';
import { Modal } from '@/components/feedback/Modal';
import { PostComposerDialog, PostComposerTrigger } from '@/components/feedback/PostComposerDialog';
import { PostImageDialog } from '@/components/feedback/PostImageDialog';
import { ReactionCount } from '@/components/feedback/ReactionCount';
import { submitOnPlainEnter } from '@/utils/submitOnPlainEnter';
import { formatRelativeTime } from '@/utils/formatDate';
import './feed.css';

const getAuthor = (item, providers) => {
  const provider = providers.get(item.authorId || item.teacherId);
  return {
    id: item.authorId || item.teacherId || '',
    name: item.authorName || item.author || provider?.name || 'Thành viên EduMatch',
    role: item.authorRole || provider?.role || 'teacher',
    avatar: item.authorAvatar || provider?.avatar || '',
    licenseVerificationStatus: item.authorLicenseVerificationStatus || provider?.licenseVerificationStatus || '',
  };
};

const getMediaItems = getPostMediaItems;

const getOriginalSharedPost = (post, posts, getPostAuthor) => {
  let snapshot = post.sharedPost;
  const visited = new Set([post.id]);

  while (snapshot?.id && !visited.has(snapshot.id)) {
    visited.add(snapshot.id);
    const sourcePost = posts.find((item) => item.id === snapshot.id);
    if (!sourcePost) break;
    if (!sourcePost.sharedPost) {
      return {
        id: sourcePost.id,
        mediaId: snapshot.mediaId || null,
        author: getPostAuthor(sourcePost),
        text: sourcePost.text || '',
        media: sourcePost.media || null,
        mediaItems: sourcePost.mediaItems || [],
      };
    }
    snapshot = sourcePost.sharedPost;
  }

  return snapshot;
};

const interactionScore = (post) =>
  (post.likes || []).length * 2 + (post.comments || []).reduce((total, comment) => total + 3 + (comment.replies || []).length * 2, 0);

const affinityScore = (post, affinity) => {
  const providerId = String(post.authorId || post.teacherId || '');
  const alternateId = providerId.startsWith('teacher-') ? providerId.slice('teacher-'.length) : `teacher-${providerId}`;
  return Number(affinity[providerId] || affinity[alternateId] || 0);
};

const POSTS_BATCH_SIZE = 12;
const FRESH_POST_WINDOW = 72 * 60 * 60 * 1000;

export function FeedPage({ postId = null }) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState(() => getPosts().slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)));
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentMedia, setCommentMedia] = useState({});
  const [editingDiscussion, setEditingDiscussion] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyMedia, setReplyMedia] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [shareText, setShareText] = useState('');
  const [openContentMenu, setOpenContentMenu] = useState(null);
  const [likesTarget, setLikesTarget] = useState(null);
  const [imageViewer, setImageViewer] = useState(null);
  const [feedTab, setFeedTab] = useState(() => user?.role === 'student' ? 'students' : 'providers');
  const [postDraft, setPostDraft] = useState('');
  const [postMedia, setPostMedia] = useState([]);
  const [isPostComposerOpen, setIsPostComposerOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingPostText, setEditingPostText] = useState('');
  const [visiblePostCount, setVisiblePostCount] = useState(POSTS_BATCH_SIZE);
  const loadMoreRef = useRef(null);
  const providers = useMemo(() => new Map(getCourses().map((course) => [course.teacher.id, course.teacher])), []);
  const rankedPosts = useMemo(() => {
    const affinity = getProviderAffinity(user?.id);
    return posts.slice().sort((first, second) => {
      const firstAge = Math.max(0, Date.now() - new Date(first.createdAt || 0).getTime());
      const secondAge = Math.max(0, Date.now() - new Date(second.createdAt || 0).getTime());
      const firstIsFresh = firstAge <= FRESH_POST_WINDOW;
      const secondIsFresh = secondAge <= FRESH_POST_WINDOW;
      if (firstIsFresh || secondIsFresh) {
        if (firstIsFresh !== secondIsFresh) return firstIsFresh ? -1 : 1;
        return new Date(second.createdAt) - new Date(first.createdAt);
      }
      const firstIsCurrentUser = String(first.authorId || first.teacherId || '') === String(user?.id || '');
      const secondIsCurrentUser = String(second.authorId || second.teacherId || '') === String(user?.id || '');
      if (firstIsCurrentUser !== secondIsCurrentUser) return firstIsCurrentUser ? -1 : 1;
      const firstAffinity = affinityScore(first, affinity);
      const secondAffinity = affinityScore(second, affinity);
      if (firstAffinity || secondAffinity) return secondAffinity - firstAffinity || new Date(second.createdAt) - new Date(first.createdAt);
      const interactionDifference = interactionScore(second) - interactionScore(first);
      return interactionDifference || new Date(second.createdAt) - new Date(first.createdAt);
    });
  }, [posts, user?.id]);
  const visiblePosts = postId
    ? rankedPosts.filter((post) => post.id === postId)
    : rankedPosts.filter((post) => feedTab === 'students'
      ? getAuthor(post, providers).role === 'student'
      : getAuthor(post, providers).role !== 'student');
  const renderedPosts = postId ? visiblePosts : visiblePosts.slice(0, visiblePostCount);
  const isProviderAccount = ['teacher', 'center'].includes(user?.role);
  const canPublishInCurrentFeed = !postId && (
    (feedTab === 'providers' && isProviderAccount)
    || (feedTab === 'students' && user?.role === 'student')
  );
  const composerPlaceholder = 'Hãy chia sẻ để học viên hiểu hơn về bạn';

  useEffect(() => {
    if (postId || visiblePostCount >= visiblePosts.length) return undefined;
    const target = loadMoreRef.current;
    if (!target) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisiblePostCount((current) => Math.min(current + POSTS_BATCH_SIZE, visiblePosts.length));
    }, { rootMargin: '560px 0px' });

    observer.observe(target);
    return () => observer.disconnect();
  }, [postId, visiblePostCount, visiblePosts.length]);

  useEffect(() => {
    const syncPosts = () => {
      setPosts(getPosts().slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)));
    };
    const syncPostsFromAnotherTab = (event) => {
      if (event.key === STORAGE_KEYS.TEACHER_POSTS) syncPosts();
    };

    window.addEventListener('edumatch:posts-updated', syncPosts);
    window.addEventListener('storage', syncPostsFromAnotherTab);
    return () => {
      window.removeEventListener('edumatch:posts-updated', syncPosts);
      window.removeEventListener('storage', syncPostsFromAnotherTab);
    };
  }, []);

  const requireAuth = () => {
    if (isAuthenticated) return true;
    toast.error('Vui lòng đăng nhập để tương tác với Bảng Tin.');
    navigate(ROUTES.LOGIN);
    return false;
  };

  const saveInteraction = (postId, transform) => {
    const next = updatePost(postId, transform);
    setPosts(next.slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)));
  };
  const getInteractionTarget = (post, mediaId = null) => mediaId
    ? getMediaItems(post).find((item) => item.id === mediaId) || null
    : post;
  const saveMediaInteraction = (postId, mediaId, transform) => {
    const next = updatePostMediaItem(postId, mediaId, transform);
    setPosts(next.slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)));
  };

  const owns = (authorId) => Boolean(user?.id != null && String(authorId) === String(user.id));
  const editPost = (post) => {
    if (!owns(post.authorId || post.teacherId)) return;
    setEditingPostId(post.id);
    setEditingPostText(post.text || '');
    setOpenContentMenu(null);
  };
  const cancelPostEdit = () => {
    setEditingPostId(null);
    setEditingPostText('');
  };
  const savePostEdit = (event, post) => {
    event.preventDefault();
    const text = editingPostText.trim();
    if (!text && !getMediaItems(post).length) {
      toast.error('Bài viết cần có nội dung hoặc ảnh/video.');
      return;
    }
    saveInteraction(post.id, (current) => ({ ...current, text }));
    cancelPostEdit();
    toast.success('Đã cập nhật bài viết.');
  };
  const removePost = (post) => {
    if (!owns(post.authorId || post.teacherId) || !window.confirm('Xóa bài viết này?')) return;
    setPosts(deletePost(post.id).slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)));
  };
  const openShareDialog = (post, mediaItem = null) => {
    if (!requireAuth()) return;
    setShareTarget({ post, mediaId: mediaItem?.id || null });
    setShareText('');
  };
  const openImageViewer = (post, author, mediaItems, activeIndex = 0) => {
    setImageViewer({ post, author, mediaItems, activeIndex });
  };
  const publishFeedPost = (event) => {
    event.preventDefault();
    if (!requireAuth()) return;

    const mayPublish = (feedTab === 'providers' && ['teacher', 'center'].includes(user.role))
      || (feedTab === 'students' && user.role === 'student');
    if (!mayPublish) {
      toast.error('Bạn chỉ có thể đăng bài trong mục phù hợp với loại tài khoản của mình.');
      return;
    }

    const text = postDraft.trim();
    if (!text && !postMedia.length) {
      toast.error('Hãy viết nội dung hoặc chọn ảnh/video để đăng.');
      return;
    }

    const post = {
      id: `post-${Date.now()}`,
      teacherId: user.id,
      authorId: user.id,
      authorName: user.name || 'Thành viên EduMatch',
      authorRole: user.role,
      authorAvatar: user.avatar || '',
      authorLicenseVerificationStatus: user.licenseVerificationStatus || '',
      text,
      ...(postMedia.length ? { mediaItems: postMedia } : {}),
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
    };
    if (!savePost(post)) {
      toast.error('Không thể lưu ảnh vào bộ nhớ trình duyệt. Vui lòng thử đăng ít ảnh hơn hoặc tải lại trang.');
      return;
    }
    setPosts(getPosts().slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)));
    setPostDraft('');
    setPostMedia([]);
    setIsPostComposerOpen(false);
    setVisiblePostCount(POSTS_BATCH_SIZE);
    toast.success('Bài viết đã được đăng lên Bảng Tin.');
  };
  const sharePost = (event) => {
    event.preventDefault();
    if (!shareTarget || !requireAuth()) return;
    const { post, mediaId } = shareTarget;
    const originalPost = getOriginalSharedPost(post, posts, (item) => getAuthor(item, providers));
    const source = originalPost?.author || getAuthor(post, providers);
    const originalMediaItems = getMediaItems(originalPost);
    const selectedMedia = mediaId ? originalMediaItems.find((item) => item.id === mediaId) : null;
    const sharedPost = {
      id: `post-share-${Date.now()}`,
      teacherId: user.id,
      authorId: user.id,
      authorName: user.name || 'Thành viên EduMatch',
      authorRole: user.role || 'student',
      authorAvatar: user.avatar || '',
      text: shareText.trim(),
      sharedPost: {
        id: originalPost?.id || post.id,
        ...(mediaId ? { mediaId } : {}),
        author: source,
        text: originalPost?.text || '',
        media: selectedMedia || originalPost?.media || null,
        mediaItems: selectedMedia ? [selectedMedia] : originalMediaItems,
      },
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
    };
    savePost(sharedPost);
    setPosts(getPosts().slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)));
    setShareTarget(null);
    setShareText('');
    toast.success('Bài viết đã được chia sẻ lên trang cá nhân của bạn.');
  };
  const modifyDiscussion = (target, commentId, replyId, transform) => ({
    ...target,
    comments: (target.comments || []).map((comment) => comment.id !== commentId ? comment : replyId
      ? { ...comment, replies: (comment.replies || []).map((reply) => reply.id === replyId ? transform(reply) : reply) }
      : transform(comment)),
  });
  const saveTargetInteraction = (postId, mediaId, transform) => {
    if (mediaId) saveMediaInteraction(postId, mediaId, transform);
    else saveInteraction(postId, transform);
  };
  const discussionKey = (postId, mediaId = null) => `${postId}:${mediaId || 'post'}`;
  const isEditingDiscussion = (postId, mediaId = null) => Boolean(
    editingDiscussion
    && String(editingDiscussion.postId) === String(postId)
    && String(editingDiscussion.mediaId || '') === String(mediaId || ''),
  );
  const cancelDiscussionEdit = (postId, mediaId = null) => {
    if (!isEditingDiscussion(postId, mediaId)) return;
    const draftKey = discussionKey(postId, mediaId);
    setEditingDiscussion(null);
    setCommentDrafts((current) => ({ ...current, [draftKey]: '' }));
    setCommentMedia((current) => ({ ...current, [draftKey]: null }));
  };
  const editDiscussion = (postId, commentId, replyId = null, mediaId = null) => {
    const post = posts.find((item) => item.id === postId);
    const interactionTarget = getInteractionTarget(post, mediaId);
    const comment = interactionTarget?.comments?.find((item) => item.id === commentId);
    const target = replyId ? comment?.replies?.find((item) => item.id === replyId) : comment;
    if (!target || !owns(target.authorId)) return;
    const draftKey = discussionKey(postId, mediaId);
    setEditingDiscussion({ postId, commentId, replyId, mediaId });
    setCommentDrafts((current) => ({ ...current, [draftKey]: target.text || '' }));
    setCommentMedia((current) => ({ ...current, [draftKey]: null }));
    requestAnimationFrame(() => {
      const dialogInput = document.querySelector('.post-image-dialog .feed-comment-form textarea');
      (dialogInput || document.getElementById(`comment-${postId}`))?.focus();
    });
  };
  const removeDiscussion = (postId, commentId, replyId = null, mediaId = null) => {
    const post = posts.find((item) => item.id === postId);
    const interactionTarget = getInteractionTarget(post, mediaId);
    const comment = interactionTarget?.comments?.find((item) => item.id === commentId);
    const target = replyId ? comment?.replies?.find((item) => item.id === replyId) : comment;
    if (!target || !owns(target.authorId) || !window.confirm('Xóa bình luận này?')) return;
    saveTargetInteraction(postId, mediaId, (current) => ({
      ...current,
      comments: replyId
        ? (current.comments || []).map((item) => item.id === commentId ? { ...item, replies: (item.replies || []).filter((reply) => reply.id !== replyId) } : item)
        : (current.comments || []).filter((item) => item.id !== commentId),
    }));
  };

  const toggleLike = (postId, mediaId = null) => {
    if (!requireAuth()) return;
    const post = getPosts().find((item) => item.id === postId);
    const target = getInteractionTarget(post, mediaId);
    if (!target) return;
    const likes = target.likes || [];
    const hasLiked = likes.includes(user.id);
    if (!hasLiked && (post.authorId || post.teacherId) !== user.id) {
      trackProviderAffinity(user.id, post.authorId || post.teacherId, 'liked-post', 3);
      createNotification({ recipientId: post.authorId || post.teacherId, actorName: user.name || 'Một thành viên', actorAvatar: user.avatar || '', type: 'post_like', title: `${user.name || 'Một thành viên'} đã thích ${mediaId ? 'một mục trong album' : 'bài viết'} của bạn`, description: 'Bấm để xem bài viết trong Bảng Tin.', link: ROUTES.POST_DETAIL(postId) });
    }
    saveTargetInteraction(postId, mediaId, (current) => ({ ...current, likes: hasLiked ? likes.filter((id) => id !== user.id) : [...likes, user.id] }));
  };

  const submitComment = (event, postId, mediaId = null) => {
    event.preventDefault();
    if (!requireAuth()) return;
    const draftKey = `${postId}:${mediaId || 'post'}`;
    const text = commentDrafts[draftKey]?.trim();
    const media = commentMedia[draftKey] || null;
    if (isEditingDiscussion(postId, mediaId)) {
      if (!text) {
        toast.error('Bình luận không được để trống.');
        return;
      }
      saveTargetInteraction(postId, mediaId, (current) => modifyDiscussion(
        current,
        editingDiscussion.commentId,
        editingDiscussion.replyId,
        (item) => ({ ...item, text }),
      ));
      setEditingDiscussion(null);
      setCommentDrafts((current) => ({ ...current, [draftKey]: '' }));
      setCommentMedia((current) => ({ ...current, [draftKey]: null }));
      toast.success('Đã cập nhật bình luận.');
      return;
    }
    if (!text && !media) return;
    const comment = { id: `comment-${Date.now()}`, authorId: user.id, authorName: user.name || 'Thành viên EduMatch', authorRole: user.role || 'student', authorAvatar: user.avatar || '', text, media, createdAt: new Date().toISOString(), replies: [], likes: [] };
    const post = getPosts().find((item) => item.id === postId);
    const postAuthorId = post?.authorId || post?.teacherId;
    trackProviderAffinity(user.id, postAuthorId, 'commented-post', 2);
    if (postAuthorId !== user.id) createNotification({ recipientId: postAuthorId, actorName: user.name || 'Một thành viên', actorAvatar: user.avatar || '', type: 'post_comment', title: `${user.name || 'Một thành viên'} đã bình luận về ${mediaId ? 'một mục trong album' : 'bài viết'} của bạn`, description: text, link: ROUTES.POST_DETAIL(postId) });
    saveTargetInteraction(postId, mediaId, (current) => ({ ...current, comments: [...(current.comments || []), comment] }));
    setCommentDrafts((current) => ({ ...current, [draftKey]: '' }));
    setCommentMedia((current) => ({ ...current, [draftKey]: null }));
  };

  const openReply = (postId, commentId, mediaId = null) => {
    if (!requireAuth()) return;
    setReplyTarget({ postId, commentId, mediaId });
    setReplyText('');
    setReplyMedia(null);
  };

  const submitReply = (event) => {
    event.preventDefault();
    if (!replyTarget || !requireAuth()) return;
    const text = replyText.trim();
    if (!text && !replyMedia) return;
    const reply = { id: `reply-${Date.now()}`, authorId: user.id, authorName: user.name || 'Thành viên EduMatch', authorRole: user.role || 'student', authorAvatar: user.avatar || '', text, media: replyMedia, createdAt: new Date().toISOString(), likes: [] };
    const post = getPosts().find((item) => item.id === replyTarget.postId);
    const parentComment = getInteractionTarget(post, replyTarget.mediaId)?.comments?.find((comment) => comment.id === replyTarget.commentId);
    if (parentComment?.authorId && parentComment.authorId !== user.id) createNotification({ recipientId: parentComment.authorId, actorName: user.name || 'Một thành viên', actorAvatar: user.avatar || '', type: 'comment_reply', title: `${user.name || 'Một thành viên'} đã trả lời bình luận của bạn`, description: text, link: ROUTES.POST_DETAIL(replyTarget.postId) });
    saveTargetInteraction(replyTarget.postId, replyTarget.mediaId, (current) => ({ ...current, comments: (current.comments || []).map((comment) => comment.id === replyTarget.commentId ? { ...comment, replies: [...(comment.replies || []), reply] } : comment) }));
    setReplyTarget(null);
    setReplyText('');
    setReplyMedia(null);
  };
  const toggleCommentLike = (postId, commentId, replyId = null, mediaId = null) => {
    if (!requireAuth()) return;
    const post = getPosts().find((item) => item.id === postId);
    const interactionTarget = getInteractionTarget(post, mediaId);
    const comment = interactionTarget?.comments?.find((item) => item.id === commentId);
    const reply = comment?.replies?.find((item) => item.id === replyId);
    const target = reply || comment;
    if (!target) return;
    const likes = target.likes || [];
    const hasLiked = likes.includes(user.id);
    if (!hasLiked && target.authorId && target.authorId !== user.id) createNotification({ recipientId: target.authorId, actorName: user.name || 'Một thành viên', actorAvatar: user.avatar || '', type: 'post_comment', title: `${user.name || 'Một thành viên'} đã thích bình luận của bạn`, description: 'Bấm để xem cuộc trò chuyện trong Bảng Tin.', link: ROUTES.POST_DETAIL(postId) });
    saveTargetInteraction(postId, mediaId, (current) => modifyDiscussion(current, commentId, replyId, (item) => ({ ...item, likes: hasLiked ? likes.filter((id) => id !== user.id) : [...likes, user.id] })));
  };

  const viewerPost = imageViewer ? posts.find((post) => post.id === imageViewer.post.id) || imageViewer.post : null;
  const viewerAuthor = imageViewer?.author || (viewerPost ? getAuthor(viewerPost, providers) : null);
  const viewerMediaItems = getMediaItems(viewerPost);
  const viewerMedia = viewerMediaItems.length > 1 ? viewerMediaItems[imageViewer?.activeIndex || 0] : null;
  const viewerInteractionTarget = viewerMedia || viewerPost;
  const viewerDiscussionKey = viewerMedia ? `${viewerPost.id}:${viewerMedia.id}` : `${viewerPost?.id}:post`;
  const isEditingViewerDiscussion = isEditingDiscussion(viewerPost?.id, viewerMedia?.id);
  const imageViewerDiscussion = viewerInteractionTarget ? <><div className="post-image-dialog__comments">{(viewerInteractionTarget.comments || []).map((comment) => {
      const commentAuthor = getAuthor(comment, providers);
      const isReplying = replyTarget?.postId === viewerPost.id && replyTarget?.commentId === comment.id && replyTarget?.mediaId === viewerMedia?.id;
      const isCommentLiked = (comment.likes || []).includes(user?.id);
      return <div className="post-image-dialog__comment" key={comment.id}>
        {commentAuthor.id ? <Link to={ROUTES.TEACHER_PROFILE(commentAuthor.id)}><strong>{commentAuthor.name}</strong></Link> : <strong>{commentAuthor.name}</strong>}
        {comment.text && <p>{comment.text}</p>}
        {comment.media && (comment.media.type === 'video' ? <video className="discussion-image" src={comment.media.src} controls preload="metadata" /> : <ExpandableImage className="discussion-image" src={comment.media.src} alt={`Ảnh đính kèm từ ${commentAuthor.name}`} />)}
        <div className="post-image-dialog__comment-actions"><button type="button" className={isCommentLiked ? 'is-liked' : ''} onClick={() => toggleCommentLike(viewerPost.id, comment.id, null, viewerMedia?.id)}>{isCommentLiked ? 'Đã thích' : 'Thích'}</button><button type="button" onClick={() => openReply(viewerPost.id, comment.id, viewerMedia?.id)}>Trả lời</button>{owns(comment.authorId) && <ContentMenu id={`viewer-comment-${comment.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editDiscussion(viewerPost.id, comment.id, null, viewerMedia?.id)} onDelete={() => removeDiscussion(viewerPost.id, comment.id, null, viewerMedia?.id)} label="bình luận" />}<ReactionCount count={comment.likes?.length} label="Xem những người đã thích bình luận này" onClick={() => setLikesTarget({ ids: comment.likes, label: 'Những người đã thích bình luận này' })} /></div>
        {(comment.replies || []).map((reply) => {
          const replyAuthor = getAuthor(reply, providers);
          const isReplyLiked = (reply.likes || []).includes(user?.id);
          return <div className="post-image-dialog__comment-reply" key={reply.id}>{replyAuthor.id ? <Link to={ROUTES.TEACHER_PROFILE(replyAuthor.id)}><strong>{replyAuthor.name}</strong></Link> : <strong>{replyAuthor.name}</strong>}{reply.text && <p>{reply.text}</p>}{reply.media && (reply.media.type === 'video' ? <video className="discussion-image" src={reply.media.src} controls preload="metadata" /> : <ExpandableImage className="discussion-image" src={reply.media.src} alt={`Ảnh đính kèm từ ${replyAuthor.name}`} />)}<div className="post-image-dialog__comment-actions"><button type="button" className={isReplyLiked ? 'is-liked' : ''} onClick={() => toggleCommentLike(viewerPost.id, comment.id, reply.id, viewerMedia?.id)}>{isReplyLiked ? 'Đã thích' : 'Thích'}</button>{owns(reply.authorId) && <ContentMenu id={`viewer-reply-${reply.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editDiscussion(viewerPost.id, comment.id, reply.id, viewerMedia?.id)} onDelete={() => removeDiscussion(viewerPost.id, comment.id, reply.id, viewerMedia?.id)} label="phản hồi" />}<ReactionCount count={reply.likes?.length} label="Xem những người đã thích phản hồi này" onClick={() => setLikesTarget({ ids: reply.likes, label: 'Những người đã thích phản hồi này' })} /></div></div>;
        })}
        {isReplying && <form className="feed-reply-form post-image-dialog__reply-form" onSubmit={submitReply}><textarea autoFocus value={replyText} onChange={(event) => setReplyText(event.target.value)} onKeyDown={submitOnPlainEnter} placeholder={`Trả lời ${commentAuthor.name}...`} rows="2" /><ImageAttachment id={`viewer-reply-image-${comment.id}`} value={replyMedia} onChange={setReplyMedia} label="Tệp" /><button type="submit">Gửi</button></form>}
      </div>;
    })}</div><form className="feed-comment-form" onSubmit={(event) => submitComment(event, viewerPost.id, viewerMedia?.id)}><textarea autoFocus={isEditingViewerDiscussion || !replyTarget || replyTarget.postId !== viewerPost.id} value={commentDrafts[viewerDiscussionKey] || ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [viewerDiscussionKey]: event.target.value }))} onKeyDown={submitOnPlainEnter} placeholder={isEditingViewerDiscussion ? 'Chỉnh sửa bình luận...' : 'Viết bình luận...'} rows="1" />{!isEditingViewerDiscussion && <ImageAttachment id={`viewer-comment-image-${viewerDiscussionKey}`} value={commentMedia[viewerDiscussionKey] || null} onChange={(media) => setCommentMedia((current) => ({ ...current, [viewerDiscussionKey]: media }))} label="Tệp" />}{isEditingViewerDiscussion && <button type="button" onClick={() => cancelDiscussionEdit(viewerPost.id, viewerMedia?.id)}>Hủy</button>}<button type="submit" aria-label={isEditingViewerDiscussion ? 'Lưu bình luận' : 'Gửi bình luận'}>{isEditingViewerDiscussion ? 'Lưu' : <Send size={17} />}</button></form></> : null;

  return (
    <><section className="feed-page">
      <div className="edu-container feed-page__container">
        <div className="feed-page__layout">
          <aside className="feed-sidebar feed-sidebar--left" aria-label="Nội dung được tài trợ">
            <div className="feed-sidebar__label"><Sparkles size={14} /> GỢI Ý TỪ EDUMATCH</div>
            <article className="sponsored-card sponsored-card--teacher">
              <span className="sponsored-card__tag">Được tài trợ</span>
              <div className="sponsored-card__brand"><BookOpen size={18} /><span>THE OLD SCHOOL</span></div>
              <h2>Luyện IELTS cá nhân hoá</h2>
              <p>Lộ trình rõ ràng, lớp học linh hoạt cho mục tiêu IELTS của bạn.</p>
              <Link to={ROUTES.COURSE_DETAIL('course-english-foundation')}>Khám phá khóa học <ArrowRight size={15} /></Link>
            </article>
            <article className="sponsored-card sponsored-card--skills">
              <span className="sponsored-card__tag">Được tài trợ</span>
              <div className="sponsored-card__brand"><span className="sponsored-card__mark sponsored-card__mark--violet">S</span><span>SKILLUP ACADEMY</span></div>
              <h2>Học lập trình từ nền tảng</h2>
              <p>Lớp thực hành theo dự án, phù hợp cho người mới bắt đầu.</p>
              <Link to={`${ROUTES.HOME}#giao-vien`}>Tìm người hướng dẫn <ArrowRight size={15} /></Link>
            </article>
            <article className="sponsored-card sponsored-card--music">
              <span className="sponsored-card__tag">Được tài trợ</span>
              <div className="sponsored-card__brand"><span className="sponsored-card__mark sponsored-card__mark--rose">M</span><span>MELODY STUDIO</span></div>
              <h2>Piano cho người mới</h2>
              <p>Học theo nhịp riêng, từ những giai điệu đầu tiên.</p>
              <Link to={`${ROUTES.HOME}#giao-vien`}>Khám phá giáo viên <ArrowRight size={15} /></Link>
            </article>
            <article className="feed-sidebar__note"><BadgeCheck size={17} /><p>Quảng cáo luôn được gắn nhãn rõ ràng để bạn chủ động lựa chọn.</p></article>
          </aside>
          <main className="feed-page__main">
        <header className="feed-page__heading">
          <span><Newspaper size={17} /> BẢNG TIN EDUMATCH</span>
          <h1>{postId ? 'Bài viết' : 'Những chia sẻ mới nhất từ cộng đồng'}</h1>
          {postId && <p>Xem đầy đủ nội dung, lượt thích và bình luận của bài viết này.</p>}
        </header>
        {!postId && <div className="feed-tabs" role="tablist" aria-label="Loại nội dung Bảng Tin">
          <button type="button" role="tab" aria-selected={feedTab === 'providers'} className={feedTab === 'providers' ? 'is-active' : ''} onClick={() => { setFeedTab('providers'); setVisiblePostCount(POSTS_BATCH_SIZE); }}>Giáo viên & Trung tâm</button>
          <button type="button" role="tab" aria-selected={feedTab === 'students'} className={feedTab === 'students' ? 'is-active' : ''} onClick={() => { setFeedTab('students'); setVisiblePostCount(POSTS_BATCH_SIZE); }}>Chia sẻ từ học viên</button>
        </div>}
        {canPublishInCurrentFeed && <PostComposerTrigger avatar={user?.avatar} role={user?.role} placeholder={composerPlaceholder} onOpen={() => setIsPostComposerOpen(true)} />}
        <div className="feed-page__list">
          {visiblePosts.length ? renderedPosts.map((post) => {
            const author = getAuthor(post, providers);
            const likes = post.likes || [];
            const comments = post.comments || [];
            const isLiked = likes.includes(user?.id);
            const isEditingPostDiscussion = isEditingDiscussion(post.id);
            const postMediaItems = getMediaItems(post);
            const originalSharedPost = post.sharedPost ? getOriginalSharedPost(post, posts, (item) => getAuthor(item, providers)) : null;
            const sourceMediaItems = getMediaItems(originalSharedPost);
            const sharedMediaItems = originalSharedPost?.mediaId ? sourceMediaItems.filter((item) => item.id === originalSharedPost.mediaId) : sourceMediaItems;
            const shareIds = [...new Set(posts.filter((candidate) => candidate.sharedPost?.id === post.id && !candidate.sharedPost?.mediaId).map((candidate) => candidate.authorId || candidate.teacherId).filter(Boolean))];
            const shareCount = shareIds.length;
            return <article className="community-post" id={post.id} key={post.id}>
              <header className="community-post__header">
                {author.avatar ? <img src={author.avatar} alt={`Ảnh đại diện của ${author.name}`} /> : <DefaultRoleAvatar role={author.role} size={18} />}
                <div>{author.id ? <Link className="community-post__author" to={ROUTES.TEACHER_PROFILE(author.id)}>{author.name}</Link> : <strong>{author.name}</strong>}{author.role === 'center' && author.licenseVerificationStatus === 'verified' && <small className="post-verification-badge"><BadgeCheck size={12} /> Đã xác thực pháp lý</small>}<small>{formatRelativeTime(post.createdAt)}</small></div>
                {owns(post.authorId || post.teacherId) && <ContentMenu id={`post-${post.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editPost(post)} onDelete={() => removePost(post)} label="bài viết" />}
              </header>
              {editingPostId === post.id ? <form className="inline-post-editor" onSubmit={(event) => savePostEdit(event, post)}><textarea autoFocus value={editingPostText} onChange={(event) => setEditingPostText(event.target.value)} rows="3" placeholder="Viết nội dung bài đăng..." /><div><button type="button" onClick={cancelPostEdit}>Hủy</button><button type="submit">Lưu thay đổi</button></div></form> : <>{post.albumActivity && <p className="album-activity-line">{post.albumActivity.action === 'created' ? 'Đã tạo album' : 'Đã thêm ảnh/video vào album'} <Link to={`${ROUTES.TEACHER_PROFILE(post.authorId || post.teacherId || author.id)}?album=${encodeURIComponent(post.albumActivity.albumId)}`}>{post.albumActivity.albumName}</Link></p>}{post.text && <p className="community-post__text">{post.text}</p>}</>}
              {originalSharedPost && <div className="shared-post"><span>Đã chia sẻ <Link to={ROUTES.POST_DETAIL(originalSharedPost.id)}>bài viết gốc</Link> của</span>{originalSharedPost.author?.id ? <Link className="shared-post__author" to={ROUTES.TEACHER_PROFILE(originalSharedPost.author.id)}>{originalSharedPost.author.name}</Link> : <strong>{originalSharedPost.author?.name || 'Thành viên EduMatch'}</strong>}<p>{originalSharedPost.text || 'Bài viết gốc không có nội dung văn bản.'}</p>{sharedMediaItems.length > 0 && <div className={`community-post__media ${sharedMediaItems.length > 1 ? 'is-album' : ''}`}>{sharedMediaItems.map((item, index) => <button type="button" className="post-media-trigger" key={item.id || `${item.src}-${index}`} onClick={() => { const sourcePost = posts.find((entry) => entry.id === originalSharedPost.id) || { ...originalSharedPost, likes: [], comments: [] }; const sourceItems = getMediaItems(sourcePost); openImageViewer(sourcePost, originalSharedPost.author, sourceItems, Math.max(0, sourceItems.findIndex((sourceItem) => sourceItem.id === item.id))); }} aria-label={`Mở ${item.type === 'video' ? 'video' : 'ảnh'} chia sẻ ${index + 1}`}>{item.type === 'video' ? <video src={item.src} muted preload="metadata" /> : <img src={item.src} alt={`Ảnh chia sẻ ${index + 1}`} />}</button>)}</div>}</div>}
              {postMediaItems.length > 0 && <div className={`community-post__media ${postMediaItems.length > 1 ? 'is-album' : ''}`}>{postMediaItems.map((item, index) => <button type="button" className="post-media-trigger" key={item.id || `${item.src}-${index}`} onClick={() => openImageViewer(post, author, postMediaItems, index)} aria-label={`Mở ${item.type === 'video' ? 'video' : 'ảnh'} ${index + 1}`}>{item.type === 'video' ? <video src={item.src} muted preload="metadata" /> : <img src={item.src} alt={`Ảnh ${index + 1} do ${author.name} chia sẻ`} />}</button>)}</div>}
              <div className="community-post__summary"><div className="community-post__metrics">
                {likes.length ? <button type="button" onClick={() => setLikesTarget({ ids: likes, label: 'Những người đã thích bài viết này' })}>{likes.length} lượt thích</button> : <span>Hãy là người đầu tiên thích bài viết này</span>}
                {comments.length > 0 && <span>{comments.length} bình luận</span>}
                {shareCount > 0 && <button type="button" onClick={() => setLikesTarget({ ids: shareIds, kind: 'share', title: 'Lượt chia sẻ', label: 'Những người đã chia sẻ bài viết này', emptyText: 'Chưa có lượt chia sẻ.' })}>{shareCount} lượt chia sẻ</button>}
              </div></div>
              <div className="community-post__actions">
                <button type="button" className={isLiked ? 'is-liked' : ''} onClick={() => toggleLike(post.id)}><Heart size={17} fill={isLiked ? 'currentColor' : 'none'} /> {isLiked ? 'Đã thích' : 'Thích'}</button>
                <button type="button" onClick={() => document.getElementById(`comment-${post.id}`)?.focus()}><MessageCircle size={17} /> Bình luận</button>
                <button type="button" onClick={() => openShareDialog(post)}><Share2 size={17} /> Chia sẻ</button>
              </div>
              {comments.length > 0 && <div className="community-post__comments">
                {comments.map((comment) => {
                  const commentAuthor = getAuthor(comment, providers);
                  const isReplying = replyTarget?.postId === post.id && replyTarget?.commentId === comment.id;
                  const isCommentLiked = (comment.likes || []).includes(user?.id);
                  return <div className="feed-comment" key={comment.id}>
                    {commentAuthor.avatar ? <img src={commentAuthor.avatar} alt="" /> : <DefaultRoleAvatar role={commentAuthor.role} size={15} />}
                    <div className="feed-comment__body">
                      <div className="feed-comment__bubble">{commentAuthor.id ? <Link className="feed-comment__author" to={ROUTES.TEACHER_PROFILE(commentAuthor.id)}>{commentAuthor.name}</Link> : <strong>{commentAuthor.name}</strong>}{comment.text && <p>{comment.text}</p>}{comment.media && (comment.media.type === 'video' ? <video className="discussion-image" src={comment.media.src} controls preload="metadata" /> : <ExpandableImage className="discussion-image" src={comment.media.src} alt={`Ảnh đính kèm từ ${commentAuthor.name}`} />)}</div>
                      <div className="feed-comment__meta"><span>{formatRelativeTime(comment.createdAt)}</span><button type="button" className={isCommentLiked ? 'is-liked' : ''} onClick={() => toggleCommentLike(post.id, comment.id)}>{isCommentLiked ? 'Đã thích' : 'Thích'}</button><button type="button" onClick={() => openReply(post.id, comment.id)}>Trả lời</button>{owns(comment.authorId) && <ContentMenu id={`comment-${comment.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editDiscussion(post.id, comment.id)} onDelete={() => removeDiscussion(post.id, comment.id)} label="bình luận" />}<ReactionCount count={comment.likes?.length} label="Xem những người đã thích bình luận này" onClick={() => setLikesTarget({ ids: comment.likes, label: 'Những người đã thích bình luận này' })} /></div>
                      {(comment.replies || []).map((reply) => {
                        const replyAuthor = getAuthor(reply, providers);
                        const isReplyLiked = (reply.likes || []).includes(user?.id);
                        return <div className="feed-comment__reply" key={reply.id}>
                          {replyAuthor.avatar ? <img src={replyAuthor.avatar} alt="" /> : <DefaultRoleAvatar role={replyAuthor.role} size={14} />}
                          <div><div className="feed-comment__bubble">{replyAuthor.id ? <Link className="feed-comment__author" to={ROUTES.TEACHER_PROFILE(replyAuthor.id)}>{replyAuthor.name}</Link> : <strong>{replyAuthor.name}</strong>}{reply.text && <p>{reply.text}</p>}{reply.media && (reply.media.type === 'video' ? <video className="discussion-image" src={reply.media.src} controls preload="metadata" /> : <ExpandableImage className="discussion-image" src={reply.media.src} alt={`Ảnh đính kèm từ ${replyAuthor.name}`} />)}</div><div className="feed-comment__meta feed-comment__meta--reply"><span>{formatRelativeTime(reply.createdAt)}</span><button type="button" className={isReplyLiked ? 'is-liked' : ''} onClick={() => toggleCommentLike(post.id, comment.id, reply.id)}>{isReplyLiked ? 'Đã thích' : 'Thích'}</button>{owns(reply.authorId) && <ContentMenu id={`reply-${reply.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editDiscussion(post.id, comment.id, reply.id)} onDelete={() => removeDiscussion(post.id, comment.id, reply.id)} label="phản hồi" />}<ReactionCount count={reply.likes?.length} label="Xem những người đã thích phản hồi này" onClick={() => setLikesTarget({ ids: reply.likes, label: 'Những người đã thích phản hồi này' })} /></div></div>
                        </div>;
                      })}
                      {isReplying && <form className="feed-reply-form" onSubmit={submitReply}><CornerDownRight size={15} /><textarea autoFocus value={replyText} onChange={(event) => setReplyText(event.target.value)} onKeyDown={submitOnPlainEnter} placeholder={`Trả lời ${commentAuthor.name}...`} rows="1" /><ImageAttachment id={`reply-image-${post.id}-${comment.id}`} value={replyMedia} onChange={setReplyMedia} label="Tệp" /><button type="submit">Gửi</button></form>}
                    </div>
                  </div>;
                })}
              </div>}
              <form className="feed-comment-form" onSubmit={(event) => submitComment(event, post.id)}>
                <textarea id={`comment-${post.id}`} value={commentDrafts[`${post.id}:post`] || ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [`${post.id}:post`]: event.target.value }))} onKeyDown={submitOnPlainEnter} placeholder={isEditingPostDiscussion ? 'Chỉnh sửa bình luận...' : 'Viết bình luận...'} rows="1" />
                {!isEditingPostDiscussion && <ImageAttachment id={`comment-image-${post.id}`} value={commentMedia[`${post.id}:post`] || null} onChange={(media) => setCommentMedia((current) => ({ ...current, [`${post.id}:post`]: media }))} label="Tệp" />}
                {isEditingPostDiscussion && <button type="button" onClick={() => cancelDiscussionEdit(post.id)}>Hủy</button>}
                <button type="submit" aria-label={isEditingPostDiscussion ? 'Lưu bình luận' : 'Gửi bình luận'}>{isEditingPostDiscussion ? 'Lưu' : <Send size={17} />}</button>
              </form>
            </article>;
          }) : <div className="feed-page__empty"><ImageIcon size={28} /><h2>Chưa có bài đăng nào</h2><p>Các chia sẻ từ cộng đồng EduMatch sẽ xuất hiện tại đây.</p></div>}
          {!postId && renderedPosts.length < visiblePosts.length && <div ref={loadMoreRef} className="feed-page__load-more" aria-live="polite">Đang tải thêm bài viết…</div>}
        </div>
          </main>
          <aside className="feed-sidebar feed-sidebar--right" aria-label="Thông tin đối tác được tài trợ">
            <div className="feed-sidebar__label">ĐỐI TÁC NỔI BẬT</div>
            <article className="sponsored-card sponsored-card--center">
              <span className="sponsored-card__tag">Được tài trợ</span>
              <div className="sponsored-card__brand"><span className="sponsored-card__mark">E</span><span>TRUNG TÂM EDUCARE</span></div>
              <h2>Không gian học tập hiện đại</h2>
              <p>Các chương trình phát triển kỹ năng dành cho học viên ở nhiều độ tuổi.</p>
              <Link to={ROUTES.CENTER_SUPPORT}>Tìm hiểu trung tâm <ArrowRight size={15} /></Link>
            </article>
            <article className="sponsored-card sponsored-card--art">
              <span className="sponsored-card__tag">Được tài trợ</span>
              <div className="sponsored-card__brand"><span className="sponsored-card__mark sponsored-card__mark--amber">A</span><span>ART HOUSE</span></div>
              <h2>Mỹ thuật sáng tạo</h2>
              <p>Khơi mở tư duy hình ảnh qua các lớp học thực hành.</p>
              <Link to={`${ROUTES.HOME}#khoa-hoc`}>Xem lớp phù hợp <ArrowRight size={15} /></Link>
            </article>
            <article className="feed-sidebar__help"><strong>Bạn muốn quảng bá?</strong><p>Giáo viên và trung tâm có thể giới thiệu khóa học phù hợp tới đúng người học.</p><Link to={ROUTES.CENTER_SUPPORT}>Xem hỗ trợ quảng bá <ArrowRight size={14} /></Link></article>
          </aside>
        </div>
      </div>
    </section><PostComposerDialog open={isPostComposerOpen} onClose={() => setIsPostComposerOpen(false)} draft={postDraft} onDraftChange={setPostDraft} media={postMedia} onMediaChange={setPostMedia} onPublish={publishFeedPost} placeholder={composerPlaceholder} attachmentId="feed-post-media" /><LikesModal target={likesTarget} onClose={() => setLikesTarget(null)} /><PostImageDialog key={imageViewer ? `${imageViewer.post.id}-${imageViewer.activeIndex}` : 'closed'} viewer={imageViewer && { ...imageViewer, post: viewerPost, author: viewerAuthor, publishedAt: formatRelativeTime(viewerPost?.createdAt) }} interactionTarget={viewerMedia || null} onActiveIndexChange={(activeIndex) => setImageViewer((current) => current ? { ...current, activeIndex } : current)} onClose={() => setImageViewer(null)} discussion={imageViewerDiscussion} onLike={() => toggleLike(viewerPost.id, viewerMedia?.id)} onShowLikes={() => setLikesTarget({ ids: viewerInteractionTarget?.likes || [], label: viewerMedia ? 'Những người đã thích ảnh/video này' : 'Những người đã thích bài viết này' })} onShare={() => openShareDialog(viewerPost, viewerMedia)} shareCount={viewerPost ? [...new Set(posts.filter((candidate) => candidate.sharedPost?.id === viewerPost.id && (viewerMedia ? candidate.sharedPost?.mediaId === viewerMedia.id : !candidate.sharedPost?.mediaId)).map((candidate) => candidate.authorId || candidate.teacherId).filter(Boolean))].length : 0} onShowShares={() => setLikesTarget({ ids: [...new Set(posts.filter((candidate) => candidate.sharedPost?.id === viewerPost?.id && (viewerMedia ? candidate.sharedPost?.mediaId === viewerMedia.id : !candidate.sharedPost?.mediaId)).map((candidate) => candidate.authorId || candidate.teacherId).filter(Boolean))], kind: 'share', title: 'Lượt chia sẻ', label: viewerMedia ? 'Những người đã chia sẻ ảnh/video này' : 'Những người đã chia sẻ bài viết này', emptyText: 'Chưa có lượt chia sẻ.' })} isLiked={(viewerInteractionTarget?.likes || []).includes(user?.id)} ownerActions={viewerPost && owns(viewerPost.authorId || viewerPost.teacherId) ? <ContentMenu id={`viewer-post-${viewerPost.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => { setImageViewer(null); editPost(viewerPost); }} onDelete={() => { setImageViewer(null); removePost(viewerPost); }} label="bài viết" /> : null} /><Modal open={Boolean(shareTarget)} onClose={() => setShareTarget(null)} title="Chia sẻ bài viết" description="Thêm suy nghĩ của bạn trước khi chia sẻ lên trang cá nhân." size="sm"><form className="share-post-form" onSubmit={sharePost}><textarea autoFocus value={shareText} onChange={(event) => setShareText(event.target.value)} placeholder="Viết nội dung bạn muốn chia sẻ..." rows="4" /><div><button type="button" onClick={() => setShareTarget(null)}>Hủy</button><button type="submit"><Share2 size={16} /> Chia sẻ</button></div></form></Modal></>
  );
}

export default FeedPage;
