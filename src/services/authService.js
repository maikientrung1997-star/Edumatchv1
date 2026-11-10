import api from './api';
import { sharedGet } from './sharedGet';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { storage } from '@/utils/storage';

const apiOrigin = (() => {
  try {
    return new URL(
      import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
    ).origin;
  } catch {
    return '';
  }
})();

const resolveAssetUrl = (value) => {
  if (!value) return '';
  const stringValue = String(value).trim();
  if (!stringValue || stringValue === 'null' || stringValue === 'undefined') return '';
  if (/^(?:data:|blob:)/i.test(stringValue)) return stringValue;
  if (/^https?:/i.test(stringValue)) {
    try {
      const parsed = new URL(stringValue);
      if (
        apiOrigin &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
        parsed.pathname.startsWith('/storage/')
      ) {
        const publicMedia = parsed.pathname.match(/^\/storage\/(avatars|covers)\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp|gif))$/i);
        const rewrittenPath = publicMedia
          ? `/api/media/${publicMedia[1].toLowerCase()}/${encodeURIComponent(publicMedia[2])}`
          : parsed.pathname;
        return new URL(`${rewrittenPath}${parsed.search}`, apiOrigin).toString();
      }
    } catch {
      // Fall through and return stringValue as-is.
    }
    return stringValue;
  }

  const normalized = stringValue.replace(/\\/g, '/');
  const publicMedia = normalized.replace(/^\//, '').match(/^(?:storage\/)?(avatars|covers)\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp|gif))$/i);
  if (publicMedia) {
    const mediaPath = `/api/media/${publicMedia[1].toLowerCase()}/${encodeURIComponent(publicMedia[2])}`;
    return apiOrigin ? new URL(mediaPath, apiOrigin).toString() : mediaPath;
  }

  let pathWithStorage = normalized;
  if (!/^\/?storage\//i.test(normalized) && /^(?:avatars|covers|uploads|profiles|images)\//i.test(normalized.replace(/^\//, ''))) {
    pathWithStorage = `/storage/${normalized.replace(/^\//, '')}`;
  } else if (!pathWithStorage.startsWith('/')) {
    pathWithStorage = `/${pathWithStorage}`;
  }

  return apiOrigin ? new URL(pathWithStorage, apiOrigin).toString() : pathWithStorage;
};

export function normalizeAuthUser(user) {
  if (!user) return null;
  const profile =
    user.student_profile ||
    user.teacher_profile ||
    user.teacherProfile ||
    user.center_profile ||
    user.centerProfile ||
    user.center ||
    {};
  const phoneVisibilityProvided = [user, profile, user.center, user.center_profile, user.centerProfile].some((item) =>
    Boolean(item) && (
      Object.prototype.hasOwnProperty.call(item, 'show_phone') ||
      Object.prototype.hasOwnProperty.call(item, 'showPhone') ||
      Object.prototype.hasOwnProperty.call(item, 'is_phone_public') ||
      Object.prototype.hasOwnProperty.call(item, 'isPhonePublic')
    ),
  );
  const rawAvatar =
    user.avatar ||
    user.avatar_url ||
    user.profile_photo_url ||
    user.image ||
    profile.avatar ||
    profile.avatar_url ||
    profile.logo ||
    profile.logo_url ||
    profile.image ||
    user.center?.avatar ||
    user.center?.avatar_url ||
    user.center?.logo ||
    user.center?.logo_url ||
    user.teacher_profile?.avatar ||
    user.teacher_profile?.avatar_url ||
    user.student_profile?.avatar ||
    user.student_profile?.avatar_url ||
    '';
  const rawCoverImage =
  user.cover_image_url ||
  user.coverImage ||
    user.cover_image ||
    user.cover_url ||
    user.banner ||
    user.banner_url ||
  profile.cover_image_url ||
    profile.coverImage ||
    profile.cover_image ||
    profile.cover_url ||
  user.center?.cover_image_url ||
    user.center?.cover_image ||
    user.center?.cover_url ||
  user.teacher_profile?.cover_image_url ||
    user.teacher_profile?.cover_image ||
    user.teacher_profile?.cover_url ||
    '';

  const rawPhonePublic =
    profile.show_phone ??
    profile.showPhone ??
    profile.is_phone_public ??
    profile.isPhonePublic ??
    user.center?.show_phone ??
    user.center?.showPhone ??
    user.center?.is_phone_public ??
    user.center?.isPhonePublic ??
    user.center_profile?.show_phone ??
    user.centerProfile?.show_phone ??
    user.show_phone ??
    user.showPhone ??
    user.is_phone_public ??
    user.isPhonePublic;

  return {
    ...user,
    name: user.center?.name || user.name,
    phone: user.center?.phone || profile.phone || user.phone || '',
    dob: profile.date_of_birth?.slice(0, 10) || user.dob || '',
    bio: profile.bio ?? profile.description ?? user.bio ?? '',
    avatar: resolveAssetUrl(rawAvatar),
    coverImage: resolveAssetUrl(rawCoverImage),
    avatarVersion: user.avatarVersion || user.avatar_version || undefined,
    qualifications: user.teacher_profile?.headline || user.qualifications || '',
    experience:
      user.teacher_profile?.experience ||
      user.experience ||
      (user.teacher_profile ? `${user.teacher_profile.experience_years ?? 0} năm kinh nghiệm` : ''),
    isPhonePublic: rawPhonePublic != null ? Boolean(rawPhonePublic) : false,
    phoneVisibilityProvided,
    foundedYear: user.center?.founded_year ? String(user.center.founded_year) : user.foundedYear || '',
    teachingField: profile.teaching_field || profile.teachingField || user.teaching_field || user.teachingField || '',
    photoAlbums: profile.photo_albums || profile.photoAlbums || user.photo_albums || user.photoAlbums || [],
    verificationStatus: profile.verification_status || 'unverified',
    verifiedAt: profile.verified_at || null,
    licenseVerificationStatus: user.center?.verification_status || '',
  };
}

function saveSession(response) {
  const token = response?.token || response?.access_token;
  if (!token || !response?.user?.id) {
    throw new Error('Phản hồi xác thực không hợp lệ. Vui lòng thử lại.');
  }
  const user = normalizeAuthUser(response.user);
  storage.set(STORAGE_KEYS.ACCESS_TOKEN, token);
  storage.set(STORAGE_KEYS.USER_INFO, user);
  return { ...response, token, user };
}

export const authService = {
  async googleLogin(payload) {
    return saveSession(await api.post('/auth/google', payload));
  },

  async login(credentials) {
    return saveSession(await api.post('/auth/login', credentials));
  },

  async register(data) {
    return saveSession(await api.post('/auth/register', data));
  },

  sendRegistrationOtp(payload) {
    return api.post('/auth/register/send-otp', payload);
  },

  async getProfile() {
    const response = await sharedGet('/auth/me');
    if (!response?.user?.id) {
      throw new Error('Không thể xác thực phiên đăng nhập.');
    }
    return { ...response, user: normalizeAuthUser(response.user) };
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
      storage.remove(STORAGE_KEYS.USER_INFO);
    }
  },

  forgotPassword(identifier) {
    return api.post('/auth/forgot-password', { identifier });
  },

  resetPassword(payload) {
    return api.post('/auth/reset-password', payload);
  },

  changePassword(payload) {
    return api.post('/auth/change-password', payload);
  },
};

export default authService;
