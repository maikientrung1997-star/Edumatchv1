import { GraduationCap, Presentation, School, UserRound } from 'lucide-react';

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

export function DefaultRoleAvatar({ role = 'student', size = 18, className = '' }) {
  const Icon = roleIcons[role] || GraduationCap;
  const isTeacher = role === 'teacher';

  return (
    <span className={`default-role-avatar ${className}`.trim()} role="img" aria-label={`Ảnh đại diện mặc định của ${roleLabels[role] || roleLabels.student}`}>
      {isTeacher ? (
        <span className="default-role-avatar__teacher" style={{ '--default-role-avatar-size': `${size}px` }} aria-hidden="true">
          <Presentation className="default-role-avatar__teacher-board" size={size} strokeWidth={1.8} />
          <UserRound className="default-role-avatar__teacher-person" size={Math.max(12, Math.round(size * 0.68))} strokeWidth={1.9} />
        </span>
      ) : <Icon size={size} strokeWidth={1.8} aria-hidden="true" />}
    </span>
  );
}

export default DefaultRoleAvatar;
