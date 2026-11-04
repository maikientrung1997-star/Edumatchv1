import { useState } from 'react';
import { GraduationCap, Presentation, School, UserRound } from 'lucide-react';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { storage } from '@/utils/storage';

const roleIcons = {
  student: GraduationCap,
  teacher: Presentation,
  center: School,
};

const roleLabels = {
  student: 'học viên',
  teacher: 'giáo viên',
  center: 'trung tâm đào tạo',
};

const apiOrigin = (() => {
  try {
    return new URL(
      import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
    ).origin;
  } catch {
    return '';
  }
})();

export function normalizeRole(role, name = '', id = '', fallback = 'student') {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'center' || normalized === 'teacher' || normalized === 'student') {
    return normalized;
  }
  const idText = String(id || '').trim().toLowerCase();
  if (idText.startsWith('center-')) return 'center';
  if (idText.startsWith('teacher-')) return 'teacher';
  if (/^trung\s*t[aâ]m\b/i.test(String(name || '').trim())) return 'center';
  return fallback;
}

export function normalizeAvatarUrl(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw || raw === 'null' || raw === 'undefined') return '';
  if (raw.startsWith('data:image/')) return raw;
  if (raw.startsWith('blob:')) return raw;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (
        apiOrigin &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
        parsed.pathname.startsWith('/storage/')
      ) {
        const avatarFilename = parsed.pathname.match(/^\/storage\/avatars\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp|gif))$/i)?.[1];
        const rewrittenPath = avatarFilename
          ? `/api/media/avatars/${encodeURIComponent(avatarFilename)}`
          : parsed.pathname;
        return new URL(`${rewrittenPath}${parsed.search}`, apiOrigin).toString();
      }
    } catch {
      return raw;
    }
    return raw;
  }

  const normalized = raw.replace(/\\/g, '/');
  if (/^\/?(?:src\/assets|assets|images)\//i.test(normalized) || normalized.startsWith('/@fs/')) {
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  const avatarFilename = normalized.replace(/^\//, '').match(/^(?:storage\/)?avatars\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp|gif))$/i)?.[1];
  if (avatarFilename) {
    const mediaPath = `/api/media/avatars/${encodeURIComponent(avatarFilename)}`;
    return apiOrigin ? new URL(mediaPath, apiOrigin).toString() : mediaPath;
  }

  let pathWithStorage = normalized;
  if (!/^\/?storage\//i.test(normalized) && /^(?:avatars|uploads|profiles|images)\//i.test(normalized.replace(/^\//, ''))) {
    pathWithStorage = `/storage/${normalized.replace(/^\//, '')}`;
  } else if (!pathWithStorage.startsWith('/')) {
    pathWithStorage = `/${pathWithStorage}`;
  }

  return apiOrigin ? new URL(pathWithStorage, apiOrigin).toString() : pathWithStorage;
}

export function resolveAvatarSource(src, userId) {
  if (userId != null && String(userId).trim() !== '') {
    const key = String(userId);
    const currentUser = storage.get(STORAGE_KEYS.USER_INFO, null);
    if (currentUser && String(currentUser.id) === key && currentUser.avatar && !String(currentUser.avatar).startsWith('blob:')) {
      return normalizeAvatarUrl(currentUser.avatar);
    }
    const persisted = storage.get(STORAGE_KEYS.PROFILE_VISUALS, {})?.[key]?.avatar;
    if (persisted && String(persisted).startsWith('data:image/')) {
      return persisted;
    }
  }
  return normalizeAvatarUrl(src);
}

export function DefaultRoleAvatar({ role = 'student', name = '', userId = '', size = 18, className = '' }) {
  const resolvedRole = normalizeRole(role, name, userId, 'student');
  const Icon = roleIcons[resolvedRole] || GraduationCap;
  const isTeacher = resolvedRole === 'teacher';

  return (
    <span className={`default-role-avatar ${className}`.trim()} role="img" aria-label={`Ảnh đại diện mặc định của ${roleLabels[resolvedRole] || roleLabels.student}`}>
      {isTeacher ? (
        <span className="default-role-avatar__teacher" style={{ '--default-role-avatar-size': `${size}px` }} aria-hidden="true">
          <Presentation className="default-role-avatar__teacher-board" size={size} strokeWidth={1.8} />
          <UserRound className="default-role-avatar__teacher-person" size={Math.max(12, Math.round(size * 0.68))} strokeWidth={1.9} />
        </span>
      ) : <Icon size={size} strokeWidth={1.8} aria-hidden="true" />}
    </span>
  );
}

export function RoleAvatar({
  src = '',
  userId = '',
  name = '',
  role = 'student',
  size = 18,
  alt = '',
  className = '',
  fallbackClassName = '',
  width,
  height,
  loading,
}) {
  const [failedSrc, setFailedSrc] = useState('');
  const resolvedSrc = resolveAvatarSource(src, userId);
  const resolvedRole = normalizeRole(role, name, userId, 'student');

  if (resolvedSrc && failedSrc !== resolvedSrc) {
    return (
      <img
        key={resolvedSrc}
        src={resolvedSrc}
        alt={alt}
        className={className || undefined}
        width={width}
        height={height}
        loading={loading}
        onError={() => setFailedSrc(resolvedSrc)}
      />
    );
  }

  if (fallbackClassName) {
    return (
      <span className={fallbackClassName} aria-hidden="true">
        <DefaultRoleAvatar role={resolvedRole} name={name} userId={userId} size={size} className={className} />
      </span>
    );
  }

  return <DefaultRoleAvatar role={resolvedRole} name={name} userId={userId} size={size} className={className} />;
}

export default DefaultRoleAvatar;
