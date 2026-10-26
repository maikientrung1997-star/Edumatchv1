import { Building2, GraduationCap, NotebookPen } from 'lucide-react';

const roleIcons = {
  student: GraduationCap,
  teacher: NotebookPen,
  center: Building2,
};

const roleLabels = {
  student: 'học viên',
  teacher: 'giáo viên',
  center: 'trung tâm đào tạo',
};

export function DefaultRoleAvatar({ role = 'student', size = 18, className = '' }) {
  const Icon = roleIcons[role] || GraduationCap;
  return <span className={`default-role-avatar ${className}`.trim()} role="img" aria-label={`Ảnh đại diện mặc định của ${roleLabels[role] || roleLabels.student}`}><Icon size={size} strokeWidth={1.8} aria-hidden="true" /></span>;
}

export default DefaultRoleAvatar;
