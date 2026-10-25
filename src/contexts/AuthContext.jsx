import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { storage } from '@/utils/storage';
import { authService } from '@/services/authService';
import { disconnectPusher } from '@/services/pusherService';

export const AuthContext = createContext(null);

const withImageVersion = (source, version) => {
  if (!source || !version || String(source).startsWith('data:image/')) return source;
  return `${source}${String(source).includes('?') ? '&' : '?'}edumatch_image=${encodeURIComponent(version)}`;
};

// Ảnh bìa hiện được lưu ở phía giao diện, trong khi API hồ sơ có thể chưa trả
// về trường này. Giữ lại ảnh cục bộ của đúng tài khoản khi làm mới phiên, thay
// vì để phản hồi /auth/me vô tình xóa ảnh bìa người dùng vừa chọn.
const mergePersistedProfileVisuals = (remoteUser) => {
  const cachedUser = storage.get(STORAGE_KEYS.USER_INFO);
  if (!cachedUser || String(cachedUser.id) !== String(remoteUser?.id)) return remoteUser;

  const preferredAvatar =
    (cachedUser.avatar && (!remoteUser?.avatar || cachedUser.avatar.startsWith('data:image/') || cachedUser.avatarVersion))
      ? (cachedUser.avatarVersion && !cachedUser.avatar.startsWith('data:image/') && !cachedUser.avatar.startsWith('blob:')
          ? withImageVersion(cachedUser.avatar, cachedUser.avatarVersion)
          : cachedUser.avatar)
      : (remoteUser?.avatar
          ? (cachedUser.avatarVersion && !remoteUser.avatar.startsWith('data:image/') && !remoteUser.avatar.startsWith('blob:')
              ? withImageVersion(remoteUser.avatar, cachedUser.avatarVersion)
              : remoteUser.avatar)
          : (cachedUser.avatar || ''));

  const preferredCoverImage = cachedUser.coverImage || remoteUser?.coverImage || '';

  return {
    ...remoteUser,
    avatar: preferredAvatar,
    coverImage: preferredCoverImage,
    avatarVersion: cachedUser.avatarVersion || remoteUser?.avatarVersion || undefined,
    ...(!remoteUser?.phoneVisibilityProvided && typeof cachedUser.isPhonePublic === 'boolean'
      ? { isPhonePublic: cachedUser.isPhonePublic }
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
      setToken(response.token);
      setUser(response.user);
      return { success: true, user: response.user, data: response };
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
