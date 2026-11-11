import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/feedback/RequestState';
import { ROUTES } from '@/constants/routes';
import './learning-loading.css';

export function CourseDetailLoading() {
  return (
    <section className="learning-page">
      <div className="learning-container course-detail">
        <Link className="back-link" to={ROUTES.HOME}><ArrowLeft size={17} /> Tất cả khóa học</Link>
        <span className="sr-only" role="status">Đang tải khóa học</span>
        <div className="course-detail__grid" aria-hidden="true">
          <div className="course-detail__main learning-skeleton">
            <Skeleton width="36%" />
            <Skeleton width="85%" height="clamp(25px, 4vw, 42px)" />
            <div className="learning-skeleton__lines"><Skeleton width="96%" /><Skeleton width="74%" /></div>
            <div className="course-stat-grid learning-skeleton__stats">
              <Skeleton height={52} /><Skeleton height={52} /><Skeleton height={52} />
            </div>
            <div className="learning-skeleton__lines">
              <Skeleton width="32%" height={17} /><Skeleton width="57%" />
            </div>
            <div className="learning-skeleton__person">
              <Skeleton width={58} height={58} className="request-skeleton--round" />
              <div className="learning-skeleton__lines">
                <Skeleton width="56%" height={19} /><Skeleton width="36%" /><Skeleton width="82%" />
              </div>
            </div>
          </div>
          <div className="course-enroll-card learning-skeleton">
            <Skeleton width={55} />
            <Skeleton width="72%" height={31} />
            <Skeleton width="42%" />
            <Skeleton width="39%" height={21} className="request-skeleton--pill" />
            <Skeleton height={42} />
            <Skeleton width="78%" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function CourseEditorLoading() {
  return (
    <section className="learning-page">
      <div className="learning-container course-editor">
        <span className="sr-only" role="status">Đang tải khóa học để chỉnh sửa</span>
        <div className="page-intro learning-skeleton" aria-hidden="true">
          <Skeleton width="29%" /><Skeleton width="76%" height={32} />
        </div>
        <div className="course-form" aria-hidden="true">
          <div className="form-surface learning-skeleton">
            <Skeleton width="33%" height={19} />
            <Skeleton height={42} /><Skeleton height={96} /><Skeleton height={42} />
          </div>
          <div className="form-surface learning-skeleton">
            <Skeleton width="52%" height={19} />
            <Skeleton height={47} /><Skeleton height={47} /><Skeleton height={47} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProviderProfileLoading() {
  return (
    <section className="learning-page teacher-public-page">
      <div className="learning-container">
        <span className="sr-only" role="status">Đang tải hồ sơ công khai</span>
        <div aria-hidden="true">
          <div className="teacher-cover learning-skeleton__cover">
            <Skeleton width={76} height={76} className="request-skeleton--round" />
            <div className="learning-skeleton__lines">
              <Skeleton width="42%" /><Skeleton width="76%" height={28} /><Skeleton width="53%" />
            </div>
          </div>
          <div className="teacher-public-grid">
            <div className="teacher-bio learning-skeleton">
              <Skeleton width="47%" height={19} /><Skeleton width="90%" /><Skeleton width="64%" />
            </div>
            <div className="course-detail__main learning-skeleton">
              <Skeleton width="31%" height={20} />
              <div className="learning-skeleton__person">
                <Skeleton width={38} height={38} className="request-skeleton--round" />
                <div className="learning-skeleton__lines"><Skeleton width="50%" /><Skeleton width="31%" /></div>
              </div>
              <Skeleton width="91%" /><Skeleton width="69%" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
