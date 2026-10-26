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
  if (/^(?:https?:|data:|blob:)/i.test(stringValue)) return stringValue;

  const normalized = stringValue.replace(/\\/g, '/');
  let pathWithStorage = normalized;
  if (!/^\/?storage\//i.test(normalized) && /^(?:avatars|uploads|profiles|images)\//i.test(normalized.replace(/^\//, ''))) {
    pathWithStorage = `/storage/${normalized.replace(/^\//, '')}`;
  } else if (!pathWithStorage.startsWith('/')) {
    pathWithStorage = `/${pathWithStorage}`;
  }

  return apiOrigin ? new URL(pathWithStorage, apiOrigin).toString() : pathWithStorage;
};

export function normalizeAuthUser(user) {
  if (!user) return null;
  const profile = user.student_profile || user.teacher_profile || user.center || {};
  const phoneVisibilityProvided = [user, profile].some((item) =>
    Object.prototype.hasOwnProperty.call(item || {}, 'show_phone') || Object.prototype.hasOwnProperty.call(item || {}, 'isPhonePublic'),
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
    user.coverImage ||
    user.cover_image ||
    user.cover_url ||
    user.banner ||
    user.banner_url ||
    profile.coverImage ||
    profile.cover_image ||
    profile.cover_url ||
    user.center?.cover_image ||
    user.center?.cover_url ||
    user.teacher_profile?.cover_image ||
    user.teacher_profile?.cover_url ||
    '';

  return {
    ...user,
    name: user.center?.name || user.name,
    dob: profile.date_of_birth?.slice(0, 10) || user.dob || '',
    bio: profile.bio ?? profile.description ?? user.bio ?? '',
    avatar: resolveAssetUrl(rawAvatar),
    coverImage: resolveAssetUrl(rawCoverImage),
    avatarVersion: user.avatarVersion || user.avatar_version || undefined,
    qualifications: user.teacher_profile?.headline || user.qualifications || '',
    experience: user.teacher_profile ? `${user.teacher_profile.experience_years ?? 0} năm kinh nghiệm` : user.experience || '',
    isPhonePublic: profile.show_phone ?? user.show_phone ?? user.isPhonePublic ?? false,
    phoneVisibilityProvided,
    foundedYear: user.center?.founded_year ? String(user.center.founded_year) : user.foundedYear || '',
    teachingField: profile.teaching_field || profile.teachingField || user.teaching_field || user.teachingField || '',
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
