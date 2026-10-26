import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { storage } from '@/utils/storage';
import { authService } from '@/services/authService';
import { disconnectPusher } from '@/services/pusherService';
import { syncPostAuthorProfile } from '@/features/learning/marketplace';

export const AuthContext = createContext(null);

const withImageVersion = (source, version) => {
  if (!source || !version || String(source).startsWith('data:image/')) return source;
  return `${source}${String(source).includes('?') ? '&' : '?'}edumatch_image=${encodeURIComponent(version)}`;
};

const getPersistedProfileVisuals = (userId) => {
  if (userId == null) return {};
  return storage.get(STORAGE_KEYS.PROFILE_VISUALS, {})?.[String(userId)] || {};
};

const persistProfileVisuals = (user) => {
  if (user?.id == null) return;
  const visualsByUser = storage.get(STORAGE_KEYS.PROFILE_VISUALS, {});
  storage.set(STORAGE_KEYS.PROFILE_VISUALS, {
    ...visualsByUser,
    [String(user.id)]: {
      avatar: user.avatar || '',
      coverImage: user.coverImage || '',
      avatarVersion: user.avatarVersion || undefined,
    },
  });
};

// API hồ sơ có thể chưa trả về ảnh bìa. Giữ một bản ảnh theo từng tài khoản để
// việc đăng xuất không làm mất các ảnh người dùng đã chọn trên thiết bị này.
const mergePersistedProfileVisuals = (remoteUser) => {
  const cachedUser = storage.get(STORAGE_KEYS.USER_INFO);
  if (!remoteUser?.id) return remoteUser;

  const cachedVisuals = cachedUser && String(cachedUser.id) === String(remoteUser.id)
    ? cachedUser
    : {};
  const persistedVisuals = getPersistedProfileVisuals(remoteUser.id);
  const savedAvatar = persistedVisuals.avatar || cachedVisuals.avatar || '';
  const savedAvatarVersion = persistedVisuals.avatarVersion || cachedVisuals.avatarVersion;
  const hasLocalAvatar = Boolean(savedAvatar) && (
    savedAvatar.startsWith('data:image/') || savedAvatar.startsWith('blob:') || savedAvatarVersion
  );

  const preferredAvatar = hasLocalAvatar
    ? (savedAvatarVersion && !savedAvatar.startsWith('data:image/') && !savedAvatar.startsWith('blob:')
        ? withImageVersion(savedAvatar, savedAvatarVersion)
        : savedAvatar)
    : (remoteUser.avatar || savedAvatar);

  const preferredCoverImage = persistedVisuals.coverImage || cachedVisuals.coverImage || remoteUser.coverImage || '';

  return {
    ...remoteUser,
    avatar: preferredAvatar,
    coverImage: preferredCoverImage,
    avatarVersion: savedAvatarVersion || remoteUser.avatarVersion || undefined,
    ...(!remoteUser.phoneVisibilityProvided && typeof cachedVisuals.isPhonePublic === 'boolean'
      ? { isPhonePublic: cachedVisuals.isPhonePublic }
      : {}),
  };
};

const authFailure = (error, fallback) => ({
  success: false,
  message: error.response?.data?.message || (error.request ? 'Không thể kết nối đến máy chủ. Vui lòng thử lại.' : error.message) || fallback,
  errors: error.response?.data?.errors || {},
  status: error.response?.status,
  requiresPassword: error.response?.data?.requires_password === true,
});

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => storage.get(STORAGE_KEYS.ACCESS_TOKEN) || null);
  const [user, setUser] = useState(() => storage.get(STORAGE_KEYS.USER_INFO) || null);
  const [loading, setLoading] = useState(() => {
    const hasToken = Boolean(storage.get(STORAGE_KEYS.ACCESS_TOKEN));
    const hasUser = Boolean(storage.get(STORAGE_KEYS.USER_INFO));
    return hasToken && !hasUser;
  });

  useEffect(() => {
    let active = true;
    const clearSession = () => {
      disconnectPusher();
      storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
      storage.remove(STORAGE_KEYS.USER_INFO);
      if (active) {
        setToken(null);
        setUser(null);
      }
    };
    const initAuth = async () => {
      const savedToken = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
      if (!savedToken) {
        clearSession();
        setLoading(false);
        return;
      }
      try {
        const response = await authService.getProfile();
        // Ignore a late response if another action has replaced the session.
        if (active && storage.get(STORAGE_KEYS.ACCESS_TOKEN) === savedToken) {
          setToken(savedToken);
          const hydratedUser = mergePersistedProfileVisuals(response.user);
          setUser(hydratedUser);
          storage.set(STORAGE_KEYS.USER_INFO, hydratedUser);
          persistProfileVisuals(hydratedUser);
        }
      } catch {
        if (active && storage.get(STORAGE_KEYS.ACCESS_TOKEN) === savedToken) clearSession();
      } finally {
        if (active) setLoading(false);
      }
    };
    window.addEventListener('auth:expired', clearSession);
    initAuth();

    const handleUserUpdate = (event) => {
      const updatedUser = event.detail;
      if (updatedUser?.id) {
        setUser((current) => {
          if (!current || String(current.id) === String(updatedUser.id)) {
            return { ...current, ...updatedUser };
          }
          return current;
        });
      }
    };
    const handleStorage = (event) => {
      if (event.key === STORAGE_KEYS.USER_INFO && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (parsed?.id) {
            setUser((current) => {
              if (!current || String(current.id) === String(parsed.id)) {
                return { ...current, ...parsed };
              }
              return current;
            });
          }
        } catch {
          // ignore parse errors
        }
      }
    };
    window.addEventListener('edumatch:user-updated', handleUserUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      active = false;
      window.removeEventListener('auth:expired', clearSession);
      window.removeEventListener('edumatch:user-updated', handleUserUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const authenticate = async (method, data) => {
    setLoading(true);
    try {
      const response = await authService[method](data);
      const hydratedUser = mergePersistedProfileVisuals(response.user);
      setToken(response.token);
      setUser(hydratedUser);
      storage.set(STORAGE_KEYS.USER_INFO, hydratedUser);
      persistProfileVisuals(hydratedUser);
      return { success: true, user: hydratedUser, data: response };
    } catch (error) {
      return authFailure(error, method === 'login' ? 'Đăng nhập không thành công.' : 'Không thể đăng ký tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    disconnectPusher();
    try {
      await authService.logout();
      return { success: true };
    } catch (error) {
      return authFailure(error, 'Phiên trên thiết bị đã được xóa; chưa thể kết nối để thu hồi token trên máy chủ.');
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  const updateUser = useCallback((updates) => {
    setUser((current) => {
      if (!current) return null;

      let nextAvatar = current.avatar;
      let nextAvatarVersion = current.avatarVersion;

      if (typeof updates.avatar === 'string' && updates.avatar.trim()) {
        // If current avatar is a data:image (fresh local image selected by user),
        // and updates is an older remote URL without an avatarVersion, keep local image
        if (current.avatar?.startsWith('data:image/') && !updates.avatar.startsWith('data:image/') && !updates.avatarVersion) {
          nextAvatar = current.avatar;
        } else {
          nextAvatar = updates.avatar;
        }
      } else if (updates.avatar === '' || updates.avatar === null) {
        if (!updates.removeAvatar && current.avatar) {
          nextAvatar = current.avatar;
        } else {
          nextAvatar = '';
        }
      }

      if (updates.avatarVersion) {
        nextAvatarVersion = updates.avatarVersion;
      }

      const nextUser = {
        ...current,
        ...updates,
        avatar: nextAvatar || '',
        ...(nextAvatarVersion ? { avatarVersion: nextAvatarVersion } : {}),
      };
      storage.set(STORAGE_KEYS.USER_INFO, nextUser);
      persistProfileVisuals(nextUser);
      if (Object.prototype.hasOwnProperty.call(updates, 'avatar') || Object.prototype.hasOwnProperty.call(updates, 'name')) {
        syncPostAuthorProfile(nextUser.id, {
          ...(Object.prototype.hasOwnProperty.call(updates, 'avatar') ? { avatar: nextUser.avatar } : {}),
          ...(Object.prototype.hasOwnProperty.call(updates, 'name') ? { name: nextUser.name } : {}),
        });
      }
      window.dispatchEvent(new CustomEvent('edumatch:user-updated', { detail: nextUser }));
      return nextUser;
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, isAuthenticated: Boolean(token && user), loading,
      login: (data) => authenticate('login', data),
      register: (data) => authenticate('register', data),
      loginWithGoogle: (data) => authenticate('googleLogin', data),
      logout, updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;
