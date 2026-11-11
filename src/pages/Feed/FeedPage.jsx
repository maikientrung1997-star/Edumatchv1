import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, BookOpen, GraduationCap, Image as ImageIcon, Newspaper, School, Send, Share2, Sparkles, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createNotification, deletePost, getPostMediaItems, getPosts, getProviderAffinity, savePost, trackProviderAffinity, updatePost, updatePostMediaItem } from '@/features/learning/marketplace';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { useAuth } from '@/hooks/useAuth';
import { profileService } from '@/services/profileService';
import { courseError } from '@/services/courseService';
import { POST_COMMENTS_ANCHOR, ROUTES } from '@/constants/routes';
import { ImageAttachment } from '@/components/forms/ImageAttachment';
import { RoleAvatar, normalizeRole, resolveAvatarSource } from '@/components/common/DefaultRoleAvatar';
import { ContentMenu } from '@/components/feedback/ContentMenu';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { DiscussionMedia } from '@/components/feedback/ExpandableImage';
import { LikesModal } from '@/components/feedback/LikesModal';
import { Modal } from '@/components/feedback/Modal';
import { InlinePostEditor, PostComposerDialog, PostComposerTrigger } from '@/components/feedback/PostComposerDialog';
import { PostActions } from '@/components/feedback/PostActions';
import { PostCommentList } from '@/components/feedback/PostCommentList';
import { PostImageDialog } from '@/components/feedback/PostImageDialog';
import { ReactionCount } from '@/components/feedback/ReactionCount';
import { submitOnPlainEnter } from '@/utils/submitOnPlainEnter';
import { formatRelativeTime } from '@/utils/formatDate';
import { addMediaToProfileAlbum, readProfileAlbums, saveProfileAlbumsToStorage } from '@/utils/profileAlbums';
import './feed.css';

function SponsoredCards({ items = [], emptyMessage }) {
  if (!items.length) return <div className="sponsored-card"><p>{emptyMessage}</p></div>;

  return items.map(({ id, variant, brand, mark, markColor, title, description, href, linkLabel }) => (
    <article key={id} className={variant ? 'sponsored-card sponsored-card--' + variant : 'sponsored-card'}>
      <span className="sponsored-card__tag">Được tài trợ</span>
      <div className="sponsored-card__brand">
        {mark ? <span className={markColor ? 'sponsored-card__mark sponsored-card__mark--' + markColor : 'sponsored-card__mark'}>{mark}</span> : <BookOpen size={18} />}
        <span>{brand}</span>
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link to={href}>{linkLabel} <ArrowRight size={15} /></Link>
    </article>
  ));
}

const getAuthor = (item) => {
  const id = item.authorId || item.teacherId || '';
  const name = item.authorName || item.author || 'Thành viên EduMatch';
  return {
    id,
    name,
    role: normalizeRole(item.authorRole, name, id, 'teacher'),
    avatar: resolveAvatarSource(item.authorAvatar || '', id),
    licenseVerificationStatus: item.authorLicenseVerificationStatus || '',
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
        createdAt: sourcePost.createdAt || snapshot.createdAt || '',
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
const FEED_REFERENCE_TIME = Date.now();

export function FeedPage({ postId = null }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { user, isAuthenticated, updateUser } = useAuth();
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
  const [postAlbumId, setPostAlbumId] = useState('');
  const [isPostComposerOpen, setIsPostComposerOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingPostText, setEditingPostText] = useState('');
  const [editingPostMedia, setEditingPostMedia] = useState([]);
  const [visiblePostCount, setVisiblePostCount] = useState(POSTS_BATCH_SIZE);
  const feedTabsStartRef = useRef(null);
  const feedTabsRef = useRef(null);
  const loadMoreRef = useRef(null);
  const albumSaving = useRef(false);
  const ownProfileAlbums = useMemo(() => readProfileAlbums(user?.id, user?.photoAlbums), [user?.id, user?.photoAlbums]);
  const rankedPosts = useMemo(() => {
    const affinity = getProviderAffinity(user?.id);
    return posts.slice().sort((first, second) => {
      const firstAge = Math.max(0, FEED_REFERENCE_TIME - new Date(first.createdAt || 0).getTime());
      const secondAge = Math.max(0, FEED_REFERENCE_TIME - new Date(second.createdAt || 0).getTime());
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
      ? getAuthor(post).role === 'student'
      : getAuthor(post).role !== 'student');
  const renderedPosts = postId ? visiblePosts : visiblePosts.slice(0, visiblePostCount);
  const isProviderAccount = ['teacher', 'center'].includes(user?.role);
  const canPublishInCurrentFeed = !postId && (
    (feedTab === 'providers' && isProviderAccount)
    || (feedTab === 'students' && user?.role === 'student')
  );
  const composerPlaceholder = 'Hãy chia sẻ để học viên hiểu hơn về bạn';

  const switchFeedTab = (tab) => {
    if (tab === feedTab) return;
    setFeedTab(tab);
    setVisiblePostCount(POSTS_BATCH_SIZE);

    const start = feedTabsStartRef.current;
    const tabs = feedTabsRef.current;
    if (start && tabs && start.getBoundingClientRect().top < tabs.getBoundingClientRect().top) {
      start.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  };

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
    setEditingPostMedia(getMediaItems(post));
    setOpenContentMenu(null);
  };
  const cancelPostEdit = () => {
    setEditingPostId(null);
    setEditingPostText('');
    setEditingPostMedia([]);
  };
  const savePostEdit = (event, post) => {
    event.preventDefault();
    const text = editingPostText.trim();
    if (!text && !editingPostMedia.length) {
      toast.error('Bài viết cần có nội dung hoặc ảnh/video.');
      return;
    }
    const normalizedEditMedia = editingPostMedia.length === 1
      ? editingPostMedia.map((item) => ({ ...item, description: text }))
      : editingPostMedia;
    saveInteraction(post.id, (current) => ({ ...current, text, mediaItems: normalizedEditMedia, media: normalizedEditMedia[0] || null }));
    cancelPostEdit();
    toast.success('Đã cập nhật bài viết.');
  };
  const [confirmAction, setConfirmAction] = useState(null);
  const removePost = (post) => {
    if (!owns(post.authorId || post.teacherId)) return;
    setConfirmAction({
      title: 'Xóa bài viết',
      message: 'Bạn có chắc chắn muốn xóa bài viết này?',
      confirmText: 'Xóa bài viết',
      onConfirm: () => {
        setPosts(deletePost(post.id).slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)));
      },
    });
  };
  const openShareDialog = (post, mediaItem = null) => {
    if (!requireAuth()) return;
    setShareTarget({ post, mediaId: mediaItem?.id || null });
    setShareText('');
  };
  const openImageViewer = (post, author, mediaItems, activeIndex = 0) => {
    const authorId = post?.authorId || post?.teacherId || author?.id;
    const authorAlbums = authorId ? readProfileAlbums(authorId) : [];
    const allKnownAlbums = [...ownProfileAlbums, ...authorAlbums];
    const activeItem = mediaItems[activeIndex] || mediaItems[0];
    const matchedAlbum = allKnownAlbums.find((album) =>
      album.id === post?.albumId
      || (post?.albumName && album.name === post.albumName)
      || album.media?.some((m) =>
        (activeItem && ((m.id && activeItem.id && m.id === activeItem.id) || (m.storageKey && activeItem.storageKey && m.storageKey === activeItem.storageKey) || (m.src && activeItem.src && m.src === activeItem.src)))
        || mediaItems.some((item) =>
          (m.id && item.id && m.id === item.id)
          || (m.storageKey && item.storageKey && m.storageKey === item.storageKey)
          || (m.src && item.src && m.src === item.src)
        )
      )
    );
    setImageViewer({
      post,
      author,
      mediaItems,
      activeIndex,
      albumId: matchedAlbum?.id || post?.albumId || null,
      albumName: matchedAlbum?.name || post?.albumName || '',
    });
  };
  const persistAlbums = async (albums) => {
    if (albumSaving.current) return false;
    albumSaving.current = true;
    try {
      const { user: savedUser } = await profileService.saveAlbums(albums);
      const savedAlbums = saveProfileAlbumsToStorage(user.id, savedUser.photoAlbums);
      updateUser({ photoAlbums: savedAlbums });
      return true;
    } catch (error) {
      toast.error(courseError(error, 'Không thể lưu album. Vui lòng thử lại.'));
      return false;
    } finally {
      albumSaving.current = false;
    }
  };
  const createFeedAlbum = async ({ name, description = '' }) => {
    if (!user?.id) return null;
    const album = {
      id: `profile-album-${Date.now()}`,
      name,
      description,
      media: [],
      createdAt: new Date().toISOString(),
    };
    return await persistAlbums([...ownProfileAlbums, album]) ? album : null;
  };
  const publishFeedPost = async (event) => {
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

    const selectedAlbum = (postAlbumId && postMedia.length && ownProfileAlbums.find((album) => album.id === postAlbumId)) || null;
    const normalizedPostMedia = postMedia.length === 1
      ? postMedia.map((item) => ({ ...item, description: text }))
      : postMedia;
    const post = {
      id: `post-${Date.now()}`,
      teacherId: user.id,
      authorId: user.id,
      authorName: user.name || 'Thành viên EduMatch',
      authorRole: user.role,
      authorAvatar: user.avatar || '',
      authorLicenseVerificationStatus: user.licenseVerificationStatus || '',
      text,
      ...(normalizedPostMedia.length ? { mediaItems: normalizedPostMedia } : {}),
      ...(selectedAlbum ? { albumId: selectedAlbum.id, albumName: selectedAlbum.name } : {}),
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
    };
    if (selectedAlbum && !await persistAlbums(addMediaToProfileAlbum(ownProfileAlbums, selectedAlbum.id, normalizedPostMedia))) return;
    if (!savePost(post)) {
      toast.error('Không thể lưu ảnh vào bộ nhớ trình duyệt. Vui lòng thử đăng ít ảnh hơn hoặc tải lại trang.');
      return;
    }
    setPosts(getPosts().slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)));
    setPostDraft('');
    setPostMedia([]);
    setPostAlbumId('');
    setIsPostComposerOpen(false);
    setVisiblePostCount(POSTS_BATCH_SIZE);
    toast.success('Bài viết đã được đăng lên Bảng Tin.');
  };
  const sharePost = (event) => {
    event.preventDefault();
    if (!shareTarget || !requireAuth()) return;
    const { post, mediaId } = shareTarget;
    const originalPost = getOriginalSharedPost(post, posts, getAuthor);
    const source = originalPost?.author || getAuthor(post);
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
        createdAt: originalPost?.createdAt || post.createdAt || new Date().toISOString(),
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
    setCommentMedia((current) => ({ ...current, [draftKey]: target.media || null }));
    requestAnimationFrame(() => {
      const dialogInput = document.querySelector('.post-image-comments-sheet .feed-comment-form textarea, .post-image-dialog .feed-comment-form textarea');
      (dialogInput || document.getElementById(`comment-${postId}`))?.focus();
    });
  };
  const removeDiscussion = (postId, commentId, replyId = null, mediaId = null) => {
    const post = posts.find((item) => item.id === postId);
    const interactionTarget = getInteractionTarget(post, mediaId);
    const comment = interactionTarget?.comments?.find((item) => item.id === commentId);
    const target = replyId ? comment?.replies?.find((item) => item.id === replyId) : comment;
    if (!target || !owns(target.authorId)) return;
    setConfirmAction({
      title: replyId ? 'Xóa phản hồi' : 'Xóa bình luận',
      message: replyId ? 'Bạn có chắc chắn muốn xóa phản hồi này?' : 'Bạn có chắc chắn muốn xóa bình luận này?',
      confirmText: 'Xóa',
      onConfirm: () => {
        saveTargetInteraction(postId, mediaId, (current) => ({
          ...current,
          commentsUpdated: true,
          comments: replyId
            ? (current.comments || []).map((item) => item.id === commentId ? { ...item, replies: (item.replies || []).filter((reply) => reply.id !== replyId) } : item)
            : (current.comments || []).filter((item) => item.id !== commentId),
        }));
      },
    });
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
      if (!text && !media) {
        toast.error('Bình luận không được để trống.');
        return;
      }
      saveTargetInteraction(postId, mediaId, (current) => modifyDiscussion(
        { ...current, commentsUpdated: true },
        editingDiscussion.commentId,
        editingDiscussion.replyId,
        (item) => ({ ...item, text, media }),
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
  const viewerAuthor = imageViewer?.author || (viewerPost ? getAuthor(viewerPost) : null);
  const viewerMediaItems = getMediaItems(viewerPost);
  const viewerMedia = viewerMediaItems.length > 1 ? viewerMediaItems[imageViewer?.activeIndex || 0] : null;
  const viewerInteractionTarget = viewerMedia || viewerPost;
  const viewerDiscussionKey = viewerMedia ? `${viewerPost.id}:${viewerMedia.id}` : `${viewerPost?.id}:post`;
  const isEditingViewerDiscussion = isEditingDiscussion(viewerPost?.id, viewerMedia?.id);
  const feedViewerActiveIndex = imageViewer?.activeIndex || 0;
  const feedViewerMedia = viewerMediaItems.length > 1 ? viewerMediaItems[feedViewerActiveIndex] : viewerMediaItems[0];
  const feedAuthorId = viewerPost?.authorId || viewerPost?.teacherId || viewerAuthor?.id;
  const feedAuthorAlbums = feedAuthorId ? readProfileAlbums(feedAuthorId) : [];
  const feedKnownAlbums = [...ownProfileAlbums, ...feedAuthorAlbums];
  const isGenericFeedTab = (name) => ['Tất cả', 'Ảnh', 'Video', 'Album', 'all-media', 'photos', 'videos', 'albums'].includes(String(name || '').trim());
  const feedViewerAlbum = feedKnownAlbums.find((album) =>
    album.id === imageViewer?.albumId
    || (imageViewer?.albumName && album.name === imageViewer.albumName)
    || album.id === viewerPost?.albumId
    || (viewerPost?.albumName && album.name === viewerPost.albumName)
    || (feedViewerMedia && album.media?.some((m) =>
      (m.id && feedViewerMedia.id && m.id === feedViewerMedia.id)
      || (m.storageKey && feedViewerMedia.storageKey && m.storageKey === feedViewerMedia.storageKey)
      || (m.src && feedViewerMedia.src && m.src === feedViewerMedia.src)
    ))
  );
  const rawFeedAlbumName = imageViewer?.albumName || feedViewerAlbum?.name || viewerPost?.albumName || '';
  const feedAlbumName = isGenericFeedTab(rawFeedAlbumName) ? '' : rawFeedAlbumName;
  const getViewerInteractions = (index) => {
    const media = viewerMediaItems.length > 1 ? viewerMediaItems[index] : null;
    const target = media || viewerPost;
    const likes = target?.likes || [];
    const shareIds = [...new Set(posts
      .filter((candidate) => candidate.sharedPost?.id === viewerPost.id
        && (media ? candidate.sharedPost?.mediaId === media.id : !candidate.sharedPost?.mediaId))
      .map((candidate) => candidate.authorId || candidate.teacherId).filter(Boolean))];

    return {
      likes,
      shareIds,
      commentCount: target?.comments?.length || 0,
      isMedia: Boolean(media),
      isLiked: likes.includes(user?.id),
      like: () => toggleLike(viewerPost.id, media?.id),
      share: () => openShareDialog(viewerPost, media),
    };
  };
  const imageViewerDiscussion = viewerInteractionTarget ? <><div className="post-image-dialog__comments">{viewerInteractionTarget.comments?.length ? <PostCommentList items={viewerInteractionTarget.comments} renderItem={(comment) => {
      const commentAuthor = getAuthor(comment);
      const isReplying = replyTarget?.postId === viewerPost.id && replyTarget?.commentId === comment.id && replyTarget?.mediaId === viewerMedia?.id;
      const isCommentLiked = (comment.likes || []).includes(user?.id);
      return <div className="post-image-dialog__comment" key={comment.id}>
        <div className="discussion-item__head">
          {commentAuthor.id ? <Link to={ROUTES.TEACHER_PROFILE(commentAuthor.id)}><strong>{commentAuthor.name}</strong></Link> : <strong>{commentAuthor.name}</strong>}
          {owns(comment.authorId) && <ContentMenu id={`viewer-comment-${comment.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editDiscussion(viewerPost.id, comment.id, null, viewerMedia?.id)} onDelete={() => removeDiscussion(viewerPost.id, comment.id, null, viewerMedia?.id)} label="bình luận" />}
        </div>
        {comment.text && <p>{comment.text}</p>}
        <DiscussionMedia media={comment.media} className="discussion-image" alt={`Ảnh đính kèm từ ${commentAuthor.name}`} expandable />
        <div className="post-image-dialog__comment-actions"><button type="button" className={isCommentLiked ? 'is-liked' : ''} onClick={() => toggleCommentLike(viewerPost.id, comment.id, null, viewerMedia?.id)}>{isCommentLiked ? 'Đã thích' : 'Thích'}</button><button type="button" onClick={() => openReply(viewerPost.id, comment.id, viewerMedia?.id)}>Trả lời</button><ReactionCount count={comment.likes?.length} label="Xem những người đã thích bình luận này" onClick={() => setLikesTarget({ ids: comment.likes, label: 'Những người đã thích bình luận này' })} /></div>
        <PostCommentList items={comment.replies || []} moreLabel="Xem thêm phản hồi" renderItem={(reply) => {
          const replyAuthor = getAuthor(reply);
          const isReplyLiked = (reply.likes || []).includes(user?.id);
          return <div className="post-image-dialog__comment-reply" key={reply.id}><div className="discussion-item__head">
              {replyAuthor.id ? <Link to={ROUTES.TEACHER_PROFILE(replyAuthor.id)}><strong>{replyAuthor.name}</strong></Link> : <strong>{replyAuthor.name}</strong>}
              {owns(reply.authorId) && <ContentMenu id={`viewer-reply-${reply.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editDiscussion(viewerPost.id, comment.id, reply.id, viewerMedia?.id)} onDelete={() => removeDiscussion(viewerPost.id, comment.id, reply.id, viewerMedia?.id)} label="phản hồi" />}
            </div>{reply.text && <p>{reply.text}</p>}<DiscussionMedia media={reply.media} className="discussion-image" alt={`Ảnh đính kèm từ ${replyAuthor.name}`} expandable /><div className="post-image-dialog__comment-actions"><button type="button" className={isReplyLiked ? 'is-liked' : ''} onClick={() => toggleCommentLike(viewerPost.id, comment.id, reply.id, viewerMedia?.id)}>{isReplyLiked ? 'Đã thích' : 'Thích'}</button><ReactionCount count={reply.likes?.length} label="Xem những người đã thích phản hồi này" onClick={() => setLikesTarget({ ids: reply.likes, label: 'Những người đã thích phản hồi này' })} /></div></div>;
        }} />
        {isReplying && <form className="feed-reply-form post-image-dialog__reply-form" onSubmit={submitReply}><textarea autoFocus value={replyText} onChange={(event) => setReplyText(event.target.value)} onKeyDown={submitOnPlainEnter} placeholder={`Trả lời ${commentAuthor.name}...`} rows="2" /><ImageAttachment id={`viewer-reply-image-${comment.id}`} value={replyMedia} onChange={setReplyMedia} /><button type="submit" aria-label="Gửi phản hồi"><Send size={17} /></button></form>}
      </div>;
    }} /> : null}</div><form className="feed-comment-form" onSubmit={(event) => submitComment(event, viewerPost.id, viewerMedia?.id)}><textarea autoFocus={isEditingViewerDiscussion} value={commentDrafts[viewerDiscussionKey] || ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [viewerDiscussionKey]: event.target.value }))} onKeyDown={submitOnPlainEnter} aria-label={isEditingViewerDiscussion ? 'Chỉnh sửa bình luận' : 'Viết bình luận'} placeholder={isEditingViewerDiscussion ? undefined : 'Viết bình luận...'} rows="1" /><ImageAttachment id={`viewer-comment-image-${viewerDiscussionKey}`} value={commentMedia[viewerDiscussionKey] || null} onChange={(media) => setCommentMedia((current) => ({ ...current, [viewerDiscussionKey]: media }))} />{isEditingViewerDiscussion && <button type="button" onClick={() => cancelDiscussionEdit(viewerPost.id, viewerMedia?.id)}>Hủy</button>}<button type="submit" aria-label={isEditingViewerDiscussion ? 'Lưu bình luận' : 'Gửi bình luận'}>{isEditingViewerDiscussion ? 'Lưu' : <Send size={17} />}</button></form></> : null;

  const detailPost = postId ? renderedPosts[0] : null;
  const detailAuthor = detailPost ? getAuthor(detailPost) : null;
  const isEditingPostComment = detailPost && isEditingDiscussion(postId);
  const postDiscussionKey = discussionKey(postId);
  const closePostDetail = () => {
    if (state?.fromPostList) navigate(-1);
    else navigate(ROUTES.FEED, { replace: true });
  };

  const postList = (
    <div className="feed-page__list">
      {visiblePosts.length ? renderedPosts.map((post) => {
        const author = getAuthor(post);
        const likes = post.likes || [];
        const comments = post.comments || [];
        const postCommentsUrl = ROUTES.POST_COMMENTS(post.id);
        const isLiked = likes.includes(user?.id);
        const postMediaItems = getMediaItems(post);
        const originalSharedPost = post.sharedPost ? getOriginalSharedPost(post, posts, getAuthor) : null;
        const sourceMediaItems = getMediaItems(originalSharedPost);
        const sharedMediaItems = originalSharedPost?.mediaId ? sourceMediaItems.filter((item) => item.id === originalSharedPost.mediaId) : sourceMediaItems;
        const shareIds = [...new Set(posts.filter((candidate) => candidate.sharedPost?.id === post.id && !candidate.sharedPost?.mediaId).map((candidate) => candidate.authorId || candidate.teacherId).filter(Boolean))];
        const shareCount = shareIds.length;
        return <article className="community-post" id={post.id} key={post.id}>
          <header className="community-post__header">
            <RoleAvatar src={author.avatar} userId={author.id} name={author.name} role={author.role} size={18} alt={`Ảnh đại diện của ${author.name}`} />
            <div>{author.id ? <Link className="community-post__author" to={ROUTES.TEACHER_PROFILE(author.id)}>{author.name}</Link> : <strong>{author.name}</strong>}<Link className="community-post__time" to={ROUTES.POST_DETAIL(post.id)} state={{ fromPostList: true }}><small>{formatRelativeTime(post.createdAt)}</small></Link></div>
            {owns(post.authorId || post.teacherId) && <ContentMenu id={`post-${post.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editPost(post)} onDelete={() => removePost(post)} label="bài viết" />}
          </header>
          {editingPostId === post.id ? <InlinePostEditor draft={editingPostText} onDraftChange={setEditingPostText} media={editingPostMedia} onMediaChange={setEditingPostMedia} onCancel={cancelPostEdit} onSave={(event) => savePostEdit(event, post)} attachmentId={`feed-edit-post-media-${post.id}`} /> : post.text && <p className="community-post__text">{post.text}</p>}
          {originalSharedPost && <div className="shared-post"><div className="shared-post__header">{originalSharedPost.author?.id ? <Link className="shared-post__author" to={ROUTES.TEACHER_PROFILE(originalSharedPost.author.id)}>{originalSharedPost.author.name}</Link> : <strong>{originalSharedPost.author?.name || 'Thành viên EduMatch'}</strong>}{originalSharedPost.id ? <Link className="shared-post__time" to={ROUTES.POST_DETAIL(originalSharedPost.id)} state={{ fromPostList: true }}><small>{formatRelativeTime(originalSharedPost.createdAt)}</small></Link> : <small>{formatRelativeTime(originalSharedPost.createdAt)}</small>}</div><p>{originalSharedPost.text || 'Bài viết gốc không có nội dung văn bản.'}</p>{sharedMediaItems.length > 0 && <div className={`community-post__media ${sharedMediaItems.length > 1 ? 'is-album' : ''}`}>{sharedMediaItems.map((item, index) => item.type === 'video' ? <div className="post-media-trigger post-media-trigger--video" key={item.id || `${item.src}-${index}`}><video src={item.src} controls playsInline preload="metadata" /></div> : <button type="button" className="post-media-trigger" key={item.id || `${item.src}-${index}`} onClick={() => { const sourcePost = posts.find((entry) => entry.id === originalSharedPost.id) || { ...originalSharedPost, likes: [], comments: [] }; const sourceItems = getMediaItems(sourcePost); openImageViewer(sourcePost, originalSharedPost.author, sourceItems, Math.max(0, sourceItems.findIndex((sourceItem) => sourceItem.id === item.id))); }} aria-label={`Mở ảnh chia sẻ ${index + 1}`}><img src={item.src} alt={`Ảnh chia sẻ ${index + 1}`} /></button>)}</div>}</div>}
          {editingPostId !== post.id && postMediaItems.length > 0 && <div className={`community-post__media ${postMediaItems.length > 1 ? 'is-album' : ''}`}>{postMediaItems.map((item, index) => item.type === 'video' ? <div className="post-media-trigger post-media-trigger--video" key={item.id || `${item.src}-${index}`}><video src={item.src} controls playsInline preload="metadata" /></div> : <button type="button" className="post-media-trigger" key={item.id || `${item.src}-${index}`} onClick={() => openImageViewer(post, author, postMediaItems, index)} aria-label={`Mở ảnh ${index + 1}`}><img src={item.src} alt={`Ảnh ${index + 1} do ${author.name} chia sẻ`} /></button>)}</div>}
          <PostActions
            isLiked={isLiked}
            likeCount={likes.length}
            commentCount={comments.length}
            shareCount={shareCount}
            onLike={() => toggleLike(post.id)}
            onShowLikes={() => setLikesTarget({ ids: likes, label: 'Những người đã thích bài viết này' })}
            commentsTo={postId ? undefined : postCommentsUrl}
            onComment={() => document.getElementById(POST_COMMENTS_ANCHOR)?.scrollIntoView({ block: 'start' })}
            onShare={() => openShareDialog(post)}
            onShowShares={() => setLikesTarget({ ids: shareIds, kind: 'share', title: 'Lượt chia sẻ', label: 'Những người đã chia sẻ bài viết này', emptyText: 'Chưa có lượt chia sẻ.' })}
          />
          {postId && <section id={POST_COMMENTS_ANCHOR} className="community-post__discussion" aria-label="Bình luận">
            {comments.length ? <div className="community-post__comments">
              <PostCommentList items={comments} renderItem={(comment) => {
                const commentAuthor = getAuthor(comment);
                const isReplying = replyTarget?.postId === post.id && replyTarget?.commentId === comment.id;
                const isCommentLiked = (comment.likes || []).includes(user?.id);
                return <div className="feed-comment" key={comment.id}>
                  <RoleAvatar src={commentAuthor.avatar} userId={commentAuthor.id} name={commentAuthor.name} role={commentAuthor.role} size={15} alt="" />
                  <div className="feed-comment__body">
                    <div className="feed-comment__bubble"><div className="discussion-item__head">
                        {commentAuthor.id ? <Link className="feed-comment__author" to={ROUTES.TEACHER_PROFILE(commentAuthor.id)}>{commentAuthor.name}</Link> : <strong>{commentAuthor.name}</strong>}
                        {owns(comment.authorId) && <ContentMenu id={`comment-${comment.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editDiscussion(post.id, comment.id)} onDelete={() => removeDiscussion(post.id, comment.id)} label="bình luận" />}
                      </div>{comment.text && <p>{comment.text}</p>}<DiscussionMedia media={comment.media} className="discussion-image" alt={`Ảnh đính kèm từ ${commentAuthor.name}`} expandable /></div>
                    <div className="feed-comment__meta"><span>{formatRelativeTime(comment.createdAt)}</span><button type="button" className={isCommentLiked ? 'is-liked' : ''} onClick={() => toggleCommentLike(post.id, comment.id)}>{isCommentLiked ? 'Đã thích' : 'Thích'}</button><button type="button" onClick={() => openReply(post.id, comment.id)}>Trả lời</button><ReactionCount count={comment.likes?.length} label="Xem những người đã thích bình luận này" onClick={() => setLikesTarget({ ids: comment.likes, label: 'Những người đã thích bình luận này' })} /></div>
                    <PostCommentList items={comment.replies || []} moreLabel="Xem thêm phản hồi" renderItem={(reply) => {
                      const replyAuthor = getAuthor(reply);
                      const isReplyLiked = (reply.likes || []).includes(user?.id);
                      return <div className="feed-comment__reply" key={reply.id}>
                        <RoleAvatar src={replyAuthor.avatar} userId={replyAuthor.id} name={replyAuthor.name} role={replyAuthor.role} size={14} alt="" />
                        <div className="feed-comment__body"><div className="feed-comment__bubble"><div className="discussion-item__head">
                            {replyAuthor.id ? <Link className="feed-comment__author" to={ROUTES.TEACHER_PROFILE(replyAuthor.id)}>{replyAuthor.name}</Link> : <strong>{replyAuthor.name}</strong>}
                            {owns(reply.authorId) && <ContentMenu id={`reply-${reply.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editDiscussion(post.id, comment.id, reply.id)} onDelete={() => removeDiscussion(post.id, comment.id, reply.id)} label="phản hồi" />}
                          </div>{reply.text && <p>{reply.text}</p>}<DiscussionMedia media={reply.media} className="discussion-image" alt={`Ảnh đính kèm từ ${replyAuthor.name}`} expandable /></div><div className="feed-comment__meta feed-comment__meta--reply"><span>{formatRelativeTime(reply.createdAt)}</span><button type="button" className={isReplyLiked ? 'is-liked' : ''} onClick={() => toggleCommentLike(post.id, comment.id, reply.id)}>{isReplyLiked ? 'Đã thích' : 'Thích'}</button><ReactionCount count={reply.likes?.length} label="Xem những người đã thích phản hồi này" onClick={() => setLikesTarget({ ids: reply.likes, label: 'Những người đã thích phản hồi này' })} /></div></div>
                      </div>;
                    }} />
                    {isReplying && <form className="feed-reply-form" onSubmit={submitReply}><textarea autoFocus value={replyText} onChange={(event) => setReplyText(event.target.value)} onKeyDown={submitOnPlainEnter} placeholder={`Trả lời ${commentAuthor.name}...`} rows="1" /><ImageAttachment id={`reply-image-${post.id}-${comment.id}`} value={replyMedia} onChange={setReplyMedia} /><button type="submit" aria-label="Gửi phản hồi"><Send size={17} /></button></form>}
                  </div>
                </div>;
              }} />
            </div> : null}
          </section>}
        </article>;
      }) : postId ? <p className="post-detail-panel__empty">Bài viết không còn khả dụng.</p> : <div className="feed-page__empty"><ImageIcon size={28} /><h2>Chưa có bài đăng nào</h2><p>Các chia sẻ từ cộng đồng EduMatch sẽ xuất hiện tại đây.</p></div>}
      {!postId && renderedPosts.length < visiblePosts.length && <div ref={loadMoreRef} className="feed-page__load-more" aria-live="polite">Đang tải thêm bài viết…</div>}
    </div>
  );

  return (
    <>
    {postId ? (
      <section className="post-detail-page" aria-labelledby="post-detail-title">
        <div className="post-detail-panel">
          <header className="post-detail-panel__header">
            <h1 id="post-detail-title">{detailAuthor ? `Bài viết của ${detailAuthor.name}` : 'Bài viết'}</h1>
            <button type="button" className="post-detail-panel__close" onClick={closePostDetail} aria-label="Quay lại">
              <ArrowLeft className="post-detail-panel__back-icon" size={21} aria-hidden="true" />
              <X className="post-detail-panel__close-icon" size={21} aria-hidden="true" />
            </button>
          </header>
          <div className="post-detail-panel__scroll" tabIndex={0} role="region" aria-label="Nội dung bài viết và bình luận">
            {postList}
          </div>
          {detailPost && <footer className="post-detail-panel__composer">
            <form className="feed-comment-form" onSubmit={(event) => submitComment(event, postId)}>
              <textarea id={`comment-${postId}`} aria-label={isEditingPostComment ? 'Chỉnh sửa bình luận' : 'Viết bình luận'} value={commentDrafts[postDiscussionKey] || ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [postDiscussionKey]: event.target.value }))} onKeyDown={submitOnPlainEnter} placeholder={isEditingPostComment ? undefined : 'Viết bình luận...'} rows="1" />
              <ImageAttachment id={`comment-image-${postId}`} value={commentMedia[postDiscussionKey] || null} onChange={(media) => setCommentMedia((current) => ({ ...current, [postDiscussionKey]: media }))} />
              {isEditingPostComment && <button type="button" onClick={() => cancelDiscussionEdit(postId)}>Hủy</button>}
              <button type="submit" aria-label={isEditingPostComment ? 'Lưu bình luận' : 'Gửi bình luận'}>{isEditingPostComment ? 'Lưu' : <Send size={17} />}</button>
            </form>
          </footer>}
        </div>
      </section>
    ) : <section className="feed-page">
      <div className="edu-container feed-page__container">
        <div className="feed-page__layout">
          <aside className="feed-sidebar feed-sidebar--left" aria-label="Nội dung được tài trợ">
            <div className="feed-sidebar__label"><Sparkles size={14} /> GỢI Ý TỪ EDUMATCH</div>
            <SponsoredCards emptyMessage="Chưa có nội dung tài trợ." />
            <article className="feed-sidebar__note"><BadgeCheck size={17} /><p>Quảng cáo luôn được gắn nhãn rõ ràng để bạn chủ động lựa chọn.</p></article>
          </aside>
          <main className="feed-page__main">
            <header className="feed-page__heading">
              <span><Newspaper size={17} /> BẢNG TIN EDUMATCH</span>
              <h1>Những chia sẻ mới nhất từ cộng đồng</h1>
            </header>
            <div className="feed-tabs__start" ref={feedTabsStartRef} aria-hidden="true" />
            <div className="feed-tabs" ref={feedTabsRef}>
              <div className="feed-tabs__track" role="tablist" aria-label="Loại nội dung Bảng Tin">
                <button type="button" role="tab" aria-selected={feedTab === 'providers'} onClick={() => switchFeedTab('providers')}>
                  <School size={17} aria-hidden="true" />
                  <span>Giáo viên & Trung tâm</span>
                </button>
                <button type="button" role="tab" aria-selected={feedTab === 'students'} onClick={() => switchFeedTab('students')}>
                  <GraduationCap size={17} aria-hidden="true" />
                  <span>Chia sẻ từ học viên</span>
                </button>
              </div>
            </div>
            {canPublishInCurrentFeed && <PostComposerTrigger media={postMedia} onMediaChange={setPostMedia} avatar={user?.avatar} role={user?.role} placeholder={composerPlaceholder} onOpen={() => setIsPostComposerOpen(true)} />}
            {postList}
          </main>
          <aside className="feed-sidebar feed-sidebar--right" aria-label="Thông tin đối tác được tài trợ">
            <div className="feed-sidebar__label">ĐỐI TÁC NỔI BẬT</div>
            <SponsoredCards emptyMessage="Chưa có đối tác nổi bật." />
            <article className="feed-sidebar__help"><strong>Bạn muốn quảng bá?</strong><p>Giáo viên và trung tâm có thể giới thiệu khóa học phù hợp tới đúng người học.</p><Link to={ROUTES.CENTER_SUPPORT}>Xem hỗ trợ quảng bá <ArrowRight size={14} /></Link></article>
          </aside>
        </div>
      </div>
    </section>}
    <PostComposerDialog
      open={isPostComposerOpen}
      onClose={() => setIsPostComposerOpen(false)}
      draft={postDraft}
      onDraftChange={setPostDraft}
      media={postMedia}
      onMediaChange={setPostMedia}
      albums={ownProfileAlbums}
      selectedAlbumId={postAlbumId}
      onSelectedAlbumChange={setPostAlbumId}
      onCreateAlbum={createFeedAlbum}
      onPublish={publishFeedPost}
      placeholder={composerPlaceholder}
      attachmentId="feed-post-media"
    />
    <LikesModal target={likesTarget} onClose={() => setLikesTarget(null)} />
    <PostImageDialog
      viewer={imageViewer && {
        ...imageViewer,
        mediaItems: viewerMediaItems,
        post: viewerPost,
        author: viewerAuthor,
        publishedAt: formatRelativeTime(viewerPost?.createdAt),
        albumName: feedAlbumName,
      }}
      getInteractions={getViewerInteractions}
      onActiveIndexChange={(activeIndex) => setImageViewer((current) => current ? { ...current, activeIndex } : current)}
      onClose={() => { setOpenContentMenu(null); setImageViewer(null); }}
      discussion={imageViewerDiscussion}
      onShowLikes={(ids, kind) => setLikesTarget({ ids, label: `Những người đã thích ${kind} này` })}
      onShowShares={(ids, kind) => setLikesTarget({ ids, kind: 'share', title: 'Lượt chia sẻ', label: `Những người đã chia sẻ ${kind} này` })}
      renderOwnerActions={viewerPost && owns(viewerPost.authorId || viewerPost.teacherId) ? (index) => <ContentMenu id={`viewer-post-${viewerPost.id}-${index}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => { setImageViewer(null); editPost(viewerPost); }} onDelete={() => { setImageViewer(null); removePost(viewerPost); }} label="bài viết" /> : null}
    />
    <Modal open={Boolean(shareTarget)} onClose={() => setShareTarget(null)} title="Chia sẻ bài viết" description="Thêm suy nghĩ của bạn trước khi chia sẻ lên trang cá nhân." size="sm"><form className="share-post-form" onSubmit={sharePost}><textarea autoFocus value={shareText} onChange={(event) => setShareText(event.target.value)} placeholder="Viết nội dung bạn muốn chia sẻ..." rows="4" /><div><button type="button" onClick={() => setShareTarget(null)}>Hủy</button><button type="submit"><Share2 size={16} /> Chia sẻ</button></div></form></Modal>
    <ConfirmDialog
      open={Boolean(confirmAction)}
      title={confirmAction?.title}
      message={confirmAction?.message}
      confirmText={confirmAction?.confirmText || 'Xóa'}
      cancelText="Hủy"
      onCancel={() => setConfirmAction(null)}
      onConfirm={() => {
        confirmAction?.onConfirm?.();
        setConfirmAction(null);
      }}
    />
    </>
  );
}

export default FeedPage;
