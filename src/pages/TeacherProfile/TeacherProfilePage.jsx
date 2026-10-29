import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, BookOpen, Camera, ChevronDown, FileCheck2, FileText, GripVertical, Heart, ImagePlus, Images, LoaderCircle, MessageCircle, Phone, Plus, Save, Share2, Star, Video, X } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ROUTES } from '@/constants/routes';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { useAuth } from '@/hooks/useAuth';
import { chatService, chatError } from '@/services/chatService';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { masterDataService } from '@/services/masterDataService';
import { normalizeAuthUser } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { requestError } from '@/utils/formErrors';
import { formatRelativeTime } from '@/utils/formatDate';
import { storage } from '@/utils/storage';
import { hydrateMedia, saveImageMedia, saveVideoMedia } from '@/utils/mediaLibrary';
import { createNotification, deletePost, getAge, getCourses, getPostMediaItems, getPosts, getProviderTrustCount, getProviderTrustUserIds, hasProviderTrust, savePost, syncTeacherCourseProfile, toggleProviderTrust, trackProviderAffinity, updatePost, updatePostMediaItem } from '@/features/learning/marketplace';
import { Modal } from '@/components/feedback/Modal';
import { ImageAttachment } from '@/components/forms/ImageAttachment';
import { DefaultRoleAvatar } from '@/components/common/DefaultRoleAvatar';
import { ProfileImageCropDialog } from '@/components/profile/ProfileImageCropDialog';
import { ProfileImageSourceDialog } from '@/components/profile/ProfileImageSourceDialog';
import { InlinePostEditor, PostComposerDialog, PostComposerTrigger } from '@/components/feedback/PostComposerDialog';
import { ContentMenu } from '@/components/feedback/ContentMenu';
import { LikesModal } from '@/components/feedback/LikesModal';
import { PostImageDialog } from '@/components/feedback/PostImageDialog';
import { ReactionCount } from '@/components/feedback/ReactionCount';
import { submitOnPlainEnter } from '@/utils/submitOnPlainEnter';
import '@/components/feedback/expandableImage.css';
import '@/components/courses/course.css';
import '../Courses/courses.css';
import { tutors } from '../Home/homeData';

const SHORT_BIO_MAX_LENGTH = 500;
const TEACHING_FIELD_MAX_LENGTH = 45;
const MAX_PORTFOLIO_IMAGES = 4;
const PROFILE_POSTS_BATCH_SIZE = 8;
const createPostId = (prefix = 'post') => `${prefix}-${Date.now()}`;
const limitProfileText = (value, maxLength = SHORT_BIO_MAX_LENGTH) => String(value || '').slice(0, maxLength);
const cleanProfileText = (value, maxLength = SHORT_BIO_MAX_LENGTH) => limitProfileText(
  String(value || '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, ''),
  maxLength,
);
const cleanUnlimitedProfileText = (value) => String(value || '')
  .replace(/\*\*/g, '')
  .replace(/__/g, '')
  .replace(/^\s{0,3}#{1,6}\s+/gm, '');
const formatPublishedAt = formatRelativeTime;
const readImageAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
  reader.readAsDataURL(file);
});
const hydratePublicProfileVisuals = (source, requestedId) => {
  const rawProfile = source?.user || source?.provider || source?.data?.user || source?.data?.provider || source?.data || source || {};
  const profile = normalizeAuthUser(rawProfile);
  const profileId = profile?.id ?? requestedId;
  const localVisuals = storage.get(STORAGE_KEYS.PROFILE_VISUALS, {})?.[String(profileId)] || {};
  const savedAvatar = localVisuals.avatar || '';
  const savedCoverImage = localVisuals.coverImage || '';
  const hasLocallyStoredAvatar = /^(?:data:image\/|blob:)/i.test(savedAvatar);
  const hasLocallyStoredCover = /^(?:data:image\/|blob:)/i.test(savedCoverImage);
  return {
    ...profile,
    id: profileId,
    requestedId,
    // The API can return a storage path before its file is publicly available.
    // On the same device, a just-uploaded image is a more reliable source than
    // that broken remote URL. Visitors on another device still use the API URL.
    avatar: hasLocallyStoredAvatar ? savedAvatar : profile.avatar || savedAvatar,
    coverImage: hasLocallyStoredCover ? savedCoverImage : profile.coverImage || savedCoverImage,
  };
};
const ProfileAvatar = ({ src, alt, role, size }) => {
  const [failedSource, setFailedSource] = useState('');
  const shouldShowImage = Boolean(src) && failedSource !== src;

  if (!shouldShowImage) return <DefaultRoleAvatar role={role} size={size} />;

  return <img src={src} alt={alt} onError={() => setFailedSource(src)} />;
};
const getMediaItems = getPostMediaItems;
const normalizePhotoAlbums = (value) => (Array.isArray(value) ? value : []).map((album, index) => ({
  id: String(album?.id || `album-${index}`),
  name: String(album?.name || album?.title || 'Album ảnh').trim() || 'Album ảnh',
  description: String(album?.description || '').trim(),
  media: (Array.isArray(album?.media) ? album.media : Array.isArray(album?.images) ? album.images : []).map((item, mediaIndex) => ({
    id: String(item?.id || `media-${mediaIndex}`),
    src: typeof item === 'string' ? item : item?.src || '',
    storageKey: typeof item === 'object' ? item?.storageKey || '' : '',
    type: typeof item === 'object' && item?.type === 'video' ? 'video' : 'image',
    description: typeof item === 'object' ? String(item?.description || item?.caption || '').trim() : '',
    likes: typeof item === 'object' && Array.isArray(item?.likes) ? item.likes : [],
    comments: typeof item === 'object' && Array.isArray(item?.comments) ? item.comments : [],
    createdAt: typeof item === 'object' ? item?.createdAt || item?.created_at || '' : '',
  })).filter((item) => item.src || item.storageKey),
  createdAt: album?.createdAt || album?.created_at || '',
})).filter((album) => album.name);
const readStoredPhotoAlbums = (profileId) => normalizePhotoAlbums(
  storage.get(STORAGE_KEYS.PROFILE_ALBUMS, {})?.[String(profileId)] || [],
);
const saveStoredPhotoAlbums = (profileId, albums) => {
  if (profileId == null) return;
  const albumsByProfile = storage.get(STORAGE_KEYS.PROFILE_ALBUMS, {});
  storage.set(STORAGE_KEYS.PROFILE_ALBUMS, {
    ...albumsByProfile,
    [String(profileId)]: albums,
  });
};
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

export function TeacherProfilePage() {
  const { teacherId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUser } = useAuth();
  const chatOpening = useRef(false);
  const [serverProfile, setServerProfile] = useState(null);
  const [posts, setPosts] = useState(() => getPosts(teacherId).slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)));
  const [postText, setPostText] = useState('');
  const [media, setMedia] = useState([]);
  const [postAlbumId, setPostAlbumId] = useState('');
  const [isPostComposerOpen, setIsPostComposerOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingPostText, setEditingPostText] = useState('');
  const [editingPostMedia, setEditingPostMedia] = useState([]);
  const [profileImageUploadField, setProfileImageUploadField] = useState(null);
  const [profileImageSourceField, setProfileImageSourceField] = useState(null);
  const [profileImageCropDraft, setProfileImageCropDraft] = useState(null);
  const [commentText, setCommentText] = useState({});
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
  const [expandedCommentImage, setExpandedCommentImage] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingDetailedProfile, setIsEditingDetailedProfile] = useState(false);
  const [isViewingProfileSummary, setIsViewingProfileSummary] = useState(false);
  const [isViewingDetailedProfile, setIsViewingDetailedProfile] = useState(false);
  const [isViewingProfileAlbums, setIsViewingProfileAlbums] = useState(false);
  const [activeProfileAlbumFilterId, setActiveProfileAlbumFilterId] = useState('all-media');
  const [isCreatingProfileAlbum, setIsCreatingProfileAlbum] = useState(false);
  const [isAddingAlbumMedia, setIsAddingAlbumMedia] = useState(false);
  const [isEditingAlbumDescription, setIsEditingAlbumDescription] = useState(false);
  const [selectedPortfolioImage, setSelectedPortfolioImage] = useState(null);
  const [activeProfileTextField, setActiveProfileTextField] = useState(null);
  const [profileDraft, setProfileDraft] = useState({});
  const [profileErrors, setProfileErrors] = useState({});
  const [detailedProfileDraft, setDetailedProfileDraft] = useState('');
  const [portfolioImagesDraft, setPortfolioImagesDraft] = useState([]);
  const [profileAlbums, setProfileAlbums] = useState(() => ({
    profileId: String(teacherId),
    albums: readStoredPhotoAlbums(teacherId),
  }));
  const [albumDraft, setAlbumDraft] = useState({ name: '', description: '', media: [] });
  const [albumAdditionDraft, setAlbumAdditionDraft] = useState({ albumId: '', description: '', media: [] });
  const [isPreparingAlbumImages, setIsPreparingAlbumImages] = useState(false);
  const [, setTrustRefresh] = useState(0);
  const [visiblePostCount, setVisiblePostCount] = useState(PROFILE_POSTS_BATCH_SIZE);
  const [showAllProfileCourses, setShowAllProfileCourses] = useState(false);
  const [expandedProfileCourseIds, setExpandedProfileCourseIds] = useState({});
  const portfolioImagesInputRef = useRef(null);
  const albumImagesInputRef = useRef(null);
  const avatarImageInputRef = useRef(null);
  const coverImageInputRef = useRef(null);
  const albumDraftDragIndexRef = useRef(null);
  const loadMorePostsRef = useRef(null);
  const courses = getCourses().filter((course) => String(course.teacher?.id) === String(teacherId));
  const ownsProfile = user?.id != null && String(user.id) === String(teacherId);
  const sampleTutor = tutors.find((tutor) => tutor.id === teacherId);
  const sampleProfile = sampleTutor ? {
    id: sampleTutor.id,
    name: [sampleTutor.title, sampleTutor.name].filter(Boolean).join(' '),
    role: 'teacher',
    avatar: sampleTutor.image,
    experience: typeof sampleTutor.experience === 'number' ? `${sampleTutor.experience} năm kinh nghiệm` : sampleTutor.experience,
    teachingField: sampleTutor.teachingField || sampleTutor.subject || '',
    qualifications: sampleTutor.qualifications || 'Đang cập nhật',
    bio: [sampleTutor.description, sampleTutor.bio].filter(Boolean).join(' '),
    heartCount: sampleTutor.heartCount,
    phone: sampleTutor.phone || '',
    isPhonePublic: Boolean(sampleTutor.isPhonePublic),
    detailedProfile: sampleTutor.detailedProfile || '',
    profilePortfolioImages: sampleTutor.profilePortfolioImages || [],
  } : null;
  const postProfile = getPosts().find((post) => String(post.authorId ?? '') === String(teacherId) || String(post.teacherId ?? '') === String(teacherId));
  const profile = ownsProfile ? user : (String(serverProfile?.requestedId) === String(teacherId) ? serverProfile : null) || courses[0]?.teacher || sampleProfile || (postProfile ? {
    id: postProfile.authorId || postProfile.teacherId,
    name: postProfile.authorName || postProfile.author || 'Thành viên EduMatch',
    role: postProfile.authorRole || 'student',
    avatar: postProfile.authorAvatar || '',
    bio: 'Thành viên cộng đồng EduMatch',
  } : null);
  const isCenterProfile = profile?.role === 'center';
  const isTeacherProfile = profile?.role === 'teacher' || (!isCenterProfile && courses.length > 0);
  const isEducationProviderProfile = isTeacherProfile || isCenterProfile;
  const canCreateCourse = ownsProfile && ['teacher', 'center'].includes(user?.role);
  const hasSubmittedVerification = ownsProfile && profile?.verificationStatus && profile.verificationStatus !== 'unverified';
  const publicPhone = isEducationProviderProfile && profile?.isPhonePublic && profile?.phone;
  const trustCount = getProviderTrustCount(profile?.id, profile?.heartCount);
  const trustUserIds = getProviderTrustUserIds(profile?.id);
  const trustedByCurrentUser = hasProviderTrust(user?.id, profile?.id);
  const hasDetailedProfile = Boolean(profile?.detailedProfile?.trim() || profile?.profilePortfolioImages?.length);
  const profileCapability = cleanUnlimitedProfileText(profile?.detailedProfile || profile?.bio);
  const profileIntro = profileCapability || (isCenterProfile ? 'Trung tâm đang hoàn thiện hồ sơ năng lực.' : isTeacherProfile ? 'Giáo viên đang hoàn thiện hồ sơ năng lực.' : 'Học viên đang hoàn thiện phần giới thiệu.');
  const shortProfileIntro = cleanProfileText(profileIntro);
  const profileQualifications = cleanProfileText(profile?.qualifications);
  const profileExperience = cleanProfileText(profile?.experience);
  const profileTextFields = {
    qualifications: {
      label: 'Bằng cấp, chứng chỉ',
      placeholder: 'Ví dụ: Cử nhân Sư phạm, IELTS 8.0',
    },
    experience: {
      label: 'Kinh nghiệm giảng dạy',
      placeholder: 'Ví dụ: 5 năm giảng dạy tiếng Anh',
    },
    bio: {
      label: 'Hồ sơ năng lực',
      placeholder: user?.role === 'center'
        ? 'Chia sẻ thêm để học viên hiểu hơn về trung tâm của bạn.'
        : user?.role === 'teacher'
          ? 'Chia sẻ về bản thân để học viên hiểu hơn về bạn.'
          : 'Chia sẻ ngắn gọn điều bạn muốn cộng đồng biết về mình...',
    },
  };
  const activeProfileText = activeProfileTextField
    ? profileTextFields[activeProfileTextField]
    : null;
  const renderedPosts = posts.slice(0, visiblePostCount);
  const displayedProfileCourses = showAllProfileCourses ? courses : courses.slice(0, 2);
  const storedProfileAlbums = readStoredPhotoAlbums(profile?.id || teacherId);
  const remoteProfileAlbums = normalizePhotoAlbums(profile?.photoAlbums);
  const visibleProfileAlbums = profileAlbums.profileId === String(profile?.id || teacherId) && profileAlbums.albums.length
    ? profileAlbums.albums
    : storedProfileAlbums.length ? storedProfileAlbums : remoteProfileAlbums;
  const profileAlbumMedia = (() => {
    const candidates = [
      profile?.avatar && { src: profile.avatar, type: 'image', label: 'Ảnh đại diện' },
      profile?.coverImage && { src: profile.coverImage, type: 'image', label: 'Ảnh bìa' },
      ...(profile?.profilePortfolioImages || []).map((src, index) => ({ src, type: 'image', label: `Ảnh hồ sơ năng lực ${index + 1}` })),
      ...visibleProfileAlbums.flatMap((album) => album.media.map((item, index) => ({
        ...item,
        albumId: album.id,
        label: `${album.name} ${index + 1}`,
      }))),
      ...posts.flatMap((post) => getMediaItems(post)
        .filter((item) => item.src)
        .map((item, index) => ({ ...item, label: `${item.type === 'video' ? 'Video' : 'Ảnh'} từ bài viết ${index + 1}` }))),
    ].filter(Boolean);

    return [...new Map(candidates.map((item) => [`${item.type}:${item.storageKey || item.src}`, item])).values()];
  })();
  const profileAlbumTabs = [
    { id: 'all-media', name: 'Tất cả', media: profileAlbumMedia },
    { id: 'videos', name: 'Video', media: profileAlbumMedia.filter((item) => item.type === 'video') },
    { id: 'photos', name: 'Ảnh', media: profileAlbumMedia.filter((item) => item.type !== 'video') },
    { id: 'albums', name: 'Album', media: [], count: visibleProfileAlbums.length },
  ];
  const profileAlbumViews = [...profileAlbumTabs, ...visibleProfileAlbums];
  const linkedAlbumId = new URLSearchParams(location.search).get('album');
  const hasLinkedAlbum = Boolean(linkedAlbumId && visibleProfileAlbums.some((album) => album.id === linkedAlbumId));
  const displayedProfileAlbumFilterId = hasLinkedAlbum ? linkedAlbumId : activeProfileAlbumFilterId;
  const activeProfileAlbum = profileAlbumViews.find((album) => album.id === displayedProfileAlbumFilterId) || profileAlbumTabs[0];
  const isCustomProfileAlbum = visibleProfileAlbums.some((album) => album.id === activeProfileAlbum.id);
  const isAlbumDirectory = activeProfileAlbum.id === 'albums';
  const isSameAlbumMedia = (candidate, item) => Boolean(candidate && item && (
    (candidate.id && item.id && candidate.id === item.id)
    || (candidate.storageKey && item.storageKey && candidate.storageKey === item.storageKey)
    || (candidate.src && item.src && candidate.src === item.src)
  ));
  const openAlbumMedia = (mediaItems, index, albumId = null) => {
    const item = mediaItems[index];
    if (!item) return;
    const allPosts = getPosts();
    const interactionPostIds = mediaItems.map((mediaItem) => allPosts.find((post) => getMediaItems(post).some((candidate) => isSameAlbumMedia(candidate, mediaItem)))?.id || null);
    const matchedPost = allPosts.find((post) => post.id === interactionPostIds[index]);
    // Some older albums were created before album media was linked to a feed
    // post. Keep those items fully interactive instead of making them dead-end
    // previews: their reactions and comments are stored back on the album item.
    const sourcePost = matchedPost || {
      id: `album-media:${profile.id}:${albumId || 'library'}:${item.id || index}`,
      teacherId: profile.id,
      authorId: profile.id,
      authorName: profile.name,
      authorRole: profile.role,
      authorAvatar: profile.avatar || '',
      media: item,
      mediaItems: [item],
      likes: item.likes || [],
      comments: item.comments || [],
      createdAt: item.createdAt || new Date().toISOString(),
      isAlbumMediaFallback: true,
    };
    setIsViewingProfileAlbums(false);
    setImageViewer({
      post: sourcePost,
      author: {
        id: profile.id,
        name: profile.name,
        role: profile.role,
        avatar: profile.avatar || '',
      },
      mediaItems,
      interactionPostIds,
      activeIndex: index,
      albumId: matchedPost ? null : albumId,
    });
  };

  useEffect(() => {
    const profileId = profile?.id || teacherId;
    const storedAlbums = readStoredPhotoAlbums(profileId);
    const sourceAlbums = storedAlbums.length ? storedAlbums : normalizePhotoAlbums(profile?.photoAlbums);
    const legacyAlbumItems = sourceAlbums.flatMap((album) => album.media.map((item, index) => ({ albumId: album.id, index, item })))
      .filter(({ item }) => item.type === 'image' && !item.storageKey && String(item.src || '').startsWith('data:image/'));

    if (legacyAlbumItems.length) {
      void Promise.all(legacyAlbumItems.map(async ({ albumId, index, item }) => {
        const blob = await (await fetch(item.src)).blob();
        const stored = await saveImageMedia(blob);
        return { albumId, index, stored };
      })).then((migrations) => {
        const migratedLookup = new Map(migrations.map((item) => [`${item.albumId}:${item.index}`, item.stored]));
        const migratedAlbums = sourceAlbums.map((album) => ({
          ...album,
          media: album.media.map((item, index) => {
            const stored = migratedLookup.get(`${album.id}:${index}`);
            return stored ? { ...item, ...stored } : item;
          }),
        }));
        saveStoredPhotoAlbums(profileId, migratedAlbums);
        setProfileAlbums({ profileId: String(profileId), albums: migratedAlbums });
        if (ownsProfile) updateUser({ photoAlbums: migratedAlbums });
      }).catch(() => {
        // Keep legacy media visible when the browser cannot migrate it yet.
      });
    }
    if (!sourceAlbums.some((album) => album.media.some((item) => item.storageKey))) return undefined;

    let isCancelled = false;
    const hydrateAlbums = async () => {
      const hydratedAlbums = await Promise.all(sourceAlbums.map(async (album) => ({
        ...album,
        media: await Promise.all(album.media.map(async (item) => {
          if (!item.storageKey) return item;
          const { src } = await hydrateMedia(item.storageKey);
          return src ? { ...item, src } : item;
        })),
      })));
      if (!isCancelled) setProfileAlbums({ profileId: String(profileId), albums: hydratedAlbums });
    };
    hydrateAlbums().catch(() => {
      // An unavailable local video should not stop the rest of the album loading.
    });
    return () => { isCancelled = true; };
  }, [ownsProfile, profile?.id, profile?.photoAlbums, teacherId, updateUser]);

  useEffect(() => {
    if (user?.id && profile?.id && user.id !== profile.id) trackProviderAffinity(user.id, profile.id, 'viewed-profile', 1);
  }, [profile?.id, user?.id]);

  useEffect(() => {
    const syncPosts = () => {
      setPosts(getPosts(teacherId).slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)));
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
  }, [teacherId]);

  useEffect(() => {
    if (visiblePostCount >= posts.length) return undefined;
    const target = loadMorePostsRef.current;
    if (!target) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisiblePostCount((current) => Math.min(current + PROFILE_POSTS_BATCH_SIZE, posts.length));
    }, { rootMargin: '560px 0px' });

    observer.observe(target);
    return () => observer.disconnect();
  }, [posts.length, visiblePostCount]);

  useEffect(() => {
    if (!/^[1-9]\d*$/.test(String(teacherId)) || ownsProfile) return;
    let active = true;
    masterDataService.provider(teacherId).then((result) => {
      if (active) setServerProfile(hydratePublicProfileVisuals(result, teacherId));
    }).catch(() => { if (active) setServerProfile({ requestedId: teacherId }); });
    return () => { active = false; };
  }, [teacherId, ownsProfile]);

  if (!profile && /^[1-9]\d*$/.test(String(teacherId)) && String(serverProfile?.requestedId) !== String(teacherId)) return <section className="learning-page"><p role="status">Đang tải hồ sơ công khai...</p></section>;
  if (!profile) return <section className="learning-page"><div className="learning-empty"><h1>Chưa có hồ sơ công khai</h1><p>Hồ sơ sẽ xuất hiện sau khi người dùng hoàn thiện thông tin hoặc công khai khóa học đầu tiên.</p><Link to={ROUTES.HOME}>Về trang chủ</Link></div></section>;

  if (ownsProfile && user.role === 'student') return <Navigate to={ROUTES.PROFILE} replace />;

  const closeProfileAlbums = () => {
    setIsViewingProfileAlbums(false);
    if (hasLinkedAlbum) navigate(ROUTES.TEACHER_PROFILE(teacherId), { replace: true });
  };
  const selectProfileAlbum = (albumId) => {
    if (hasLinkedAlbum) navigate(ROUTES.TEACHER_PROFILE(teacherId), { replace: true });
    setActiveProfileAlbumFilterId(albumId);
    setIsEditingAlbumDescription(false);
  };

  const chooseProfileImage = async (event, field) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Vui lòng chọn một tệp ảnh.'); return; }

    try {
      setProfileImageCropDraft({
        field,
        file,
        source: await readImageAsDataUrl(file),
        variant: field === 'avatar' ? 'avatar' : 'cover',
      });
    } catch {
      toast.error('Không thể mở ảnh. Vui lòng chọn một ảnh khác.');
    }
  };

  const chooseExistingProfileImage = async (item) => {
    const field = profileImageSourceField;
    if (!field || !item?.src) return;

    try {
      const isLocalUrl = /^(?:data:image\/|blob:)/i.test(item.src);
      const source = isLocalUrl
        ? item.src
        : await fetch(item.src).then(async (response) => {
          if (!response.ok) throw new Error('Không thể đọc ảnh đã chọn.');
          return readImageAsDataUrl(await response.blob());
        });
      setProfileImageSourceField(null);
      setProfileImageCropDraft({
        field,
        source,
        variant: field === 'avatar' ? 'avatar' : 'cover',
      });
    } catch {
      toast.error('Không thể mở ảnh có sẵn. Vui lòng thử một ảnh khác hoặc tải ảnh mới lên.');
    }
  };

  const openImageUpload = () => {
    const field = profileImageSourceField;
    if (!field) return;
    const input = field === 'avatar' ? avatarImageInputRef.current : coverImageInputRef.current;
    input?.click();
    setProfileImageSourceField(null);
  };

  const saveCroppedProfileImage = async ({ image, file }) => {
    const field = profileImageCropDraft?.field;
    if (!field || !user) return;
    setProfileImageUploadField(field);
    try {
      if (field === 'avatar') {
        const avatarVersion = `${file.name}-${file.size}-${file.lastModified}`;
        updateUser({ avatar: image, avatarVersion });
        if (['teacher', 'center'].includes(user?.role)) syncTeacherCourseProfile(user.id, { avatar: image });
        try {
          const res = await profileService.uploadAvatar(file);
          if (res?.user) {
            // A storage URL can be returned before it is publicly reachable. Do
            // not replace the image the user has just selected with that URL.
            const { avatar: _serverAvatar, ...serverProfile } = res.user;
            updateUser({ ...serverProfile, avatar: image, avatarVersion });
            if (['teacher', 'center'].includes(user?.role)) syncTeacherCourseProfile(user.id, { avatar: image });
          }
        } catch (error) {
          // The local image is already persisted, so upload failure must not
          // make the avatar disappear from the interface.
          console.warn('API avatar upload failed, keeping local avatar:', error);
        }
      } else {
        updateUser({ coverImage: image });
      }
      setProfileImageCropDraft(null);
      toast.success(field === 'avatar' ? 'Đã cập nhật ảnh đại diện.' : 'Đã cập nhật ảnh bìa.');
    } catch {
      toast.error(field === 'avatar' ? 'Không thể lưu ảnh đại diện. Vui lòng thử lại.' : 'Không thể lưu ảnh bìa. Vui lòng thử lại.');
    } finally {
      setProfileImageUploadField(null);
    }
  };
  const openProfileEditor = () => {
    setProfileDraft({
      name: user?.name || '',
      dob: user?.dob || '',
      qualifications: cleanProfileText(user?.qualifications),
      experience: cleanProfileText(user?.experience),
      bio: cleanUnlimitedProfileText(user?.detailedProfile || user?.bio),
      foundedYear: user?.foundedYear || '',
      teachingField: user?.teachingField || '',
      isPhonePublic: Boolean(user?.isPhonePublic),
    });
    setProfileErrors({});
    setIsEditingProfile(true);
  };
  const updateProfileDraft = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = ['qualifications', 'experience'].includes(name)
      ? cleanProfileText(value)
      : name === 'teachingField'
        ? value.slice(0, TEACHING_FIELD_MAX_LENGTH)
      : value;
    setProfileDraft((current) => ({ ...current, [name]: type === 'checkbox' ? checked : nextValue }));
    if (profileErrors[name]) setProfileErrors((current) => ({ ...current, [name]: '' }));
  };
  const saveProfile = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    const requiredFields = user?.role === 'center' ? ['name', 'teachingField', 'bio', 'foundedYear'] : user?.role === 'teacher' ? ['name', 'teachingField', 'dob', 'qualifications', 'experience', 'bio'] : ['bio'];
    requiredFields.forEach((field) => {
      if (!String(profileDraft[field] || '').trim()) nextErrors[field] = 'Vui lòng điền thông tin này';
    });
    ['qualifications', 'experience'].forEach((field) => {
      if (String(profileDraft[field] || '').length > SHORT_BIO_MAX_LENGTH) {
        nextErrors[field] = `Tối đa ${SHORT_BIO_MAX_LENGTH} ký tự`;
      }
    });
    if (String(profileDraft.teachingField || '').length > TEACHING_FIELD_MAX_LENGTH) nextErrors.teachingField = `Tối đa ${TEACHING_FIELD_MAX_LENGTH} ký tự`;
    setProfileErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const updates = user?.role === 'center' ? {
      name: profileDraft.name.trim(),
      bio: cleanUnlimitedProfileText(profileDraft.bio).trim(),
      detailedProfile: cleanUnlimitedProfileText(profileDraft.bio).trim(),
      foundedYear: profileDraft.foundedYear.trim(),
      teachingField: profileDraft.teachingField.trim(),
      isPhonePublic: Boolean(profileDraft.isPhonePublic),
    } : user?.role === 'teacher' ? {
      name: profileDraft.name.trim(),
      dob: profileDraft.dob,
      qualifications: cleanProfileText(profileDraft.qualifications).trim(),
      experience: cleanProfileText(profileDraft.experience).trim(),
      teachingField: profileDraft.teachingField.trim(),
      bio: cleanUnlimitedProfileText(profileDraft.bio).trim(),
      detailedProfile: cleanUnlimitedProfileText(profileDraft.bio).trim(),
      isPhonePublic: Boolean(profileDraft.isPhonePublic),
    } : {
      bio: cleanUnlimitedProfileText(profileDraft.bio).trim(),
    };
    try {
      const response = await profileService.update({
        name: updates.name,
        bio: updates.bio,
        show_phone: Boolean(updates.isPhonePublic),
        isPhonePublic: Boolean(updates.isPhonePublic),
        ...(user?.role === 'teacher' ? {
          date_of_birth: updates.dob || null,
          headline: updates.qualifications,
          experience_years: Number.parseInt(updates.experience, 10) || 0,
        } : {}),
        ...(user?.role === 'center' ? { founded_year: updates.foundedYear || null } : {}),
        ...(user?.role !== 'student' ? { teaching_field: updates.teachingField } : {}),
      });
      const savedUser = response?.user || {};
      const syncedUpdates = {
        ...updates,
        ...savedUser,
        detailedProfile: savedUser.detailedProfile ?? updates.detailedProfile,
        teachingField: savedUser.teachingField ?? updates.teachingField,
        isPhonePublic: Boolean(updates.isPhonePublic),
      };
      updateUser(syncedUpdates);
      if (['teacher', 'center'].includes(user?.role)) syncTeacherCourseProfile(user.id, syncedUpdates);
      setActiveProfileTextField(null);
      setIsEditingProfile(false);
      toast.success('Thông tin hồ sơ đã được cập nhật.');
    } catch (error) {
      toast.error(requestError(error));
    }
  };
  const openDetailedProfileEditor = () => {
    setDetailedProfileDraft(user?.detailedProfile || '');
    setPortfolioImagesDraft(user?.profilePortfolioImages || []);
    setIsEditingDetailedProfile(true);
  };
  const addPortfolioImages = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const availableSlots = MAX_PORTFOLIO_IMAGES - portfolioImagesDraft.length;
    if (availableSlots <= 0) {
      toast.error(`Hồ sơ năng lực hiển thị tối đa ${MAX_PORTFOLIO_IMAGES} ảnh.`);
      return;
    }
    const validFiles = files.slice(0, availableSlots).filter((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Chỉ hỗ trợ tệp ảnh.');
        return false;
      }
      return true;
    });
    Promise.all(validFiles.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    }))).then((images) => setPortfolioImagesDraft((current) => [...current, ...images].slice(0, MAX_PORTFOLIO_IMAGES)));
    event.target.value = '';
  };
  const saveDetailedProfile = (event) => {
    event.preventDefault();
    updateUser({
      detailedProfile: detailedProfileDraft.trim(),
      profilePortfolioImages: portfolioImagesDraft,
    });
    setIsEditingDetailedProfile(false);
    toast.success('Hồ sơ năng lực đã được cập nhật.');
  };
  const saveProfileAlbums = (nextAlbums) => {
    const normalizedAlbums = normalizePhotoAlbums(nextAlbums);
    setProfileAlbums({ profileId: String(profile.id), albums: normalizedAlbums });
    saveStoredPhotoAlbums(profile.id, normalizedAlbums);

    if (!ownsProfile) return;
    updateUser({ photoAlbums: normalizedAlbums });
    profileService.update({ photo_albums: normalizedAlbums }).then((response) => {
      const savedAlbums = normalizePhotoAlbums(response?.user?.photoAlbums || response?.user?.photo_albums);
      if (savedAlbums.length) {
        setProfileAlbums({ profileId: String(profile.id), albums: savedAlbums });
        saveStoredPhotoAlbums(profile.id, savedAlbums);
        updateUser({ photoAlbums: savedAlbums });
      }
    }).catch(() => {
      // Keep the album available locally while older API versions add this field.
    });
  };
  const addAlbumMedia = async (event, setDraft) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const mediaFiles = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (mediaFiles.length !== files.length) toast.error('Album chỉ hỗ trợ tệp ảnh hoặc video.');
    if (!mediaFiles.length) {
      event.target.value = '';
      return;
    }

    setIsPreparingAlbumImages(true);
    try {
      const media = await Promise.all(mediaFiles.map(async (file, index) => {
        if (file.type.startsWith('video/')) {
          const storedVideo = await saveVideoMedia(file);
          return { id: `${Date.now()}-${index}-${file.name}`, src: storedVideo.src, storageKey: storedVideo.storageKey, type: 'video' };
        }
        let imageFile;
        try {
          const source = await createPersistentProfileImage(file, 1080);
          imageFile = await (await fetch(source)).blob();
        } catch {
          imageFile = file;
        }
        const storedImage = await saveImageMedia(imageFile);
        return { id: `${Date.now()}-${index}-${file.name}`, src: storedImage.src, storageKey: storedImage.storageKey, type: 'image' };
      }));
      setDraft((current) => ({ ...current, media: [...current.media, ...media] }));
    } catch (error) {
      toast.error(mediaFiles.some((file) => file.type.startsWith('video/'))
        ? (error?.message || 'Không thể chuẩn bị video. Vui lòng chọn lại tệp khác.')
        : 'Không thể chuẩn bị ảnh cho album. Vui lòng chọn lại ảnh khác.');
    } finally {
      setIsPreparingAlbumImages(false);
      event.target.value = '';
    }
  };
  const reorderAlbumDraftMedia = (fromIndex, toIndex) => {
    if (fromIndex == null || toIndex == null || fromIndex === toIndex) return;
    setAlbumDraft((current) => {
      const media = [...current.media];
      const [movedMedia] = media.splice(fromIndex, 1);
      media.splice(toIndex, 0, movedMedia);
      return { ...current, media };
    });
  };
  const beginAlbumDraftDrag = (event, index) => {
    albumDraftDragIndexRef.current = index;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };
  const moveAlbumDraftOnDrag = (event, index) => {
    event.preventDefault();
    const fromIndex = albumDraftDragIndexRef.current;
    if (fromIndex == null || fromIndex === index) return;
    reorderAlbumDraftMedia(fromIndex, index);
    albumDraftDragIndexRef.current = index;
  };
  const finishAlbumDraftDrag = () => {
    albumDraftDragIndexRef.current = null;
  };
  const createProfileAlbum = (event) => {
    event.preventDefault();
    const name = albumDraft.name.trim();
    if (!name) {
      toast.error('Hãy đặt tên cho album.');
      return;
    }
    if (!albumDraft.media.length) {
      toast.error('Hãy thêm ít nhất một ảnh hoặc video vào album.');
      return;
    }

    const description = albumDraft.description.trim();
    const album = {
      id: createPostId('profile-album'),
      name,
      description,
      media: albumDraft.media.map((item) => ({ ...item, description: item.description || '' })),
      createdAt: new Date().toISOString(),
    };
    if (!publishProfilePost(description, album.media)) return;
    saveProfileAlbums([...visibleProfileAlbums, album]);
    setAlbumDraft({ name: '', description: '', media: [] });
    setIsCreatingProfileAlbum(false);
    toast.success(`Đã tạo album “${name}”.`);
  };
  const publishProfilePost = (text, mediaItems = []) => {
    const post = {
      id: createPostId(),
      teacherId,
      authorId: user.id,
      authorName: profile.name,
      authorRole: user.role,
      authorAvatar: profile.avatar || '',
      authorLicenseVerificationStatus: user.licenseVerificationStatus || '',
      text: text.trim(),
      ...(mediaItems.length ? { mediaItems } : {}),
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
    };
    if (!savePost(post)) {
      toast.error('Không thể lưu ảnh vào bộ nhớ trình duyệt. Vui lòng thử đăng ít ảnh hơn hoặc tải lại trang.');
      return false;
    }
    refreshProfilePosts();
    return true;
  };
  const addMediaToProfileAlbum = (event) => {
    event.preventDefault();
    const album = visibleProfileAlbums.find((item) => item.id === albumAdditionDraft.albumId);
    if (!album) return;
    if (!albumAdditionDraft.media.length) {
      toast.error('Hãy thêm ít nhất một ảnh hoặc video.');
      return;
    }
    const description = albumAdditionDraft.description.trim();
    const media = albumAdditionDraft.media.map((item) => ({ ...item, description: item.description || '' }));
    const nextAlbum = { ...album, media: [...album.media, ...media] };
    if (!publishProfilePost(description, media)) return;
    saveProfileAlbums(visibleProfileAlbums.map((item) => item.id === album.id ? nextAlbum : item));
    setAlbumAdditionDraft({ albumId: '', description: '', media: [] });
    setIsAddingAlbumMedia(false);
    toast.success(`Đã thêm tệp vào album “${album.name}”.`);
  };
  const saveAlbumDescription = () => {
    if (!isCustomProfileAlbum) return;
    const description = albumDraft.description.trim();
    saveProfileAlbums(visibleProfileAlbums.map((album) => album.id === activeProfileAlbum.id ? { ...album, description } : album));
    setIsEditingAlbumDescription(false);
    toast.success('Đã cập nhật mô tả album.');
  };
  const deleteProfileAlbum = () => {
    if (!isCustomProfileAlbum || !ownsProfile) return;
    if (!window.confirm(`Xóa album “${activeProfileAlbum.name}”? Các bài đăng đã công khai vẫn được giữ.`)) return;

    saveProfileAlbums(visibleProfileAlbums.filter((album) => album.id !== activeProfileAlbum.id));
    setActiveProfileAlbumFilterId('all-media');
    if (hasLinkedAlbum) navigate(ROUTES.TEACHER_PROFILE(teacherId), { replace: true });
    setIsEditingAlbumDescription(false);
    refreshProfilePosts();
    toast.success(`Đã xóa album “${activeProfileAlbum.name}”.`);
  };
  const refreshProfilePosts = () => {
    setPosts(getPosts(teacherId).slice().sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)));
  };
  const getInteractionTarget = (post, mediaId = null) => mediaId ? getMediaItems(post).find((item) => item.id === mediaId) || null : post;
  const saveTargetInteraction = (postId, mediaId, updater) => {
    const isAlbumMediaFallback = Boolean(
      imageViewer?.albumId
      && imageViewer?.post?.id === postId
      && !mediaId,
    );
    if (isAlbumMediaFallback) {
      const album = visibleProfileAlbums.find((item) => item.id === imageViewer.albumId);
      const activeItem = album?.media.find((item) => isSameAlbumMedia(item, imageViewer.mediaItems?.[imageViewer.activeIndex]));
      if (!album || !activeItem) return;
      const fallbackPost = {
        ...imageViewer.post,
        media: activeItem,
        mediaItems: [activeItem],
        likes: activeItem.likes || [],
        comments: activeItem.comments || [],
      };
      const nextPost = updater(fallbackPost);
      const nextItem = {
        ...activeItem,
        likes: nextPost.likes || [],
        comments: nextPost.comments || [],
      };
      saveProfileAlbums(visibleProfileAlbums.map((item) => item.id === album.id
        ? { ...item, media: item.media.map((media) => isSameAlbumMedia(media, activeItem) ? nextItem : media) }
        : item));
      setImageViewer((current) => current ? {
        ...current,
        post: { ...nextPost, media: nextItem, mediaItems: [nextItem] },
        mediaItems: current.mediaItems.map((media) => isSameAlbumMedia(media, activeItem) ? nextItem : media),
      } : current);
      return;
    }
    if (mediaId) updatePostMediaItem(postId, mediaId, updater);
    else updatePost(postId, updater);
    refreshProfilePosts();
  };
  const handlePublish = (event) => {
    event.preventDefault();
    if (!postText.trim() && !media.length) { toast.error('Hãy viết nội dung hoặc chọn ảnh/video để đăng.'); return; }
    if (!publishProfilePost(postText, media)) return;
    const selectedAlbum = media.length && visibleProfileAlbums.find((album) => album.id === postAlbumId);
    if (selectedAlbum) {
      const albumMedia = media.map((item) => ({ ...item, description: item.description || '' }));
      saveProfileAlbums(visibleProfileAlbums.map((album) => album.id === selectedAlbum.id
        ? { ...album, media: [...album.media, ...albumMedia] }
        : album));
    }
    setPostText(''); setMedia([]); setPostAlbumId(''); setIsPostComposerOpen(false); toast.success('Bài viết đã được đăng.');
  };
  const createProfileAlbumFromComposer = ({ name, description = '' }) => {
    if (!ownsProfile) return null;
    const album = {
      id: createPostId('profile-album'),
      name,
      description,
      media: [],
      createdAt: new Date().toISOString(),
    };
    saveProfileAlbums([...visibleProfileAlbums, album]);
    return album;
  };
  const like = (postId, mediaId = null) => {
    if (!user) { toast.error('Vui lòng đăng nhập để tương tác.'); return; }
    const post = getPosts().find((item) => item.id === postId)
      || (imageViewer?.post?.id === postId ? imageViewer.post : null);
    const target = getInteractionTarget(post, mediaId);
    if (!target) return;
    const likes = target.likes || [];
    const hasLiked = likes.includes(user.id);
    if (!hasLiked && (post.authorId || post.teacherId) !== user.id) createNotification({ recipientId: post.authorId || post.teacherId, actorName: user.name || 'Một thành viên', actorAvatar: user.avatar || '', type: 'post_like', title: `${user.name || 'Một thành viên'} đã thích ${mediaId ? 'một mục trong album' : 'bài viết'} của bạn`, description: 'Bấm để xem bài viết.', link: ROUTES.POST_DETAIL(postId) });
    saveTargetInteraction(postId, mediaId, (current) => ({ ...current, likes: hasLiked ? likes.filter((id) => id !== user.id) : [...likes, user.id] }));
  };
  const comment = (event, postId, mediaId = null) => {
    event.preventDefault();
    if (!user) { toast.error('Vui lòng đăng nhập để bình luận.'); return; }
    const draftKey = `${postId}:${mediaId || 'post'}`;
    const text = commentText[draftKey]?.trim();
    const media = commentMedia[draftKey] || null;
    if (isEditingProfileDiscussion(postId, mediaId)) {
      if (!text) { toast.error('Bình luận không được để trống.'); return; }
      saveTargetInteraction(postId, mediaId, (current) => ({
        ...current,
        comments: (current.comments || []).map((item) => item.id !== editingDiscussion.commentId ? item : editingDiscussion.replyId
          ? { ...item, replies: (item.replies || []).map((reply) => reply.id === editingDiscussion.replyId ? { ...reply, text } : reply) }
          : { ...item, text }),
      }));
      setEditingDiscussion(null);
      setCommentText((current) => ({ ...current, [draftKey]: '' }));
      setCommentMedia((current) => ({ ...current, [draftKey]: null }));
      toast.success('Đã cập nhật bình luận.');
      return;
    }
    if (!text && !media) return;
    const targetPost = getPosts().find((post) => post.id === postId)
      || (imageViewer?.post?.id === postId ? imageViewer.post : null);
    if (targetPost && (targetPost.authorId || targetPost.teacherId) !== user.id) {
      createNotification({ recipientId: targetPost?.authorId || targetPost?.teacherId, actorName: user.name || 'Một thành viên', actorAvatar: user.avatar || '', type: 'post_comment', title: `${user.name || 'Một thành viên'} đã bình luận về bài viết của bạn`, description: text, link: ROUTES.POST_DETAIL(postId) });
    }
    saveTargetInteraction(postId, mediaId, (post) => ({ ...post, comments: [...(post.comments || []), { id: `comment-${Date.now()}`, author: user.name || 'Thành viên EduMatch', authorId: user.id, authorName: user.name || 'Thành viên EduMatch', authorRole: user.role || 'student', authorAvatar: user.avatar || '', text, media, replies: [], createdAt: new Date().toISOString() }] }));
    setCommentText((current) => ({ ...current, [draftKey]: '' }));
    setCommentMedia((current) => ({ ...current, [draftKey]: null }));
  };
  const openShareDialog = (post, mediaItem = null) => {
    if (!user) { toast.error('Vui lòng đăng nhập để chia sẻ bài viết.'); return; }
    setShareTarget({ post, mediaId: mediaItem?.id || null });
    setShareText('');
  };
  const openImageViewer = (post, author, mediaItems, activeIndex = 0) => {
    setImageViewer({ post, author, mediaItems, activeIndex });
  };
  const sharePost = (event) => {
    event.preventDefault();
    if (!shareTarget || !user) return;
    const { post, mediaId } = shareTarget;
    const postAuthor = (item) => ({
      id: item.authorId || item.teacherId || '',
      name: item.authorName || item.author || profile.name,
      role: item.authorRole || profile.role || 'student',
      avatar: item.authorAvatar || profile.avatar || '',
    });
    const originalPost = getOriginalSharedPost(post, getPosts(), postAuthor);
    const sourceAuthor = originalPost?.author || postAuthor(post);
    const originalMediaItems = getMediaItems(originalPost);
    const selectedMedia = mediaId ? originalMediaItems.find((item) => item.id === mediaId) : null;
    const sharedPost = {
      id: createPostId('post-share'),
      teacherId: user.id,
      authorId: user.id,
      authorName: user.name || 'Thành viên EduMatch',
      authorRole: user.role || 'student',
      authorAvatar: user.avatar || '',
      text: shareText.trim(),
      sharedPost: {
        id: originalPost?.id || post.id,
        ...(mediaId ? { mediaId } : {}),
        author: sourceAuthor,
        text: originalPost?.text || '',
        media: selectedMedia || originalPost?.media || null,
        mediaItems: selectedMedia ? [selectedMedia] : originalMediaItems,
      },
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
    };
    savePost(sharedPost);
    if (ownsProfile) refreshProfilePosts();
    setShareTarget(null);
    setShareText('');
    toast.success('Bài viết đã được chia sẻ lên trang cá nhân của bạn.');
  };
  const openProfileReply = (postId, commentId, mediaId = null) => {
    if (!user) { toast.error('Vui lòng đăng nhập để trả lời bình luận.'); return; }
    setReplyTarget({ postId, commentId, mediaId });
    setReplyText('');
    setReplyMedia(null);
  };
  const replyToProfileComment = (event) => {
    event.preventDefault();
    if (!replyTarget || !user) return;
    const text = replyText.trim();
    if (!text && !replyMedia) return;
    const targetPost = getPosts().find((post) => post.id === replyTarget.postId)
      || (imageViewer?.post?.id === replyTarget.postId ? imageViewer.post : null);
    const parentComment = getInteractionTarget(targetPost, replyTarget.mediaId)?.comments?.find((item) => item.id === replyTarget.commentId);
    const reply = { id: createPostId('reply'), author: user.name || 'Thành viên EduMatch', authorId: user.id, authorName: user.name || 'Thành viên EduMatch', authorRole: user.role || 'student', authorAvatar: user.avatar || '', text, media: replyMedia, likes: [], createdAt: new Date().toISOString() };
    if (parentComment?.authorId && parentComment.authorId !== user.id) {
      createNotification({ recipientId: parentComment.authorId, actorName: user.name || 'Một thành viên', actorAvatar: user.avatar || '', type: 'comment_reply', title: `${user.name || 'Một thành viên'} đã trả lời bình luận của bạn`, description: text, link: ROUTES.POST_DETAIL(replyTarget.postId) });
    }
    saveTargetInteraction(replyTarget.postId, replyTarget.mediaId, (post) => ({ ...post, comments: (post.comments || []).map((item) => item.id === replyTarget.commentId ? { ...item, replies: [...(item.replies || []), reply] } : item) }));
    setReplyTarget(null);
    setReplyText('');
    setReplyMedia(null);
  };
  const toggleProfileCommentLike = (postId, commentId, replyId = null, mediaId = null) => {
    if (!user) { toast.error('Vui lòng đăng nhập để thích bình luận.'); return; }
    const post = getPosts().find((item) => item.id === postId)
      || (imageViewer?.post?.id === postId ? imageViewer.post : null);
    const target = getInteractionTarget(post, mediaId);
    const comment = target?.comments?.find((item) => item.id === commentId);
    const reply = comment?.replies?.find((item) => item.id === replyId);
    const likes = (reply || comment)?.likes || [];
    saveTargetInteraction(postId, mediaId, (post) => ({
      ...post,
      comments: (post.comments || []).map((item) => {
        if (item.id !== commentId) return item;
        if (!replyId) return { ...item, likes: likes.includes(user.id) ? likes.filter((id) => id !== user.id) : [...likes, user.id] };
        return {
          ...item,
          replies: (item.replies || []).map((reply) => {
            if (reply.id !== replyId) return reply;
            return { ...reply, likes: likes.includes(user.id) ? likes.filter((id) => id !== user.id) : [...likes, user.id] };
          }),
        };
      }),
    }));
  };
  const ownsContent = (authorId) => Boolean(user?.id != null && String(authorId) === String(user.id));
  const discussionKey = (postId, mediaId = null) => `${postId}:${mediaId || 'post'}`;
  const isEditingProfileDiscussion = (postId, mediaId = null) => Boolean(
    editingDiscussion
    && String(editingDiscussion.postId) === String(postId)
    && String(editingDiscussion.mediaId || '') === String(mediaId || ''),
  );
  const cancelProfileDiscussionEdit = (postId, mediaId = null) => {
    if (!isEditingProfileDiscussion(postId, mediaId)) return;
    const draftKey = discussionKey(postId, mediaId);
    setEditingDiscussion(null);
    setCommentText((current) => ({ ...current, [draftKey]: '' }));
    setCommentMedia((current) => ({ ...current, [draftKey]: null }));
  };
  const viewerInteractionPostId = imageViewer?.interactionPostIds?.[imageViewer?.activeIndex || 0] || imageViewer?.post?.id;
  const viewerPost = imageViewer ? getPosts().find((post) => post.id === viewerInteractionPostId) || imageViewer.post : null;
  const viewerAuthor = imageViewer?.author || (viewerPost ? { id: viewerPost.authorId || viewerPost.teacherId || '', name: viewerPost.authorName || viewerPost.author || profile.name, role: viewerPost.authorRole || profile.role, avatar: viewerPost.authorAvatar || profile.avatar || '' } : null);
  const viewerMediaItems = imageViewer?.mediaItems?.length ? imageViewer.mediaItems : getMediaItems(viewerPost);
  const viewerMedia = viewerMediaItems.length > 1 ? viewerMediaItems[imageViewer?.activeIndex || 0] : null;
  const viewerInteractionMedia = viewerMedia ? getMediaItems(viewerPost).find((item) => isSameAlbumMedia(item, viewerMedia)) || viewerMedia : null;
  const viewerInteractionTarget = viewerInteractionMedia || viewerPost;
  const viewerDiscussionKey = viewerMedia ? `${viewerPost.id}:${viewerMedia.id}` : `${viewerPost?.id}:post`;
  const isEditingViewerDiscussion = isEditingProfileDiscussion(viewerPost?.id, viewerMedia?.id);
  const imageViewerDiscussion = viewerInteractionTarget ? <><div className="post-image-dialog__comments">{(viewerInteractionTarget.comments || []).map((item) => {
    const isReplying = replyTarget?.postId === viewerPost.id && replyTarget?.commentId === item.id && replyTarget?.mediaId === viewerMedia?.id;
    const authorName = item.authorName || item.author || 'Thành viên EduMatch';
    const isCommentLiked = (item.likes || []).includes(user?.id);
    return <div className="post-image-dialog__comment" key={item.id}>{item.authorId ? <Link to={ROUTES.TEACHER_PROFILE(item.authorId)} onClick={(event) => reloadCurrentProfile(event, item.authorId)}><strong>{authorName}</strong></Link> : <strong>{authorName}</strong>}{item.text && <p>{item.text}</p>}{item.media && (item.media.type === 'video' ? <video className="discussion-image" src={item.media.src} controls preload="metadata" /> : <img className="discussion-image" src={item.media.src} alt={`Ảnh đính kèm từ ${authorName}`} />)}<div className="post-image-dialog__comment-actions"><button type="button" className={isCommentLiked ? 'is-liked' : ''} onClick={() => toggleProfileCommentLike(viewerPost.id, item.id, null, viewerMedia?.id)}>{isCommentLiked ? 'Đã thích' : 'Thích'}</button><button type="button" onClick={() => openProfileReply(viewerPost.id, item.id, viewerMedia?.id)}>Trả lời</button>{ownsContent(item.authorId) && <ContentMenu id={`viewer-profile-comment-${item.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editProfileComment(viewerPost.id, item.id, null, viewerMedia?.id)} onDelete={() => removeProfileComment(viewerPost.id, item.id, null, viewerMedia?.id)} label="bình luận" />}<ReactionCount count={item.likes?.length} label="Xem những người đã thích bình luận này" onClick={() => setLikesTarget({ ids: item.likes, label: 'Những người đã thích bình luận này' })} /></div>{(item.replies || []).map((reply) => { const replyAuthor = reply.authorName || reply.author || 'Thành viên EduMatch'; const isReplyLiked = (reply.likes || []).includes(user?.id); return <div className="post-image-dialog__comment-reply" key={reply.id}>{reply.authorId ? <Link to={ROUTES.TEACHER_PROFILE(reply.authorId)} onClick={(event) => reloadCurrentProfile(event, reply.authorId)}><strong>{replyAuthor}</strong></Link> : <strong>{replyAuthor}</strong>}{reply.text && <p>{reply.text}</p>}{reply.media && (reply.media.type === 'video' ? <video className="discussion-image" src={reply.media.src} controls preload="metadata" /> : <img className="discussion-image" src={reply.media.src} alt={`Ảnh đính kèm từ ${replyAuthor}`} />)}<div className="post-image-dialog__comment-actions"><button type="button" className={isReplyLiked ? 'is-liked' : ''} onClick={() => toggleProfileCommentLike(viewerPost.id, item.id, reply.id, viewerMedia?.id)}>{isReplyLiked ? 'Đã thích' : 'Thích'}</button>{ownsContent(reply.authorId) && <ContentMenu id={`viewer-profile-reply-${reply.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editProfileComment(viewerPost.id, item.id, reply.id, viewerMedia?.id)} onDelete={() => removeProfileComment(viewerPost.id, item.id, reply.id, viewerMedia?.id)} label="phản hồi" />}<ReactionCount count={reply.likes?.length} label="Xem những người đã thích phản hồi này" onClick={() => setLikesTarget({ ids: reply.likes, label: 'Những người đã thích phản hồi này' })} /></div></div>; })}{isReplying && <form className="post-comment-form post-image-dialog__reply-form" onSubmit={replyToProfileComment}><textarea autoFocus value={replyText} onChange={(event) => setReplyText(event.target.value)} onKeyDown={submitOnPlainEnter} placeholder={`Trả lời ${authorName}...`} rows="2" /><ImageAttachment id={`viewer-profile-reply-image-${item.id}`} value={replyMedia} onChange={setReplyMedia} label="Tệp" /><button type="submit">Gửi</button></form>}</div>;
  })}</div><form className="post-comment-form" onSubmit={(event) => comment(event, viewerPost.id, viewerMedia?.id)}><textarea autoFocus={isEditingViewerDiscussion || !replyTarget || replyTarget.postId !== viewerPost.id} value={commentText[viewerDiscussionKey] || ''} onChange={(event) => setCommentText((current) => ({ ...current, [viewerDiscussionKey]: event.target.value }))} onKeyDown={submitOnPlainEnter} placeholder={isEditingViewerDiscussion ? 'Chỉnh sửa bình luận...' : 'Viết bình luận...'} rows="1" />{!isEditingViewerDiscussion && <ImageAttachment id={`viewer-profile-comment-image-${viewerDiscussionKey}`} value={commentMedia[viewerDiscussionKey] || null} onChange={(media) => setCommentMedia((current) => ({ ...current, [viewerDiscussionKey]: media }))} label="Tệp" />}{isEditingViewerDiscussion && <button type="button" onClick={() => cancelProfileDiscussionEdit(viewerPost.id, viewerMedia?.id)}>Hủy</button>}<button type="submit">{isEditingViewerDiscussion ? 'Lưu' : 'Gửi'}</button></form></> : null;
  const editProfilePost = (post) => {
    if (!ownsContent(post.authorId || post.teacherId)) return;
    setEditingPostId(post.id);
    setEditingPostText(post.text || '');
    setEditingPostMedia(getMediaItems(post));
    setOpenContentMenu(null);
  };
  const cancelProfilePostEdit = () => {
    setEditingPostId(null);
    setEditingPostText('');
    setEditingPostMedia([]);
  };
  const saveProfilePostEdit = (event, post) => {
    event.preventDefault();
    const text = editingPostText.trim();
    if (!text && !editingPostMedia.length) {
      toast.error('Bài viết cần có nội dung hoặc ảnh/video.');
      return;
    }
    updatePost(post.id, (current) => ({ ...current, text, mediaItems: editingPostMedia, media: editingPostMedia[0] || null }));
    refreshProfilePosts();
    cancelProfilePostEdit();
    toast.success('Đã cập nhật bài viết.');
  };
  const removeProfilePost = (post) => {
    if (!ownsContent(post.authorId || post.teacherId) || !window.confirm('Xóa bài viết này?')) return;
    deletePost(post.id);
    refreshProfilePosts();
  };
  const editProfileComment = (postId, commentId, replyId = null, mediaId = null) => {
    const post = posts.find((item) => item.id === postId);
    const comment = getInteractionTarget(post, mediaId)?.comments?.find((item) => item.id === commentId);
    const target = replyId ? comment?.replies?.find((item) => item.id === replyId) : comment;
    if (!target || !ownsContent(target.authorId)) return;
    const draftKey = discussionKey(postId, mediaId);
    setEditingDiscussion({ postId, commentId, replyId, mediaId });
    setCommentText((current) => ({ ...current, [draftKey]: target.text || '' }));
    setCommentMedia((current) => ({ ...current, [draftKey]: null }));
    requestAnimationFrame(() => {
      const dialogInput = document.querySelector('.post-image-dialog .post-comment-form textarea');
      (dialogInput || document.getElementById(`profile-comment-${postId}`))?.focus();
    });
  };
  const removeProfileComment = (postId, commentId, replyId = null, mediaId = null) => {
    const post = posts.find((item) => item.id === postId);
    const comment = getInteractionTarget(post, mediaId)?.comments?.find((item) => item.id === commentId);
    const target = replyId ? comment?.replies?.find((item) => item.id === replyId) : comment;
    if (!target || !ownsContent(target.authorId) || !window.confirm('Xóa bình luận này?')) return;
    saveTargetInteraction(postId, mediaId, (current) => ({ ...current, comments: replyId ? (current.comments || []).map((item) => item.id === commentId ? { ...item, replies: (item.replies || []).filter((reply) => reply.id !== replyId) } : item) : (current.comments || []).filter((item) => item.id !== commentId) }));
  };
  const messageProfile = async () => {
    if (!isAuthenticated) { toast.error('Vui lòng đăng nhập để nhắn tin.'); navigate(ROUTES.LOGIN); return; }
    if (ownsProfile || chatOpening.current) return;
    chatOpening.current = true;
    try {
      const conversation = await chatService.startDirect(profile.id);
      navigate(`${ROUTES.MESSAGES}?conversation=${conversation.id}`);
    } catch (error) { toast.error(chatError(error)); }
    finally { chatOpening.current = false; }
  };
  const trustProfile = () => {
    if (!isAuthenticated) { toast.error('Vui lòng đăng nhập để tin tưởng hồ sơ này.'); navigate(ROUTES.LOGIN); return; }
    const added = toggleProviderTrust(user.id, profile.id);
    if (added) {
      trackProviderAffinity(user.id, profile.id, 'saved-profile', 4);
      createNotification({ recipientId: profile.id, actorName: user.name || 'Một thành viên', actorAvatar: user.avatar || '', type: 'profile_like', title: `${user.name || 'Một thành viên'} đã tin tưởng hồ sơ của bạn`, description: 'Uy tín của bạn được cộng đồng EduMatch ghi nhận.', link: ROUTES.TEACHER_PROFILE(profile.id) });
    }
    setTrustRefresh((value) => value + 1);
    toast.success(added ? 'Đã thêm vào danh sách tin tưởng.' : 'Đã bỏ tin tưởng hồ sơ này.');
  };

  const coverStyle = profile.coverImage ? { backgroundImage: `url(${profile.coverImage})` } : undefined;
  const profileType = isCenterProfile ? 'TRUNG TÂM ĐÀO TẠO' : isTeacherProfile ? 'GIÁO VIÊN' : 'HỌC VIÊN';
  const subtitle = isCenterProfile ? 'Đối tác đào tạo của EduMatch' : isTeacherProfile ? (profile.dob ? `${getAge(profile.dob)} tuổi` : 'Giáo viên EduMatch') : 'Học viên EduMatch';
  const openCommentImage = (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.matches('.discussion-image, .review-media')) return;
    setExpandedCommentImage({ src: image.currentSrc || image.src, alt: image.alt || 'Ảnh đính kèm' });
  };
  const reloadCurrentProfile = (event, profileId) => {
    if (String(profileId) !== String(teacherId)) return;
    event.preventDefault();
    window.location.reload();
  };

  return <div onClickCapture={openCommentImage} className={hasSubmittedVerification ? 'has-submitted-verification' : ''}><section className="learning-page teacher-public-page"><div className="learning-container">
    <header className={`teacher-cover ${profile.coverImage ? 'has-custom-cover' : ''}`} style={coverStyle}>
      <div className="teacher-cover__avatar"><ProfileAvatar src={profile.avatar} alt={`Ảnh đại diện của ${profile.name}`} role={profile.role} size={35} />{ownsProfile && <button type="button" className={`profile-avatar-upload ${profileImageUploadField === 'avatar' ? 'is-uploading' : ''}`} title={profileImageUploadField === 'avatar' ? 'Đang tải ảnh đại diện' : 'Cập nhật ảnh đại diện'} disabled={Boolean(profileImageUploadField)} onClick={() => setProfileImageSourceField('avatar')}>{profileImageUploadField === 'avatar' ? <LoaderCircle className="profile-upload-spinner" size={15} /> : <Camera size={15} />}</button>}<input ref={avatarImageInputRef} className="profile-image-upload-input" type="file" accept="image/*" disabled={Boolean(profileImageUploadField)} onChange={(event) => chooseProfileImage(event, 'avatar')} /></div>
      <div><span>HỒ SƠ {profileType}</span><h1>{profile.name}</h1>{subtitle && <p>{subtitle}</p>}<div className="teacher-cover__status-list">{isEducationProviderProfile && (trustCount < 3 ? <small className="teacher-cover__trust-count is-new">Mới trên EduMatch</small> : <button type="button" className="teacher-cover__trust-count" onClick={() => setLikesTarget({ ids: trustUserIds, title: 'Lượt tin tưởng', label: 'Những thành viên đã tin tưởng hồ sơ này', emptyText: 'Danh sách thành viên tin tưởng đang được cập nhật.' })}><Heart size={14} fill="currentColor" /> {trustCount} lượt tin tưởng</button>)}<VerifiedBadge userId={profile.id} />{isCenterProfile && profile.licenseVerificationStatus === 'verified' && <span className="center-verification-badge"><BadgeCheck size={14} /> Đã xác thực pháp lý</span>}</div></div>
      {ownsProfile && <><button type="button" className={`profile-cover-upload teacher-cover__cover-upload ${profileImageUploadField === 'coverImage' ? 'is-uploading' : ''}`} disabled={Boolean(profileImageUploadField)} onClick={() => setProfileImageSourceField('coverImage')}>{profileImageUploadField === 'coverImage' ? <LoaderCircle className="profile-upload-spinner" size={16} /> : <ImagePlus size={16} />} {profileImageUploadField === 'coverImage' ? 'Đang tải ảnh…' : 'Ảnh bìa'}</button><input ref={coverImageInputRef} className="profile-image-upload-input" type="file" accept="image/*" disabled={Boolean(profileImageUploadField)} onChange={(event) => chooseProfileImage(event, 'coverImage')} /></>}
    </header>
    <div className="teacher-public-grid"><aside className="teacher-bio"><h2>{isEducationProviderProfile ? 'Thông tin' : 'Thông Tin Cá Nhân'}</h2><div className="teacher-bio__overview"><h3>Hồ sơ năng lực</h3>{ownsProfile && <button type="button" className="teacher-bio__edit-link" onClick={openProfileEditor}>Chỉnh sửa</button>}</div><p className="teacher-bio__summary">{shortProfileIntro}</p>{isEducationProviderProfile && <><h3>Lĩnh vực giảng dạy</h3><p className="teacher-bio__summary">{profile.teachingField || 'Đang cập nhật'}</p></>}{isCenterProfile && <><h3>Năm thành lập</h3><p className="teacher-bio__summary">{profile.foundedYear || 'Đang cập nhật'}</p></>}{isTeacherProfile && <><h3>Kinh nghiệm</h3><p className="teacher-bio__summary">{profileExperience || 'Đang cập nhật'}</p><h3>Bằng cấp, chứng chỉ</h3><p className="teacher-bio__summary">{profileQualifications || 'Đang cập nhật'}</p></>}<button type="button" className="teacher-bio__view-all" onClick={() => setIsViewingProfileSummary(true)}>Xem tất cả</button>{publicPhone && <><h3>Điện thoại liên hệ</h3><a className="teacher-bio__phone" href={`tel:${profile.phone.replace(/\s/g, '')}`}><Phone size={14} /> {profile.phone}</a></>}{ownsProfile && canCreateCourse && <div className="teacher-bio__actions"><Link className="teacher-bio__verify" to={ROUTES.VERIFICATION}><FileCheck2 size={15} /> Hồ sơ xác minh</Link><Link className="teacher-bio__add-course" to={ROUTES.CREATE_COURSE}><Plus size={16} /> Thêm khóa học</Link></div>}{isEducationProviderProfile && <section className="teacher-bio__courses" aria-labelledby="profile-open-courses"><div className="teacher-bio__courses-heading"><div><BookOpen size={16} aria-hidden="true" /><h3 id="profile-open-courses">Khóa học đang mở</h3></div>{courses.length > 0 && <span>{courses.length}</span>}</div>{courses.length > 0 ? <><div className="teacher-bio__course-list">{displayedProfileCourses.map((course) => { const isExpanded = Boolean(expandedProfileCourseIds[course.id]); return <div className={`teacher-bio__course-item ${isExpanded ? 'is-expanded' : ''}`} key={course.id}><Link className="teacher-bio__course-link" to={ROUTES.COURSE_DETAIL(course.id)}><span>{course.title}</span></Link><button type="button" className="teacher-bio__course-expand" aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Thu gọn' : 'Xem đầy đủ'} tên khóa học`} onClick={() => setExpandedProfileCourseIds((current) => ({ ...current, [course.id]: !current[course.id] }))}><ChevronDown size={16} aria-hidden="true" /></button></div>; })}</div>{courses.length > 2 && <button type="button" className="teacher-bio__courses-toggle" onClick={() => setShowAllProfileCourses((current) => !current)}>{showAllProfileCourses ? 'Thu gọn' : `Xem tất cả ${courses.length} khóa học`}</button>}</> : <p className="teacher-bio__courses-empty">Chưa có khóa học đang mở.</p>}</section>}</aside>
    <main className="teacher-feed"><section className="feed-heading teacher-feed__heading"><div className="teacher-feed__title"><h2>Hoạt động</h2><button type="button" className="teacher-feed__album-link" onClick={() => { selectProfileAlbum('all-media'); setIsViewingProfileAlbums(true); }}><Images size={16} /> Album ảnh <span>{profileAlbumMedia.length}</span></button></div>{!ownsProfile && <div className="teacher-cover__public-actions"><button type="button" className="teacher-cover__message" onClick={messageProfile}><MessageCircle size={16} /> Nhắn tin</button><button type="button" className={`teacher-cover__trust ${trustedByCurrentUser ? 'is-trusted' : ''}`} onClick={trustProfile}><Heart size={16} fill={trustedByCurrentUser ? 'currentColor' : 'none'} /> {trustedByCurrentUser ? 'Đã tin tưởng' : 'Tin tưởng'}</button></div>}</section>
      {ownsProfile && <PostComposerTrigger avatar={profile.avatar} role={profile.role} placeholder="Hãy chia sẻ để học viên hiểu hơn về bạn" onOpen={() => setIsPostComposerOpen(true)} />}
      {posts.length ? renderedPosts.map((post) => {
        const likes = post.likes || [];
        const comments = post.comments || [];
        const isEditingPostDiscussion = isEditingProfileDiscussion(post.id);
        const postMediaItems = getMediaItems(post);
        const postAuthor = (item) => {
          const authorId = item.authorId || item.teacherId || '';
          const isProfileOwner = String(authorId) === String(profile.id);
          return {
            id: authorId,
            name: isProfileOwner ? profile.name : item.authorName || item.author || profile.name,
            role: item.authorRole || profile.role || 'student',
            avatar: isProfileOwner ? profile.avatar || '' : item.authorAvatar || '',
          };
        };
        const author = postAuthor(post);
        const originalSharedPost = post.sharedPost ? getOriginalSharedPost(post, getPosts(), postAuthor) : null;
        const sourceMediaItems = getMediaItems(originalSharedPost);
        const sharedMediaItems = originalSharedPost?.mediaId ? sourceMediaItems.filter((item) => item.id === originalSharedPost.mediaId) : sourceMediaItems;
        const shareIds = [...new Set(getPosts().filter((candidate) => candidate.sharedPost?.id === post.id && !candidate.sharedPost?.mediaId).map((candidate) => candidate.authorId || candidate.teacherId).filter(Boolean))];
        const shareCount = shareIds.length;
        return <article className="social-post" key={post.id}>
          <div className="social-post__head"><ProfileAvatar src={author.avatar} alt={`Ảnh đại diện của ${author.name}`} role={author.role} size={17} /><div><Link className="social-post__author" to={ROUTES.TEACHER_PROFILE(post.authorId || post.teacherId || profile.id)} onClick={(event) => reloadCurrentProfile(event, post.authorId || post.teacherId || profile.id)}>{author.name}</Link><VerifiedBadge userId={post.authorId || post.teacherId || profile.id} />{isCenterProfile && profile.licenseVerificationStatus === 'verified' && <small className="post-verification-badge"><BadgeCheck size={12} /> Đã xác thực pháp lý</small>}<small>{formatPublishedAt(post.createdAt)}</small></div></div>
          {ownsContent(post.authorId || post.teacherId) && <ContentMenu id={`post-${post.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editProfilePost(post)} onDelete={() => removeProfilePost(post)} label="bài viết" />}
          {editingPostId === post.id ? <InlinePostEditor draft={editingPostText} onDraftChange={setEditingPostText} media={editingPostMedia} onMediaChange={setEditingPostMedia} onCancel={cancelProfilePostEdit} onSave={(event) => saveProfilePostEdit(event, post)} attachmentId={`profile-edit-post-media-${post.id}`} /> : post.text && <p>{post.text}</p>}
          {originalSharedPost && <div className="shared-post"><span>Đã chia sẻ <Link to={ROUTES.POST_DETAIL(originalSharedPost.id)}>bài viết gốc</Link> của</span>{originalSharedPost.author?.id ? <Link className="shared-post__author" to={ROUTES.TEACHER_PROFILE(originalSharedPost.author.id)}>{originalSharedPost.author.name}</Link> : <strong>{originalSharedPost.author?.name || 'Thành viên EduMatch'}</strong>}<p>{originalSharedPost.text || 'Bài viết gốc không có nội dung văn bản.'}</p>{sharedMediaItems.length > 0 && <div className={`social-post__media ${sharedMediaItems.length > 1 ? 'is-album' : ''}`}>{sharedMediaItems.map((item, index) => item.type === 'video' ? <div className="post-media-trigger post-media-trigger--video" key={item.id || `${item.src}-${index}`}><video src={item.src} controls playsInline preload="metadata" /></div> : <button type="button" className="post-media-trigger" key={item.id || `${item.src}-${index}`} onClick={() => { const sourcePost = getPosts().find((entry) => entry.id === originalSharedPost.id) || { ...originalSharedPost, likes: [], comments: [] }; const sourceItems = getMediaItems(sourcePost); openImageViewer(sourcePost, originalSharedPost.author, sourceItems, Math.max(0, sourceItems.findIndex((sourceItem) => sourceItem.id === item.id))); }} aria-label={`Mở ảnh chia sẻ ${index + 1}`}><img src={item.src} alt={`Ảnh chia sẻ ${index + 1}`} /></button>)}</div>}</div>}
          {postMediaItems.length > 0 && <div className={`social-post__media ${postMediaItems.length > 1 ? 'is-album' : ''}`}>{postMediaItems.map((item, index) => item.type === 'video' ? <div className="post-media-trigger post-media-trigger--video" key={item.id || `${item.src}-${index}`}><video src={item.src} controls playsInline preload="metadata" /></div> : <button type="button" className="post-media-trigger" key={item.id || `${item.src}-${index}`} onClick={() => openImageViewer(post, postAuthor(post), postMediaItems, index)} aria-label={`Mở ảnh ${index + 1}`}><img src={item.src} alt={`Ảnh ${index + 1} do ${profile.name} chia sẻ`} /></button>)}</div>}
          <div className="social-post__summary"><div>{likes.length ? <button type="button" className="social-likes-count" onClick={() => setLikesTarget({ ids: likes, label: 'Những người đã thích bài viết này' })}>{likes.length} lượt thích</button> : <span>Hãy là người đầu tiên thích bài viết này</span>}{comments.length > 0 && <span>{comments.length} bình luận</span>}{shareCount > 0 && <button type="button" className="social-likes-count" onClick={() => setLikesTarget({ ids: shareIds, kind: 'share', title: 'Lượt chia sẻ', label: 'Những người đã chia sẻ bài viết này', emptyText: 'Chưa có lượt chia sẻ.' })}>{shareCount} lượt chia sẻ</button>}</div></div>
          <div className="social-post__actions"><button onClick={() => like(post.id)} className={likes.includes(user?.id) ? 'is-liked' : ''}><Heart size={17} fill={likes.includes(user?.id) ? 'currentColor' : 'none'} /> Thích</button><button type="button" onClick={() => document.getElementById(`profile-comment-${post.id}`)?.focus()}><MessageCircle size={16} /> Bình luận</button><button type="button" onClick={() => openShareDialog(post)}><Share2 size={16} /> Chia sẻ</button></div>
          {comments.map((item) => {
            const commentLikes = item.likes || [];
            const isCommentLiked = commentLikes.includes(user?.id);
            const isReplying = replyTarget?.postId === post.id && replyTarget?.commentId === item.id;
            return <div className="post-comment" key={item.id}><div className="post-comment__head">{item.authorId ? <Link className="post-comment__author" to={ROUTES.TEACHER_PROFILE(item.authorId)} onClick={(event) => reloadCurrentProfile(event, item.authorId)}>{item.authorName || item.author}</Link> : <strong>{item.author}</strong>}{ownsContent(item.authorId) && <ContentMenu id={`comment-${item.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editProfileComment(post.id, item.id)} onDelete={() => removeProfileComment(post.id, item.id)} label="bình luận" />}</div>{item.text && <span>{item.text}</span>}{item.media && (item.media.type === 'video' ? <video className="review-media" src={item.media.src} controls preload="metadata" /> : <img className="review-media" src={item.media.src} alt={`Ảnh đính kèm từ ${item.author}`} />)}<div className="post-comment__reaction"><time className="post-comment__time">{formatPublishedAt(item.createdAt)}</time><button type="button" className={`post-comment__like ${isCommentLiked ? 'is-liked' : ''}`} onClick={() => toggleProfileCommentLike(post.id, item.id)}>{isCommentLiked ? 'Đã thích' : 'Thích'}</button><button type="button" className="post-comment__reply-button" onClick={() => openProfileReply(post.id, item.id)}>Trả lời</button><ReactionCount count={commentLikes.length} label="Xem những người đã thích bình luận này" onClick={() => setLikesTarget({ ids: commentLikes, label: 'Những người đã thích bình luận này' })} /></div>{(item.replies || []).map((reply) => { const replyLikes = reply.likes || []; const isReplyLiked = replyLikes.includes(user?.id); return <div className="post-comment__reply" key={reply.id}><strong>{reply.authorId ? <Link className="post-comment__author" to={ROUTES.TEACHER_PROFILE(reply.authorId)} onClick={(event) => reloadCurrentProfile(event, reply.authorId)}>{reply.authorName || reply.author}</Link> : reply.author}</strong>{reply.text && <span>{reply.text}</span>}{reply.media && (reply.media.type === 'video' ? <video className="review-media" src={reply.media.src} controls preload="metadata" /> : <img className="review-media" src={reply.media.src} alt={`Ảnh đính kèm từ ${reply.author}`} />)}<div className="post-comment__reaction"><time className="post-comment__time">{formatPublishedAt(reply.createdAt)}</time><button type="button" className={`post-comment__like ${isReplyLiked ? 'is-liked' : ''}`} onClick={() => toggleProfileCommentLike(post.id, item.id, reply.id)}>{isReplyLiked ? 'Đã thích' : 'Thích'}</button>{ownsContent(reply.authorId) && <ContentMenu id={`reply-${reply.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editProfileComment(post.id, item.id, reply.id)} onDelete={() => removeProfileComment(post.id, item.id, reply.id)} label="phản hồi" />}<ReactionCount count={replyLikes.length} label="Xem những người đã thích phản hồi này" onClick={() => setLikesTarget({ ids: replyLikes, label: 'Những người đã thích phản hồi này' })} /></div></div>; })}{isReplying && <form className="post-comment-form post-comment-form--reply" onSubmit={replyToProfileComment}><textarea autoFocus value={replyText} onChange={(event) => setReplyText(event.target.value)} onKeyDown={submitOnPlainEnter} placeholder={`Trả lời ${item.authorName || item.author}...`} rows="1" /><ImageAttachment id={`profile-reply-image-${post.id}-${item.id}`} value={replyMedia} onChange={setReplyMedia} label="Tệp" /><button type="submit">Gửi</button></form>}</div>;
          })}
          <form className="post-comment-form" onSubmit={(event) => comment(event, post.id)}><textarea id={`profile-comment-${post.id}`} value={commentText[`${post.id}:post`] || ''} onChange={(event) => setCommentText((current) => ({ ...current, [`${post.id}:post`]: event.target.value }))} onKeyDown={submitOnPlainEnter} placeholder={isEditingPostDiscussion ? 'Chỉnh sửa bình luận...' : 'Viết bình luận...'} rows="1" />{!isEditingPostDiscussion && <ImageAttachment id={`profile-comment-image-${post.id}`} value={commentMedia[`${post.id}:post`] || null} onChange={(media) => setCommentMedia((current) => ({ ...current, [`${post.id}:post`]: media }))} label="Tệp" />}{isEditingPostDiscussion && <button type="button" onClick={() => cancelProfileDiscussionEdit(post.id)}>Hủy</button>}<button type="submit">{isEditingPostDiscussion ? 'Lưu' : 'Gửi'}</button></form>
        </article>;
      }) : <div className="feed-empty"><Star size={23} /><p>{isCenterProfile ? 'Trung tâm chưa có bài viết nào.' : isTeacherProfile ? 'Giáo viên chưa có bài viết nào.' : 'Học viên chưa có bài viết nào.'}</p></div>}
      {renderedPosts.length < posts.length && <div ref={loadMorePostsRef} className="teacher-feed__load-more" aria-live="polite">Đang tải thêm bài viết…</div>}
    </main></div>
  </div></section>
    <LikesModal target={likesTarget} onClose={() => setLikesTarget(null)} />
    <Modal open={isViewingProfileAlbums || hasLinkedAlbum} onClose={closeProfileAlbums} title={isCustomProfileAlbum ? activeProfileAlbum.name : activeProfileAlbum.name === 'Tất cả' ? 'Ảnh' : activeProfileAlbum.name} size="xl" className="profile-album-dialog" footer={ownsProfile ? <><button type="button" className="profile-album-create__cancel" onClick={() => { setAlbumDraft({ name: '', description: '', media: [] }); closeProfileAlbums(); setIsCreatingProfileAlbum(true); }}><ImagePlus size={16} /> Tạo album</button>{isCustomProfileAlbum && <button type="button" className="profile-album-create__submit" onClick={() => { setAlbumAdditionDraft({ albumId: activeProfileAlbum.id, description: '', media: [] }); closeProfileAlbums(); setIsAddingAlbumMedia(true); }}><ImagePlus size={16} /> Thêm ảnh / video</button>}</> : null}>
      <div className="profile-album-tabs" role="tablist" aria-label="Lọc ảnh và video">{profileAlbumTabs.map((album) => <button type="button" role="tab" aria-selected={activeProfileAlbum.id === album.id} className={activeProfileAlbum.id === album.id ? 'is-active' : ''} key={album.id} onClick={() => selectProfileAlbum(album.id)}>{album.name}<span>{album.count ?? album.media.length}</span></button>)}</div>
      {isAlbumDirectory ? (visibleProfileAlbums.length ? <div className="profile-albums__grid">{visibleProfileAlbums.map((album) => <button type="button" className="profile-albums__card" key={album.id} onClick={() => selectProfileAlbum(album.id)} aria-label={`Mở album ${album.name}`}><span className={`profile-albums__cover is-${Math.min(album.media.length, 4)}`}>{album.media.length ? album.media.slice(0, 4).map((item, index) => item.type === 'video' ? <video key={`${item.id || item.src}-${index}`} src={item.src} muted preload="metadata" /> : <img key={`${item.id || item.src}-${index}`} src={item.src} alt="" loading="lazy" />) : <Images size={27} />}</span><strong className="profile-albums__name">{album.name}</strong><small>{album.media.length} {album.media.length === 1 ? 'mục' : 'mục'}</small></button>)}</div> : <div className="profile-album-empty"><Images size={24} /><p>Chưa có album nào được tạo.</p></div>) : <>
        {isCustomProfileAlbum && (activeProfileAlbum.description || ownsProfile) && <section className="profile-album-description"><div>{isEditingAlbumDescription ? <textarea value={albumDraft.description} onChange={(event) => setAlbumDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Viết mô tả cho album này..." rows="3" /> : activeProfileAlbum.description && <p>{activeProfileAlbum.description}</p>}</div>{ownsProfile && <div>{isEditingAlbumDescription ? <><button type="button" onClick={() => setIsEditingAlbumDescription(false)}>Hủy</button><button type="button" onClick={saveAlbumDescription}>Lưu mô tả</button></> : <ContentMenu id={`album-${activeProfileAlbum.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => { setAlbumDraft((current) => ({ ...current, description: activeProfileAlbum.description || '' })); setIsEditingAlbumDescription(true); }} onDelete={deleteProfileAlbum} label="album" />}</div>}</section>}
        {activeProfileAlbum.media.length ? <div className="profile-album-grid">{activeProfileAlbum.media.map((item, index) => <button type="button" className="profile-album-grid__item" key={`${item.storageKey || item.src.slice(0, 40)}-${index}`} onClick={() => openAlbumMedia(activeProfileAlbum.media, index, isCustomProfileAlbum ? activeProfileAlbum.id : item.albumId || null)} aria-label={`Xem ${item.type === 'video' ? 'video' : 'ảnh'} ${index + 1} trong ${activeProfileAlbum.name}`}>{item.type === 'video' ? <><video src={item.src} muted preload="metadata" /><span className="profile-album-grid__video"><Video size={17} /></span></> : <img src={item.src} alt={`Ảnh ${index + 1} trong ${activeProfileAlbum.name} của ${profile.name}`} loading="lazy" />}</button>)}</div> : <div className="profile-album-empty"><Images size={24} /><p>{activeProfileAlbum.name} chưa có ảnh hoặc video công khai.</p></div>}
      </>}
    </Modal>
    <Modal open={isCreatingProfileAlbum} onClose={() => { if (!isPreparingAlbumImages) setIsCreatingProfileAlbum(false); }} title="Tạo album" description="Gom ảnh và video cùng một chủ đề. Nội dung này cũng sẽ được đăng như một bài viết bình thường." size="lg" className="profile-album-create-dialog" footer={<><button className="profile-album-create__cancel" type="button" onClick={() => setIsCreatingProfileAlbum(false)} disabled={isPreparingAlbumImages}>Hủy</button><button className="profile-album-create__submit" type="submit" form="profile-album-create-form" disabled={isPreparingAlbumImages}>Tạo album</button></>}>
      <form id="profile-album-create-form" className="profile-album-create" onSubmit={createProfileAlbum}>
        <label><span>Tên album</span><input value={albumDraft.name} onChange={(event) => setAlbumDraft((current) => ({ ...current, name: event.target.value.slice(0, 80) }))} placeholder="Ví dụ: Hoạt động ngoại khóa" maxLength="80" autoFocus /></label>
        <label><span>Mô tả album</span><textarea value={albumDraft.description} onChange={(event) => setAlbumDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Viết nội dung giới thiệu album như một bài đăng..." rows="4" /></label>
        <div className="profile-album-create__photos"><div><strong>Tệp trong album</strong><small>Chọn một hoặc nhiều ảnh, video</small></div><input ref={albumImagesInputRef} type="file" accept="image/*,video/*" multiple onChange={(event) => addAlbumMedia(event, setAlbumDraft)} disabled={isPreparingAlbumImages} /><button type="button" onClick={() => albumImagesInputRef.current?.click()} disabled={isPreparingAlbumImages}>{isPreparingAlbumImages ? <LoaderCircle className="profile-upload-spinner" size={16} /> : <ImagePlus size={16} />}{isPreparingAlbumImages ? 'Đang chuẩn bị tệp…' : 'Thêm tệp'}</button></div>
        {albumDraft.media.length > 0 && <><div className="profile-album-create__preview">{albumDraft.media.map((item, index) => <figure key={item.id} draggable onDragStart={(event) => beginAlbumDraftDrag(event, index)} onDragOver={(event) => moveAlbumDraftOnDrag(event, index)} onDrop={finishAlbumDraftDrag} onDragEnd={finishAlbumDraftDrag} title="Kéo để thay đổi vị trí hiển thị">{item.type === 'video' ? <video src={item.src} muted /> : <img src={item.src} alt={`Ảnh xem trước ${index + 1}`} />}<span className="profile-album-create__drag-handle" aria-hidden="true"><GripVertical size={15} /></span><button type="button" draggable={false} onClick={() => setAlbumDraft((current) => ({ ...current, media: current.media.filter((_, mediaIndex) => mediaIndex !== index) }))} aria-label={`Bỏ tệp ${index + 1}`}><X size={14} /></button></figure>)}</div><div className="profile-album-create__captions">{albumDraft.media.map((item, index) => <label key={`caption-${item.id}`}><span className="profile-album-create__caption-thumb">{item.type === 'video' ? <video src={item.src} muted /> : <img src={item.src} alt="" />}</span><span className="profile-album-create__caption-field"><strong>{`${item.type === 'video' ? 'Video' : 'Ảnh'} ${index + 1}`}</strong><textarea value={item.description || ''} onChange={(event) => setAlbumDraft((current) => ({ ...current, media: current.media.map((media, mediaIndex) => mediaIndex === index ? { ...media, description: event.target.value } : media) }))} placeholder="Chú thích" rows="2" /></span></label>)}</div></>}
      </form>
    </Modal>
    <Modal open={isAddingAlbumMedia} onClose={() => { if (!isPreparingAlbumImages) setIsAddingAlbumMedia(false); }} title="Thêm vào album" description="Nội dung và tệp mới sẽ xuất hiện thành một bài viết trên trang cá nhân và Bảng Tin." size="lg" className="profile-album-create-dialog" footer={<><button className="profile-album-create__cancel" type="button" onClick={() => setIsAddingAlbumMedia(false)} disabled={isPreparingAlbumImages}>Hủy</button><button className="profile-album-create__submit" type="submit" form="profile-album-add-media-form" disabled={isPreparingAlbumImages}>Đăng vào album</button></>}>
      <form id="profile-album-add-media-form" className="profile-album-create" onSubmit={addMediaToProfileAlbum}>
        <label><span>Mô tả cho lần đăng này</span><textarea value={albumAdditionDraft.description} onChange={(event) => setAlbumAdditionDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Viết nội dung như một bài đăng..." rows="4" autoFocus /></label>
        <div className="profile-album-create__photos"><div><strong>Ảnh / video mới</strong><small>Các tệp này sẽ được thêm vào album</small></div><input ref={albumImagesInputRef} type="file" accept="image/*,video/*" multiple onChange={(event) => addAlbumMedia(event, setAlbumAdditionDraft)} disabled={isPreparingAlbumImages} /><button type="button" onClick={() => albumImagesInputRef.current?.click()} disabled={isPreparingAlbumImages}>{isPreparingAlbumImages ? <LoaderCircle className="profile-upload-spinner" size={16} /> : <ImagePlus size={16} />}{isPreparingAlbumImages ? 'Đang chuẩn bị tệp…' : 'Thêm tệp'}</button></div>
        {albumAdditionDraft.media.length > 0 && <><div className="profile-album-create__preview">{albumAdditionDraft.media.map((item, index) => <figure key={item.id}>{item.type === 'video' ? <video src={item.src} muted /> : <img src={item.src} alt={`Ảnh xem trước ${index + 1}`} />}<button type="button" onClick={() => setAlbumAdditionDraft((current) => ({ ...current, media: current.media.filter((_, mediaIndex) => mediaIndex !== index) }))} aria-label={`Bỏ tệp ${index + 1}`}><X size={14} /></button></figure>)}</div>{albumAdditionDraft.media.length > 1 && <div className="profile-album-create__captions"><div><strong>Mô tả riêng từng ảnh / video</strong><small>Tùy chọn — khác với nội dung chung của bài đăng.</small></div>{albumAdditionDraft.media.map((item, index) => <label key={`caption-${item.id}`}><span>{`${item.type === 'video' ? 'Video' : 'Ảnh'} ${index + 1}`}</span><textarea value={item.description || ''} onChange={(event) => setAlbumAdditionDraft((current) => ({ ...current, media: current.media.map((media, mediaIndex) => mediaIndex === index ? { ...media, description: event.target.value } : media) }))} placeholder="Viết mô tả riêng..." rows="2" /></label>)}</div>}</>}
      </form>
    </Modal>
    <Modal open={Boolean(expandedCommentImage)} onClose={() => setExpandedCommentImage(null)} title="Ảnh đính kèm" size="xl" className="expandable-image-dialog">
      <div className="expandable-image-dialog__content">{expandedCommentImage && <img src={expandedCommentImage.src} alt={expandedCommentImage.alt} />}</div>
    </Modal>
    <PostImageDialog key={imageViewer ? `${imageViewer.post.id}-${imageViewer.activeIndex}` : 'closed'} viewer={imageViewer && { ...imageViewer, post: viewerPost, author: viewerAuthor, publishedAt: formatPublishedAt(viewerPost?.createdAt) }} interactionTarget={viewerInteractionMedia || null} onActiveIndexChange={(activeIndex) => setImageViewer((current) => current ? { ...current, activeIndex } : current)} onClose={() => setImageViewer(null)} discussion={imageViewerDiscussion} onLike={() => like(viewerPost.id, viewerMedia?.id)} onShowLikes={() => setLikesTarget({ ids: viewerInteractionTarget?.likes || [], label: viewerMedia ? 'Những người đã thích ảnh/video này' : 'Những người đã thích bài viết này' })} onShare={() => openShareDialog(viewerPost, viewerMedia)} shareCount={viewerPost ? [...new Set(getPosts().filter((candidate) => candidate.sharedPost?.id === viewerPost.id && (viewerMedia ? candidate.sharedPost?.mediaId === viewerMedia.id : !candidate.sharedPost?.mediaId)).map((candidate) => candidate.authorId || candidate.teacherId).filter(Boolean))].length : 0} onShowShares={() => setLikesTarget({ ids: [...new Set(getPosts().filter((candidate) => candidate.sharedPost?.id === viewerPost?.id && (viewerMedia ? candidate.sharedPost?.mediaId === viewerMedia.id : !candidate.sharedPost?.mediaId)).map((candidate) => candidate.authorId || candidate.teacherId).filter(Boolean))], kind: 'share', title: 'Lượt chia sẻ', label: viewerMedia ? 'Những người đã chia sẻ ảnh/video này' : 'Những người đã chia sẻ bài viết này', emptyText: 'Chưa có lượt chia sẻ.' })} isLiked={(viewerInteractionTarget?.likes || []).includes(user?.id)} ownerActions={viewerPost && !imageViewer?.albumId && ownsContent(viewerPost.authorId || viewerPost.teacherId) ? <ContentMenu id={`viewer-post-${viewerPost.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => { setImageViewer(null); editProfilePost(viewerPost); }} onDelete={() => { setImageViewer(null); removeProfilePost(viewerPost); }} label="bài viết" /> : null} />
    <Modal open={Boolean(shareTarget)} onClose={() => setShareTarget(null)} title="Chia sẻ bài viết" description="Thêm suy nghĩ của bạn trước khi chia sẻ lên trang cá nhân." size="sm">
      <form className="share-post-form" onSubmit={sharePost}><textarea autoFocus value={shareText} onChange={(event) => setShareText(event.target.value)} placeholder="Viết nội dung bạn muốn chia sẻ..." rows="4" /><div><button type="button" onClick={() => setShareTarget(null)}>Hủy</button><button type="submit"><Share2 size={16} /> Chia sẻ</button></div></form>
    </Modal>
    <Modal
      open={isViewingProfileSummary}
      onClose={() => setIsViewingProfileSummary(false)}
      title="Hồ sơ năng lực"
      description={`Thông tin do ${profile.name} cung cấp.`}
      size="xl"
      className="profile-capability-dialog"
      footer={ownsProfile ? <button type="button" className="profile-portfolio-view__edit" onClick={() => { setIsViewingProfileSummary(false); openProfileEditor(); }}><FileText size={16} /> Chỉnh sửa hồ sơ</button> : null}
    >
      <article className="teacher-profile-summary">
        <section><h3>Hồ sơ năng lực</h3><p>{profileCapability || shortProfileIntro}</p>{profile.profilePortfolioImages?.length > 0 && <div className="profile-portfolio-view__gallery">{profile.profilePortfolioImages.map((image, index) => <button type="button" className="profile-portfolio-view__image" key={`${image.slice(0, 24)}-${index}`} onClick={() => setSelectedPortfolioImage({ src: image, index })} aria-label={`Phóng to ảnh minh họa ${index + 1}`}><img src={image} alt={`Hình ảnh hồ sơ năng lực ${index + 1} của ${profile.name}`} /></button>)}</div>}</section>
        {isEducationProviderProfile && <section><h3>Lĩnh vực giảng dạy</h3><p>{profile.teachingField || 'Đang cập nhật'}</p></section>}
        {isCenterProfile && <section><h3>Năm thành lập</h3><p>{profile.foundedYear || 'Đang cập nhật'}</p></section>}
        {isTeacherProfile && <><section><h3>Kinh nghiệm</h3><p>{profileExperience || 'Đang cập nhật'}</p></section><section><h3>Bằng cấp, chứng chỉ</h3><p>{profileQualifications || 'Đang cập nhật'}</p></section></>}
        {publicPhone && <section><h3>Điện thoại liên hệ</h3><a href={`tel:${profile.phone.replace(/\s/g, '')}`}><Phone size={15} /> {profile.phone}</a></section>}
      </article>
    </Modal>
    <Modal
      open={isEditingProfile}
      onClose={() => {
        setActiveProfileTextField(null);
        setIsEditingProfile(false);
      }}
      title={user?.role === 'center' ? 'Chỉnh sửa hồ sơ Trung tâm' : user?.role === 'teacher' ? 'Chỉnh sửa hồ sơ giáo viên' : 'Giới thiệu bản thân'}
      description={user?.role === 'center' ? 'Hồ sơ năng lực này hiển thị công khai trên hồ sơ và các khóa học của trung tâm.' : user?.role === 'teacher' ? 'Hồ sơ năng lực này hiển thị công khai trên hồ sơ và các khóa học của bạn.' : 'Chia sẻ để cộng đồng EduMatch hiểu thêm về bạn.'}
      size="lg"
    >
      <form className="teacher-profile-editor" onSubmit={saveProfile} noValidate>
        {user?.role !== 'student' && <label>
          <span>{user?.role === 'center' ? 'Tên Trung tâm' : 'Họ và tên'}</span>
          <input name="name" value={profileDraft.name || ''} onChange={updateProfileDraft} autoComplete="name" />
          {profileErrors.name && <small>{profileErrors.name}</small>}
        </label>}
        {['teacher', 'center'].includes(user?.role) && <label>
          <span>Lĩnh vực giảng dạy</span>
          <input name="teachingField" value={profileDraft.teachingField || ''} onChange={updateProfileDraft} maxLength={TEACHING_FIELD_MAX_LENGTH} placeholder="Ví dụ: Tiếng Anh giao tiếp, IELTS" aria-invalid={Boolean(profileErrors.teachingField)} />
          <small className={`teacher-profile-editor__counter ${String(profileDraft.teachingField || '').length >= TEACHING_FIELD_MAX_LENGTH ? 'is-limit' : ''}`} aria-live="polite">{String(profileDraft.teachingField || '').length}/{TEACHING_FIELD_MAX_LENGTH} ký tự</small>
          {profileErrors.teachingField && <small>{profileErrors.teachingField}</small>}
        </label>}
        {user?.role === 'center' && <label>
          <span>Năm thành lập</span>
          <input name="foundedYear" inputMode="numeric" maxLength="4" value={profileDraft.foundedYear || ''} onChange={updateProfileDraft} placeholder="Ví dụ: 2018" />
          {profileErrors.foundedYear && <small>{profileErrors.foundedYear}</small>}
        </label>}
        {user?.role === 'teacher' && <>
        <label>
          <span>Ngày tháng năm sinh</span>
          <input name="dob" type="date" value={profileDraft.dob || ''} onChange={updateProfileDraft} />
          {profileErrors.dob && <small>{profileErrors.dob}</small>}
        </label>
        <label>
          <span>Bằng cấp, chứng chỉ</span>
          <textarea name="qualifications" value={profileDraft.qualifications || ''} onChange={updateProfileDraft} onClick={() => setActiveProfileTextField('qualifications')} rows="3" maxLength={SHORT_BIO_MAX_LENGTH} placeholder="Ví dụ: Cử nhân Sư phạm, IELTS 8.0" />
          <small className={`teacher-profile-editor__counter ${String(profileDraft.qualifications || '').length >= SHORT_BIO_MAX_LENGTH ? 'is-limit' : ''}`}>{String(profileDraft.qualifications || '').length}/{SHORT_BIO_MAX_LENGTH} ký tự</small>
          {profileErrors.qualifications && <small>{profileErrors.qualifications}</small>}
        </label>
        <label>
          <span>Kinh nghiệm giảng dạy</span>
          <textarea name="experience" value={profileDraft.experience || ''} onChange={updateProfileDraft} onClick={() => setActiveProfileTextField('experience')} rows="3" maxLength={SHORT_BIO_MAX_LENGTH} placeholder="Ví dụ: 5 năm giảng dạy tiếng Anh" />
          <small className={`teacher-profile-editor__counter ${String(profileDraft.experience || '').length >= SHORT_BIO_MAX_LENGTH ? 'is-limit' : ''}`}>{String(profileDraft.experience || '').length}/{SHORT_BIO_MAX_LENGTH} ký tự</small>
          {profileErrors.experience && <small>{profileErrors.experience}</small>}
        </label>
        </>}
        <label className="teacher-profile-editor__full">
          <span>Hồ sơ năng lực</span>
          <textarea name="bio" value={profileDraft.bio || ''} onChange={updateProfileDraft} onClick={() => setActiveProfileTextField('bio')} rows="3" placeholder={profileTextFields.bio.placeholder} />
          {profileErrors.bio && <small>{profileErrors.bio}</small>}
        </label>
        {user?.role !== 'student' && <label className="teacher-profile-editor__phone-visibility teacher-profile-editor__full">
          <input name="isPhonePublic" type="checkbox" checked={Boolean(profileDraft.isPhonePublic)} onChange={updateProfileDraft} />
          <span><strong>Công khai số điện thoại</strong><small>Số điện thoại sẽ hiển thị trên hồ sơ, danh sách tìm kiếm và khóa học của bạn.</small></span>
        </label>}
        <div className="teacher-profile-editor__actions">
          <button type="button" onClick={() => { setActiveProfileTextField(null); setIsEditingProfile(false); }}>Hủy</button>
          <button type="submit"><Save size={16} /> Lưu thông tin</button>
        </div>
      </form>
    </Modal>
    <Modal
      open={Boolean(activeProfileTextField)}
      onClose={() => setActiveProfileTextField(null)}
      title={activeProfileText?.label}
      description={activeProfileTextField === 'bio' ? undefined : `Soạn nội dung chi tiết. Tối đa ${SHORT_BIO_MAX_LENGTH} ký tự.`}
      size="xl"
      className="profile-text-editor-modal"
      footer={<button type="button" className="profile-text-editor-modal__done" onClick={() => setActiveProfileTextField(null)}>Xong</button>}
    >
      {activeProfileTextField && <div className="profile-text-editor-modal__body">
        <textarea
          className="profile-text-editor-modal__textarea"
          autoFocus
          name={activeProfileTextField}
          value={profileDraft[activeProfileTextField] || ''}
          onChange={updateProfileDraft}
          rows="16"
          maxLength={activeProfileTextField === 'bio' ? undefined : SHORT_BIO_MAX_LENGTH}
          placeholder={activeProfileText?.placeholder}
          aria-label={activeProfileText?.label}
        />
        {activeProfileTextField !== 'bio' && <p className={`profile-text-editor-modal__count ${String(profileDraft[activeProfileTextField] || '').length >= SHORT_BIO_MAX_LENGTH ? 'is-limit' : ''}`}>
          {String(profileDraft[activeProfileTextField] || '').length}/{SHORT_BIO_MAX_LENGTH} ký tự
        </p>}
      </div>}
    </Modal>
    <Modal
      open={isEditingDetailedProfile}
      onClose={() => setIsEditingDetailedProfile(false)}
      title="Hồ sơ năng lực"
      description="Hãy chia sẻ thật chi tiết về chuyên môn, kinh nghiệm, phương pháp, đội ngũ hoặc các dấu ấn của bạn. Học viên sẽ hiểu và tin tưởng bạn hơn."
      size="lg"
    >
      <form className="teacher-profile-editor detailed-profile-editor" onSubmit={saveDetailedProfile}>
        <label className="teacher-profile-editor__full">
          <span>Nội dung hồ sơ</span>
          <textarea autoFocus value={detailedProfileDraft} onChange={(event) => setDetailedProfileDraft(event.target.value)} rows="12" placeholder={isCenterProfile ? 'Giới thiệu đầy đủ về trung tâm, đội ngũ, phương pháp đào tạo, không gian học tập và những giá trị bạn theo đuổi...' : 'Giới thiệu đầy đủ về chuyên môn, phương pháp giảng dạy, kinh nghiệm và các dấu ấn của bạn...'} />
        </label>
        <div className="profile-portfolio-editor teacher-profile-editor__full">
          <div><strong>Hình ảnh minh họa</strong><small>Tối đa {MAX_PORTFOLIO_IMAGES} ảnh.</small></div>
          {portfolioImagesDraft.length > 0 && <div className="profile-portfolio-editor__gallery">{portfolioImagesDraft.map((image, index) => <figure key={`${image.slice(0, 24)}-${index}`}><img src={image} alt={`Ảnh minh họa hồ sơ năng lực ${index + 1}`} /><button type="button" onClick={() => setPortfolioImagesDraft((current) => current.filter((_, imageIndex) => imageIndex !== index))} aria-label={`Xóa ảnh ${index + 1}`}><X size={15} /></button></figure>)}</div>}
          {portfolioImagesDraft.length < MAX_PORTFOLIO_IMAGES && <label className="profile-portfolio-editor__upload"><ImagePlus size={17} /> Thêm ảnh<input ref={portfolioImagesInputRef} type="file" accept="image/*" multiple onChange={addPortfolioImages} /></label>}
        </div>
        <div className="teacher-profile-editor__actions">
          <button type="button" onClick={() => setIsEditingDetailedProfile(false)}>Hủy</button>
          <button type="submit"><Save size={16} /> Lưu hồ sơ năng lực</button>
        </div>
      </form>
    </Modal>
    <Modal
      open={isViewingDetailedProfile}
      onClose={() => setIsViewingDetailedProfile(false)}
      title="Hồ sơ năng lực"
      description={`Thông tin do ${profile.name} cung cấp.`}
      size="lg"
      footer={ownsProfile && canCreateCourse ? <button type="button" className="profile-portfolio-view__edit" onClick={() => { setIsViewingDetailedProfile(false); openDetailedProfileEditor(); }}><FileText size={16} /> Chỉnh sửa hồ sơ năng lực</button> : null}
    >
      {hasDetailedProfile ? <article className="profile-portfolio-view"><p>{profile.detailedProfile}</p>{profile.profilePortfolioImages?.length > 0 && <div className="profile-portfolio-view__gallery">{profile.profilePortfolioImages.map((image, index) => <button type="button" className="profile-portfolio-view__image" key={`${image.slice(0, 24)}-${index}`} onClick={() => setSelectedPortfolioImage({ src: image, index })} aria-label={`Phóng to ảnh minh họa ${index + 1}`}><img src={image} alt={`Hình ảnh hồ sơ năng lực ${index + 1} của ${profile.name}`} /></button>)}</div>}</article> : <div className="profile-portfolio-view__empty"><FileText size={22} /><p>{isCenterProfile ? 'Trung tâm đang hoàn thiện hồ sơ năng lực.' : 'Giáo viên đang hoàn thiện hồ sơ năng lực.'}</p></div>}
    </Modal>
    <Modal
      open={Boolean(selectedPortfolioImage)}
      onClose={() => setSelectedPortfolioImage(null)}
      title={`Ảnh minh họa${selectedPortfolioImage ? ` ${selectedPortfolioImage.index + 1}` : ''}`}
      description={`Hồ sơ năng lực của ${profile.name}`}
      size="xl"
    >
      {selectedPortfolioImage && <img className="profile-portfolio-lightbox__image" src={selectedPortfolioImage.src} alt={`Ảnh minh họa ${selectedPortfolioImage.index + 1} trong hồ sơ năng lực của ${profile.name}`} />}
    </Modal>
    <PostComposerDialog
      open={isPostComposerOpen}
      onClose={() => setIsPostComposerOpen(false)}
      draft={postText}
      onDraftChange={setPostText}
      media={media}
      onMediaChange={setMedia}
      albums={visibleProfileAlbums}
      selectedAlbumId={postAlbumId}
      onSelectedAlbumChange={setPostAlbumId}
      onCreateAlbum={createProfileAlbumFromComposer}
      onPublish={handlePublish}
      placeholder="Hãy chia sẻ để học viên hiểu hơn về bạn"
      attachmentId="profile-post-media"
    />
    <ProfileImageCropDialog
      draft={profileImageCropDraft}
      onClose={() => setProfileImageCropDraft(null)}
      onSave={saveCroppedProfileImage}
    />
    <ProfileImageSourceDialog
      open={Boolean(profileImageSourceField)}
      variant={profileImageSourceField === 'avatar' ? 'avatar' : 'cover'}
      media={profileAlbumMedia}
      onClose={() => setProfileImageSourceField(null)}
      onChooseExisting={chooseExistingProfileImage}
      onUpload={openImageUpload}
    />

  </div>;
}
