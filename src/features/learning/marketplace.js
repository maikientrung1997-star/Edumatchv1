import { STORAGE_KEYS } from '@/constants/storageKeys';
import { storage } from '@/utils/storage';
import { getMediaUrl, hydrateMedia, saveImageMedia } from '@/utils/mediaLibrary';

const read = (key, fallback) => storage.get(key, fallback);
const write = (key, value) => storage.set(key, value);
const isLegacySamplePost = (id) => /^sample-full-center-post-\d+$/.test(String(id));
const notifyPostsChange = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('edumatch:posts-updated'));
};
const legacyImageMigrations = new Set();
const isLegacyStoredImage = (media) => media?.type === 'image' && !media.storageKey && String(media.src || '').startsWith('data:image/');
const dataUrlToBlob = async (source) => (await fetch(source)).blob();

// Older posts kept whole Base64 images in localStorage. Move those files to
// IndexedDB in the background so a previously used account can publish again
// without first deleting its post history.
const queueLegacyPostImageMigration = (posts) => {
  const candidates = [];
  posts.forEach((post) => {
    const items = Array.isArray(post.mediaItems) && post.mediaItems.length ? post.mediaItems : post.media ? [post.media] : [];
    items.forEach((media, index) => {
      if (!isLegacyStoredImage(media)) return;
      const key = `${post.id}:${index}:${media.src.length}`;
      if (legacyImageMigrations.has(key)) return;
      legacyImageMigrations.add(key);
      candidates.push({ postId: post.id, index, source: media.src, key });
    });
  });
  if (!candidates.length) return;
  void Promise.all(candidates.map(async (candidate) => {
    const blob = await dataUrlToBlob(candidate.source);
    const stored = await saveImageMedia(blob);
    return { ...candidate, stored };
  })).then((migrations) => {
    const replacements = new Map(migrations.map((item) => [`${item.postId}:${item.index}`, item.stored]));
    const current = read(STORAGE_KEYS.TEACHER_POSTS, []);
    const next = current.map((post) => {
      const rawItems = Array.isArray(post.mediaItems) && post.mediaItems.length ? post.mediaItems : post.media ? [post.media] : [];
      if (!rawItems.length) return post;
      const mediaItems = rawItems.map((media, index) => {
        const replacement = replacements.get(`${post.id}:${index}`);
        return replacement ? { ...media, ...replacement } : media;
      });
      const rest = { ...post };
      delete rest.media;
      return { ...rest, mediaItems };
    });
    if (write(STORAGE_KEYS.TEACHER_POSTS, next)) notifyPostsChange();
  }).catch(() => {}).finally(() => candidates.forEach((candidate) => legacyImageMigrations.delete(candidate.key)));
};

const normalizeStoredMedia = (media) => media?.storageKey
  ? { ...media, src: getMediaUrl(media.storageKey, media.src) }
  : media;

const normalizeDiscussionComments = (comments) => (Array.isArray(comments) ? comments : []).map((comment) => ({
  ...comment,
  ...(comment?.media ? { media: normalizeStoredMedia(comment.media) } : {}),
  replies: (Array.isArray(comment?.replies) ? comment.replies : []).map((reply) => ({
    ...reply,
    ...(reply?.media ? { media: normalizeStoredMedia(reply.media) } : {}),
  })),
}));

const normalizePostMediaItem = (postId, item, index) => ({
  ...item,
  ...(item?.storageKey ? { src: getMediaUrl(item.storageKey, item.src) } : {}),
  id: item?.id || `${postId}-media-${index + 1}`,
  likes: Array.isArray(item?.likes) ? item.likes : [],
  comments: normalizeDiscussionComments(item?.comments),
});

export const getPostMediaItems = (post) => {
  const rawItems = Array.isArray(post?.mediaItems) && post.mediaItems.length
    ? post.mediaItems
    : post?.media
      ? [post.media]
      : [];

  return rawItems.map((item, index) => normalizePostMediaItem(post?.id || 'post', item, index));
};

const normalizePostMedia = (post) => {
  if (!post) return post;
  const mediaItems = getPostMediaItems(post);
  const comments = normalizeDiscussionComments(post.comments);
  if (!mediaItems.length) {
    return {
      ...post,
      comments,
    };
  }

  return {
    ...post,
    comments,
    mediaItems,
    media: post.media ? normalizePostMediaItem(post?.id || 'post', post.media, 0) : mediaItems[0],
  };
};

const collectStoredMediaKeys = (media, keys) => {
  if (media?.storageKey) keys.add(media.storageKey);
};

const queueMediaHydration = (keys, onHydrated) => {
  if (!keys.size) return;
  void Promise.all([...keys].map(hydrateMedia)).then((results) => {
    if (results.some((result) => result.hydrated)) onHydrated();
  }).catch(() => {});
};

export const getPosts = (authorId) => {
  const saved = read(STORAGE_KEYS.TEACHER_POSTS, []).filter((post) => !isLegacySamplePost(post.id));
  queueLegacyPostImageMigration(saved);
  const currentUser = read(STORAGE_KEYS.USER_INFO, null);
  const visualsByUser = read(STORAGE_KEYS.PROFILE_VISUALS, {}) || {};
  const posts = saved.map(normalizePostMedia).map((post) => {
    if (isLegacySamplePost(post.sharedPost?.id)) {
      post = { ...post, sharedPost: { text: 'Bài viết gốc không còn hiển thị.', createdAt: post.sharedPost.createdAt } };
    }
    const postOwnerId = post?.authorId ?? post?.teacherId;
    const isCurrentUser = Boolean(currentUser?.id && hasProfileId(post, currentUser.id));
    const persistedVisuals = postOwnerId != null ? (visualsByUser[String(postOwnerId)] || {}) : {};
    const persistedAvatar = persistedVisuals.avatar && !/^blob:/i.test(String(persistedVisuals.avatar))
      ? persistedVisuals.avatar
      : '';
    if (!isCurrentUser && !persistedAvatar) return post;
    const profileUpdates = {
      ...(isCurrentUser && currentUser.name ? { name: currentUser.name } : {}),
      ...((isCurrentUser && currentUser.avatar) || persistedAvatar
        ? { avatar: (isCurrentUser && currentUser.avatar) || persistedAvatar }
        : {}),
    };
    const targetProfileId = isCurrentUser ? currentUser.id : postOwnerId;
    const mediaItems = getPostMediaItems(post).map((item) => ({
      ...item,
      comments: synchronizeDiscussionAuthors(item.comments, targetProfileId, profileUpdates),
    }));
    return {
      ...post,
      ...(profileUpdates.name ? { authorName: profileUpdates.name, author: profileUpdates.name } : {}),
      ...(profileUpdates.avatar ? { authorAvatar: profileUpdates.avatar } : {}),
      comments: synchronizeDiscussionAuthors(post.comments, targetProfileId, profileUpdates),
      mediaItems,
      ...(post.media ? { media: mediaItems[0] || post.media } : {}),
    };
  });
  const mediaKeys = new Set();
  const collectDiscussionMediaKeys = (items) => (items || []).forEach((item) => {
    collectStoredMediaKeys(item?.media, mediaKeys);
    collectDiscussionMediaKeys(item?.replies);
  });
  posts.forEach((post) => {
    getPostMediaItems(post).forEach((media) => {
      collectStoredMediaKeys(media, mediaKeys);
      collectDiscussionMediaKeys(media.comments);
    });
    collectDiscussionMediaKeys(post.comments);
  });
  queueMediaHydration(mediaKeys, notifyPostsChange);
  if (authorId === undefined || authorId === null) return posts;

  const normalizedAuthorId = String(authorId);
  return posts.filter((post) => String(post.teacherId ?? '') === normalizedAuthorId || String(post.authorId ?? '') === normalizedAuthorId);
};

export const savePost = (post) => {
  const saved = read(STORAGE_KEYS.TEACHER_POSTS, []);
  const savedSuccessfully = write(STORAGE_KEYS.TEACHER_POSTS, [normalizePostMedia(post), ...saved]);
  if (savedSuccessfully) notifyPostsChange();
  return savedSuccessfully;
};

export const updatePost = (postId, updater) => {
  const saved = read(STORAGE_KEYS.TEACHER_POSTS, []);
  const existingIndex = saved.findIndex((post) => post.id === postId && !isLegacySamplePost(post.id));
  if (existingIndex < 0) return getPosts();
  const updated = normalizePostMedia(updater(normalizePostMedia(saved[existingIndex])));
  const next = saved.map((post, index) => index === existingIndex ? updated : post);
  write(STORAGE_KEYS.TEACHER_POSTS, next);
  notifyPostsChange();
  return getPosts();
};

export const updatePostMediaItem = (postId, mediaId, updater) => updatePost(postId, (post) => {
  const mediaItems = getPostMediaItems(post);
  const updatedItems = mediaItems.map((item) => item.id === mediaId ? updater(item) : item);
  return {
    ...post,
    mediaItems: updatedItems,
    media: post.media ? updatedItems[0] : undefined,
  };
});

export const getAlbumMediaInteractions = () => storage.get(STORAGE_KEYS.ALBUM_MEDIA_INTERACTIONS, {});

export const saveAlbumMediaInteraction = (mediaKey, data) => {
  if (!mediaKey) return;
  const current = storage.get(STORAGE_KEYS.ALBUM_MEDIA_INTERACTIONS, {});
  const next = {
    ...current,
    [mediaKey]: {
      ...(current[mediaKey] || {}),
      ...data,
    },
  };
  storage.set(STORAGE_KEYS.ALBUM_MEDIA_INTERACTIONS, next);
};

const hasProfileId = (item, profileId) => String(item?.authorId ?? item?.teacherId ?? '') === String(profileId);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const synchronizeDiscussionAuthors = (items, profileId, updates) => (items || []).map((item) => {
  const matches = hasProfileId(item, profileId);
  return {
    ...item,
    ...(matches && hasOwn(updates, 'name') ? { authorName: updates.name, author: updates.name } : {}),
    ...(matches && hasOwn(updates, 'avatar') ? { authorAvatar: updates.avatar } : {}),
    ...(item?.media ? { media: normalizeStoredMedia(item.media) } : {}),
    replies: synchronizeDiscussionAuthors(item.replies, profileId, updates),
  };
});

// Posts persist a small author snapshot so old posts can still render offline.
// Refresh that snapshot whenever its owner changes name or avatar, including
// comments and replies, so the interface has one consistent identity.
export const syncPostAuthorProfile = (profileId, profileUpdates = {}) => {
  if (profileId == null || (!hasOwn(profileUpdates, 'name') && !hasOwn(profileUpdates, 'avatar'))) return getPosts();
  const saved = read(STORAGE_KEYS.TEACHER_POSTS, []);
  const next = saved.map((post) => {
    const ownsPost = hasProfileId(post, profileId);
    const mediaItems = getPostMediaItems(post).map((item) => ({
      ...item,
      comments: synchronizeDiscussionAuthors(item.comments, profileId, profileUpdates),
    }));
    const sharedPost = post.sharedPost && (hasProfileId(post.sharedPost, profileId) || String(post.sharedPost.author?.id ?? '') === String(profileId))
      ? {
          ...post.sharedPost,
          author: {
            ...(post.sharedPost.author || {}),
            id: post.sharedPost.author?.id || post.sharedPost.authorId || post.sharedPost.teacherId || profileId,
            ...(hasOwn(profileUpdates, 'name') ? { name: profileUpdates.name } : {}),
            ...(hasOwn(profileUpdates, 'avatar') ? { avatar: profileUpdates.avatar } : {}),
          },
        }
      : post.sharedPost;
    return {
      ...post,
      ...(ownsPost && hasOwn(profileUpdates, 'name') ? { authorName: profileUpdates.name, author: profileUpdates.name } : {}),
      ...(ownsPost && hasOwn(profileUpdates, 'avatar') ? { authorAvatar: profileUpdates.avatar } : {}),
      comments: synchronizeDiscussionAuthors(post.comments, profileId, profileUpdates),
      mediaItems,
      ...(post.media ? { media: mediaItems[0] || post.media } : {}),
      ...(sharedPost ? { sharedPost } : {}),
    };
  });
  const savedSuccessfully = write(STORAGE_KEYS.TEACHER_POSTS, next);
  if (savedSuccessfully) notifyPostsChange();
  return getPosts();
};

export const deletePost = (postId) => {
  const next = read(STORAGE_KEYS.TEACHER_POSTS, []).filter((post) => post.id !== postId);
  write(STORAGE_KEYS.TEACHER_POSTS, next);
  notifyPostsChange();
  return next;
};

const notifyNotificationChange = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('edumatch:notifications-updated'));
};

const MAX_STORED_NOTIFICATIONS = 50;
const sanitizeNotificationRecord = (notification) => {
  if (!notification || typeof notification !== 'object') return null;
  const avatar = String(notification.actorAvatar || '');
  const safeAvatar = avatar.startsWith('data:image/') && avatar.length > 4096 ? '' : avatar;
  return safeAvatar === notification.actorAvatar
    ? notification
    : { ...notification, actorAvatar: safeAvatar };
};

const readNotificationsList = () => {
  const saved = read(STORAGE_KEYS.NOTIFICATIONS, []);
  return Array.isArray(saved) ? saved.map(sanitizeNotificationRecord).filter(Boolean) : [];
};

export const getNotifications = (recipientId) =>
  readNotificationsList()
    .filter((notification) => isSameEntityId(notification.recipientId, recipientId))
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));

export const createNotification = (notification) => {
  if (!notification?.recipientId) return null;
  const nextNotification = sanitizeNotificationRecord({
    id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    isRead: false,
    createdAt: new Date().toISOString(),
    ...notification,
  });
  const saved = readNotificationsList();
  write(STORAGE_KEYS.NOTIFICATIONS, [nextNotification, ...saved].slice(0, MAX_STORED_NOTIFICATIONS));
  notifyNotificationChange();
  return nextNotification;
};

export const markNotificationRead = (notificationId) => {
  const next = readNotificationsList().map((notification) =>
    notification.id === notificationId ? { ...notification, isRead: true } : notification
  );
  write(STORAGE_KEYS.NOTIFICATIONS, next);
  notifyNotificationChange();
  return next;
};

export const markAllNotificationsRead = (recipientId) => {
  const next = readNotificationsList().map((notification) =>
    isSameEntityId(notification.recipientId, recipientId) ? { ...notification, isRead: true } : notification
  );
  write(STORAGE_KEYS.NOTIFICATIONS, next);
  notifyNotificationChange();
  return next;
};

const isSameEntityId = (first, second) =>
  first != null && second != null && String(first) === String(second);

const affinityRecords = () => {
  const saved = read(STORAGE_KEYS.FEED_AFFINITY, []);
  return Array.isArray(saved) ? saved : [];
};

export const getProviderAffinity = (userId) => {
  if (!userId) return {};
  return affinityRecords()
    .filter((record) => isSameEntityId(record.userId, userId))
    .reduce((scores, record) => ({ ...scores, [record.providerId]: (scores[record.providerId] || 0) + Number(record.score || 0) }), {});
};

export const trackProviderAffinity = (userId, providerId, action, score = 1) => {
  if (!userId || !providerId || isSameEntityId(userId, providerId)) return;
  const saved = affinityRecords();
  const existingIndex = saved.findIndex((record) => isSameEntityId(record.userId, userId) && isSameEntityId(record.providerId, providerId) && record.action === action);
  const entry = { userId, providerId, action, score, updatedAt: new Date().toISOString() };
  const next = existingIndex === -1 ? [entry, ...saved] : saved.map((record, index) => index === existingIndex ? entry : record);
  write(STORAGE_KEYS.FEED_AFFINITY, next);
};

export const saveConversation = (conversation) => {
  const saved = read(STORAGE_KEYS.CONVERSATIONS, []);
  const recipientId = conversation.senderId === conversation.teacherId
    ? conversation.studentId
    : conversation.teacherId;
  write(STORAGE_KEYS.CONVERSATIONS, [{
    ...conversation,
    unreadFor: conversation.unreadFor || (recipientId ? [recipientId] : []),
    tags: conversation.tags || [],
  }, ...saved]);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('edumatch:conversations-updated'));
};

export const createConversationId = (prefix = 'message') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const getConversationsForUser = (userId) =>
  read(STORAGE_KEYS.CONVERSATIONS, []).filter(
    (message) => message.studentId === userId || message.teacherId === userId
  );

export const updateConversationThread = (thread, updater) => {
  const reference = thread.messages?.[0] || thread;
  const sameThread = (message) =>
    message.courseId === reference.courseId
    && message.studentId === reference.studentId
    && message.teacherId === reference.teacherId;
  const next = read(STORAGE_KEYS.CONVERSATIONS, []).map((message) =>
    sameThread(message) ? updater(message) : message
  );
  write(STORAGE_KEYS.CONVERSATIONS, next);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('edumatch:conversations-updated'));
  return next;
};

export const markConversationRead = (thread, userId) =>
  updateConversationThread(thread, (message) => ({
    ...message,
    unreadFor: (message.unreadFor || []).filter((id) => id !== userId),
  }));

export const markConversationUnread = (thread, userId) =>
  updateConversationThread(thread, (message) => ({
    ...message,
    unreadFor: Array.from(new Set([...(message.unreadFor || []), userId])),
  }));

export const getMessageTemplates = (userId) =>
  read(STORAGE_KEYS.MESSAGE_TEMPLATES, []).filter((template) => template.userId === userId);

export const saveMessageTemplate = (userId, template) => {
  if (!userId || !template?.id || !template?.title || !template?.text) return getMessageTemplates(userId);
  const saved = read(STORAGE_KEYS.MESSAGE_TEMPLATES, []);
  const nextTemplate = { ...template, userId, updatedAt: new Date().toISOString() };
  const exists = saved.some((item) => item.userId === userId && item.id === template.id);
  const next = exists
    ? saved.map((item) => item.userId === userId && item.id === template.id ? { ...item, ...nextTemplate } : item)
    : [{ ...nextTemplate, createdAt: nextTemplate.createdAt || nextTemplate.updatedAt }, ...saved];
  write(STORAGE_KEYS.MESSAGE_TEMPLATES, next);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('edumatch:message-templates-updated'));
  return next.filter((item) => item.userId === userId);
};

export const deleteMessageTemplate = (userId, templateId) => {
  const next = read(STORAGE_KEYS.MESSAGE_TEMPLATES, []).filter(
    (template) => template.userId !== userId || template.id !== templateId
  );
  write(STORAGE_KEYS.MESSAGE_TEMPLATES, next);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('edumatch:message-templates-updated'));
  return next.filter((template) => template.userId === userId);
};

export const getAge = (dob) => {
  if (!dob) return '—';
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return '—';
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age -= 1;
  return age;
};

export const paymentLabel = (type) => ({
  'full-course': 'Trọn khóa',
  monthly: 'Theo tháng',
  session: 'Theo buổi',
}[type] || 'Linh hoạt');

export const modeLabel = (course) => {
  if (course.learningMode === 'online') return 'Trực tuyến';
  if (course.learningMode === 'recorded') return 'Video quay sẵn';
  return course.inPersonType === 'home' ? 'Dạy tại nhà' : 'Dạy tại lớp';
};

export const enrollmentLabel = (course) =>
  course.enrollmentStatus === 'closed' ? 'Đã đóng lớp' : 'Mở lớp';
