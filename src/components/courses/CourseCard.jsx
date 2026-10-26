import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { CalendarDays, Clock3, Heart, Monitor, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DefaultRoleAvatar } from '@/components/common/DefaultRoleAvatar';
import { ROUTES } from '@/constants/routes';
import { enrollmentLabel, getCourseRating, getProviderTrustCount, modeLabel, paymentLabel } from '@/features/learning/marketplace';

const formatCurrency = (value) =>
  Number(value) > 0 ? `${new Intl.NumberFormat('vi-VN').format(value)}đ` : 'Liên hệ';

export function CourseCard({ course, editable = false, sponsored = false }) {
  const storedRating = getCourseRating(course.id);
  const rating = storedRating.total
    ? storedRating
    : { total: Number(course.reviewCount || 0), average: Number(course.rating || 0) };
  const isCenter = course.teacher.role === 'center';
  const trustCount = getProviderTrustCount(course.teacher.id, course.teacher.heartCount);
  return (
    <article className="course-card">
      <div className="course-card__top">
        <div className="course-card__badges">
          {sponsored && <span className="course-card__sponsored">Được tài trợ</span>}
          <span className={`course-card__status ${course.enrollmentStatus === 'closed' ? 'is-closed' : ''}`}>{enrollmentLabel(course)}</span>
        </div>
        <span className="course-card__rating"><Star size={14} fill="currentColor" /> {rating.total ? `${rating.average.toFixed(1)} · ${rating.total} đánh giá` : 'Mới'}</span>
      </div>
      <h3>{course.title}</h3>
      <div className="course-card__provider">
        <div className="course-card__teacher" title={isCenter ? course.teacher.name : `GV. ${course.teacher.name}`}>
          <span className="course-card__avatar" aria-hidden="true">
            {course.teacher.avatar ? <img src={course.teacher.avatar} alt="" /> : <DefaultRoleAvatar role={course.teacher.role} size={13} />}
          </span>
          <Link className="course-card__teacher-name" to={ROUTES.TEACHER_PROFILE(course.teacher.id)}>{isCenter ? course.teacher.name : `GV. ${course.teacher.name}`}</Link>
        </div>
        {course.teacher.role !== 'student' && <span className={`course-card__trust ${trustCount < 3 ? 'is-new' : ''}`}>
          {trustCount < 3 ? 'Mới trên EduMatch' : <><Heart size={13} fill="currentColor" /> {trustCount} tin tưởng</>}
        </span>}
        <VerifiedBadge userId={course.teacher.id} />
      </div>
      <div className="course-card__facts">
        <span><CalendarDays size={15} /> {paymentLabel(course.paymentType)}</span>
        {course.sessions && <span><Clock3 size={15} /> {course.sessions} buổi</span>}
        <span><Monitor size={15} /> {modeLabel(course)}</span>
      </div>
      <div className="course-card__bottom">
        <strong>{formatCurrency(course.price)}</strong>
        <div className="course-card__actions">
          {editable && <Link className="course-card__edit" to={`${ROUTES.CREATE_COURSE}?edit=${course.id}`}>Chỉnh sửa</Link>}
          <Link to={ROUTES.COURSE_DETAIL(course.id)}>Xem chi tiết <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </article>
  );
}
