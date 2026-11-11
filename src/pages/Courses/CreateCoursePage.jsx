import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MapPin, Monitor, PlusCircle, Video } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { courseError, courseService } from '@/services/courseService';
import { AdministrativePicker } from '@/components/forms/AdministrativePicker';
import { Modal } from '@/components/feedback/Modal';
import { RequestNotice } from '@/components/feedback/RequestState';
import { CourseEditorLoading } from './LearningLoading';
import { useAdministrativeOptions } from '@/hooks/useAdministrativeOptions';
import './courses.css';

const emptyForm = {
  title: '', description: '', price: '', paymentType: 'full-course', sessions: '', duration: '',
  sessionsPerWeek: '', schedule: '', learningMode: 'online', inPersonType: 'classroom', enrollmentStatus: 'open', province: '', ward: '',
};

const COURSE_TITLE_MAX_LENGTH = 80;
const COURSE_DESCRIPTION_MAX_LENGTH = 1200;
const parseVnd = (value) => Number(String(value).replace(/[^\d]/g, ''));

export function CreateCoursePage() {
  const [searchParams] = useSearchParams();
  const editingCourseId = searchParams.get('edit');
  return <CourseEditor key={editingCourseId || 'new'} editingCourseId={editingCourseId} />;
}

function CourseEditor({ editingCourseId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEditing = Boolean(editingCourseId);
  const [editingCourse, setEditingCourse] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const saving = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    if (!editingCourseId || !user?.id) return;
    let active = true;
    courseService.show(editingCourseId).then((course) => {
      if (!active) return;
      setEditingCourse(course);
      setForm(Object.fromEntries(Object.entries(emptyForm).map(([key, fallback]) => [key, course[key] ?? fallback])));
    }).catch((error) => {
      if (active) setLoadError(courseError(error));
    });
    return () => { active = false; };
  }, [editingCourseId, user?.id, loadAttempt]);
  const [errors, setErrors] = useState({});
  const [isDescriptionEditorOpen, setIsDescriptionEditorOpen] = useState(false);
  const isEducationProvider = ['teacher', 'center'].includes(user?.role);
  const update = (event) => {
    const { name, value } = event.target;
    const maxLength = name === 'title'
      ? COURSE_TITLE_MAX_LENGTH
      : name === 'description'
        ? COURSE_DESCRIPTION_MAX_LENGTH
        : null;
    const nextValue = maxLength ? value.slice(0, maxLength) : value;
    setForm((current) => {
      if (name === 'learningMode' && nextValue === 'recorded') return { ...current, learningMode: nextValue, paymentType: 'full-course' };
      if (name === 'paymentType' && current.learningMode === 'recorded') return current;
      return { ...current, [name]: nextValue };
    });
  };
  const { administrativeProvinces, wardOptions, error: areaError } = useAdministrativeOptions(form.province);
  const selectLocation = (name) => (value) => setForm((current) => ({
    ...current,
    [name]: value,
    ...(name === 'province' ? { ward: '' } : {}),
  }));
  const submit = async (event) => {
    event.preventDefault();
    if (saving.current) return;
    const nextErrors = {};
    ['title', 'description'].forEach((name) => { if (!String(form[name]).trim()) nextErrors[name] = 'Vui lòng điền thông tin này'; });
    if (String(form.title).length > COURSE_TITLE_MAX_LENGTH) nextErrors.title = `Tên khóa học không được vượt quá ${COURSE_TITLE_MAX_LENGTH} ký tự`;
    if (String(form.description).length > COURSE_DESCRIPTION_MAX_LENGTH) nextErrors.description = `Mô tả khóa học không được vượt quá ${COURSE_DESCRIPTION_MAX_LENGTH} ký tự`;
    const price = parseVnd(form.price);
    if (form.price && (!Number.isFinite(price) || price <= 0)) nextErrors.price = 'Học phí cần lớn hơn 0';
    const paymentType = form.learningMode === 'recorded' ? 'full-course' : form.paymentType;
    if (paymentType === 'full-course' && !form.sessions) nextErrors.sessions = 'Nhập số buổi học';
    if (paymentType === 'full-course' && !form.duration) nextErrors.duration = 'Nhập thời lượng mỗi buổi';
    if (paymentType === 'monthly' && !form.sessionsPerWeek) nextErrors.sessionsPerWeek = 'Nhập số buổi mỗi tuần';
    if (form.learningMode === 'in-person' && !form.province.trim()) nextErrors.province = 'Vui lòng chọn tỉnh hoặc thành phố';
    if (form.learningMode === 'in-person' && !form.ward.trim()) nextErrors.ward = 'Vui lòng chọn xã, phường hoặc đặc khu';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const courseData = {
      ...form, paymentType, price: form.price ? price : null,
      subjectId: editingCourse?.subjectId ?? null,
    };
    saving.current = true;
    setIsSaving(true);
    try {
      const course = isEditing
        ? await courseService.update(editingCourse.id, courseData)
        : await courseService.create(courseData);
      toast.success(isEditing ? 'Thông tin khóa học đã được cập nhật.' : 'Khóa học đã được đăng và mở tuyển sinh.');
      navigate(ROUTES.COURSE_DETAIL(course.id));
    } catch (error) {
      const validation = error.response?.data?.errors || {};
      setErrors(Object.fromEntries(Object.entries(validation).map(([field, messages]) => [field, messages[0]])));
      toast.error(courseError(error));
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };
  if (!isEducationProvider) return <section className="learning-page"><div className="learning-empty"><h1>Khu vực dành cho Giáo viên và Trung tâm Đào tạo</h1><p>Bạn cần đăng nhập bằng tài khoản giáo viên hoặc trung tâm để tạo khóa học.</p><Link to={ROUTES.HOME}>Về trang chủ</Link></div></section>;
  if (isEditing && !editingCourse) {
    if (!loadError) return <CourseEditorLoading />;
    return <section className="learning-page"><div className="learning-container">
      <RequestNotice title="Không mở được khóa học để chỉnh sửa" onRetry={() => { setLoadError(''); setLoadAttempt((value) => value + 1); }}>
        <Link to={ROUTES.HOME}>Về trang chủ</Link>
      </RequestNotice>
    </div></section>;
  }
  if (isEditing && String(editingCourse.teacher?.id) !== String(user?.id)) return <section className="learning-page"><div className="learning-empty"><h1>Bạn không thể chỉnh sửa khóa học này</h1><p>Chỉ đơn vị đã tạo khóa học mới có quyền cập nhật nội dung.</p><Link to={ROUTES.HOME}>Về trang chủ</Link></div></section>;
  return (
    <section className="learning-page">
      <div className="learning-container course-editor">
        <Link className="back-link" to={isEditing ? ROUTES.COURSE_DETAIL(editingCourse.id) : ROUTES.HOME}><ArrowLeft size={17} /> {isEditing ? 'Quay về khóa học' : 'Quay về trang chủ'}</Link>
        <div className="page-intro"><span><PlusCircle size={16} /> {isEditing ? 'CẬP NHẬT KHÓA HỌC' : 'KHÓA HỌC MỚI'}</span><h1>{isEditing ? 'Cập nhật thông tin khóa học.' : 'Thiết kế lớp học rõ ràng, dễ lựa chọn.'}</h1><p>Thông tin này sẽ hiển thị cho học viên khi họ khám phá khóa học của bạn.</p></div>
        <form className="course-form" onSubmit={submit} noValidate>
          <section className="form-surface form-surface--main">
            <div className="form-heading"><h2>Thông tin khóa học</h2></div>
            <Field label="Tên khóa học" error={errors.title}><input name="title" value={form.title} onChange={update} maxLength={COURSE_TITLE_MAX_LENGTH} aria-describedby="course-title-counter" aria-invalid={form.title.length >= COURSE_TITLE_MAX_LENGTH} className={form.title.length >= COURSE_TITLE_MAX_LENGTH ? 'is-limit' : ''} placeholder="Ví dụ: Luyện thi IELTS từ nền tảng đến 6.5" /><small id="course-title-counter" className={`course-title-counter ${form.title.length >= COURSE_TITLE_MAX_LENGTH ? 'is-limit' : ''}`} aria-live="polite">{form.title.length}/{COURSE_TITLE_MAX_LENGTH} ký tự</small></Field>
            {areaError && <p className="field-error" role="alert">{areaError}</p>}
            <Field label="Mô tả khóa học" error={errors.description}><textarea name="description" value={form.description} readOnly onFocus={(event) => { event.currentTarget.blur(); setIsDescriptionEditorOpen(true); }} onClick={(event) => { event.currentTarget.blur(); setIsDescriptionEditorOpen(true); }} rows="3" aria-describedby="course-description-counter" aria-invalid={form.description.length >= COURSE_DESCRIPTION_MAX_LENGTH} className={`course-description-preview ${form.description.length >= COURSE_DESCRIPTION_MAX_LENGTH ? 'is-limit' : ''}`} placeholder="Mục tiêu, lộ trình và phương pháp giảng dạy của khóa học..." /><small id="course-description-counter" className={`course-title-counter ${form.description.length >= COURSE_DESCRIPTION_MAX_LENGTH ? 'is-limit' : ''}`} aria-live="polite">{form.description.length}/{COURSE_DESCRIPTION_MAX_LENGTH} ký tự</small></Field>
            <Field label="Mức học phí (VNĐ)" hint="Không bắt buộc" error={errors.price}><input name="price" value={form.price} onChange={update} inputMode="numeric" placeholder="Điền học phí" /></Field>
            <fieldset className="radio-field"><legend>Hình thức đóng học phí</legend><div className="segmented-control">
              {[['full-course','Đóng trọn khóa'],['monthly','Đóng theo tháng'],['session','Đóng theo buổi']].map(([value,label]) => {
                const isLocked = form.learningMode === 'recorded' && value !== 'full-course';
                return <label key={value} className={isLocked ? 'is-disabled' : ''}><input type="radio" name="paymentType" value={value} checked={form.paymentType === value} onChange={update} disabled={isLocked} /><span>{label}</span></label>;
              })}
            </div>{form.learningMode === 'recorded' && <p className="payment-lock-note">Video quay sẵn chỉ hỗ trợ thanh toán trọn khóa.</p>}</fieldset>
            {form.paymentType === 'full-course' && <div className="form-split"><Field label="Số buổi học" error={errors.sessions}><input name="sessions" value={form.sessions} onChange={update} inputMode="numeric" placeholder="Ví dụ: 12" /></Field><Field label="Thời lượng mỗi buổi (phút)" error={errors.duration}><input name="duration" value={form.duration} onChange={update} inputMode="numeric" placeholder="Ví dụ: 90 phút" /></Field></div>}
            {form.paymentType === 'monthly' && <Field label="Số buổi học mỗi tuần" error={errors.sessionsPerWeek}><input name="sessionsPerWeek" value={form.sessionsPerWeek} onChange={update} inputMode="numeric" placeholder="Ví dụ: 2" /></Field>}
            <Field label="Lịch học dự kiến" hint="Không bắt buộc"><textarea name="schedule" value={form.schedule} onChange={update} rows="3" placeholder="Ví dụ: Thứ 3, Thứ 6 từ 19:00 – 20:30" /></Field>
          </section>
          <aside className="form-surface form-surface--side">
            <div className="form-heading"><h2>Hình thức học</h2></div>
            <div className="learning-mode-options">
              <label className={form.learningMode === 'online' ? 'is-selected' : ''}><input type="radio" name="learningMode" value="online" checked={form.learningMode === 'online'} onChange={update} /><span><Monitor size={20} /><strong>Trực tuyến</strong></span></label>
              <label className={form.learningMode === 'in-person' ? 'is-selected' : ''}><input type="radio" name="learningMode" value="in-person" checked={form.learningMode === 'in-person'} onChange={update} /><span><MapPin size={20} /><strong>Trực tiếp</strong></span></label>
              <label className={form.learningMode === 'recorded' ? 'is-selected' : ''}><input type="radio" name="learningMode" value="recorded" checked={form.learningMode === 'recorded'} onChange={update} /><span><Video size={20} /><strong>Video quay sẵn</strong></span></label>
            </div>
            {form.learningMode === 'in-person' && <>
              <fieldset className="radio-field"><legend>Địa điểm giảng dạy</legend><div className="segmented-control"><label><input type="radio" name="inPersonType" value="classroom" checked={form.inPersonType === 'classroom'} onChange={update} /><span>Dạy tại lớp</span></label><label><input type="radio" name="inPersonType" value="home" checked={form.inPersonType === 'home'} onChange={update} /><span>Dạy tại nhà</span></label></div></fieldset>
              <div className="form-split">
                <div className="form-location-field"><AdministrativePicker id="course-province" label="Tỉnh / Thành phố" value={form.province} options={administrativeProvinces} onSelect={selectLocation('province')} placeholder="Gõ để tìm tỉnh/thành, rồi chọn" />{errors.province && <small className="field-error">{errors.province}</small>}</div>
                <div className="form-location-field"><AdministrativePicker id="course-ward" label={form.inPersonType === 'classroom' ? 'Xã / Phường / Đặc khu có lớp' : 'Xã / Phường / Đặc khu nhận dạy'} value={form.ward} options={wardOptions} onSelect={selectLocation('ward')} placeholder={form.province ? 'Gõ để tìm xã/phường, rồi chọn' : 'Chọn tỉnh/thành trước'} disabled={!form.province} emptyText="Không tìm thấy xã/phường trong tỉnh/thành đã chọn." />{errors.ward && <small className="field-error">{errors.ward}</small>}</div>
              </div>
            </>}
            <button className="publish-course" type="submit" disabled={isSaving}>{isSaving ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Đăng khóa học'}</button>
          </aside>
        </form>
        <Modal
          open={isDescriptionEditorOpen}
          onClose={() => setIsDescriptionEditorOpen(false)}
          title="Mô tả khóa học"
          size="xl"
          className="course-description-editor"
          footer={<button type="button" className="course-description-editor__done" onClick={() => setIsDescriptionEditorOpen(false)}>Xong</button>}
        >
          <div className="course-description-editor__body">
            <textarea autoFocus name="description" value={form.description} onChange={update} rows="16" maxLength={COURSE_DESCRIPTION_MAX_LENGTH} placeholder="Mục tiêu, lộ trình và phương pháp giảng dạy của khóa học..." aria-label="Mô tả khóa học" />
            <p className={form.description.length >= COURSE_DESCRIPTION_MAX_LENGTH ? 'is-limit' : ''}>{form.description.length}/{COURSE_DESCRIPTION_MAX_LENGTH} ký tự</p>
          </div>
        </Modal>
      </div>
    </section>
  );
}

function Field({ label, hint, error, children }) { return <label className="form-field"><span>{label}{hint && <em>{hint}</em>}</span>{children}{error && <small className="field-error">{error}</small>}</label>; }
