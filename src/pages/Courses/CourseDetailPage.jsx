import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, Clock3, Heart, LockKeyhole, MessageCircle, Monitor, Pencil, Phone, Send, Star, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { courseError, courseService, providerService } from '@/services/courseService';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { ImageAttachment } from '@/components/forms/ImageAttachment';
import { RoleAvatar, normalizeRole } from '@/components/common/DefaultRoleAvatar';
import { ContentMenu } from '@/components/feedback/ContentMenu';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { DiscussionMedia } from '@/components/feedback/ExpandableImage';
import { LikesModal } from '@/components/feedback/LikesModal';
import { RequestNotice, Skeleton } from '@/components/feedback/RequestState';
import { CourseDetailLoading } from './LearningLoading';
import { submitOnPlainEnter } from '@/utils/submitOnPlainEnter';
import { formatRelativeTime } from '@/utils/formatDate';
import { enrollmentLabel, getAge, modeLabel, paymentLabel } from '@/features/learning/marketplace';
import './courses.css';

const formatCurrency = (value) =>
  Number(value) > 0 ? `${new Intl.NumberFormat('vi-VN').format(value)}đ` : 'Liên hệ';

const ReviewAuthor = ({ authorId, name, isAnonymous = false, anonymousLabel = 'Học viên ẩn danh' }) =>
  !isAnonymous && authorId
    ? <Link className="review-author-link" to={ROUTES.TEACHER_PROFILE(authorId)}>{name}</Link>
    : <strong>{isAnonymous ? anonymousLabel : name}</strong>;

const anonymousCodeFromId = (id) => {
  const numericHash = [...String(id || '')].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7);
  return `HV-${numericHash.toString(36).slice(-4).toUpperCase().padStart(4, '0')}`;
};

const getAnonymousReviewLabel = (review) => `Học viên ẩn danh ${review.anonymousCode || anonymousCodeFromId(review.id)}`;

function ReviewContentEditor({ text, media, onCancel, onSave }) {
  const [draft, setDraft] = useState(text || '');
  const [attachment, setAttachment] = useState(media || null);

  return (
    <form className="review-reply-form review-content-editor" onSubmit={(event) => {
      event.preventDefault();
      onSave(draft.trim(), attachment);
    }}>
      <textarea aria-label="Nội dung chỉnh sửa" autoFocus rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={submitOnPlainEnter} />
      <ImageAttachment value={attachment} onChange={setAttachment} />
      <div className="review-content-editor__actions">
        <button type="button" onClick={onCancel}>Hủy</button>
        <button type="submit">Lưu</button>
      </div>
    </form>
  );
}

export function CourseDetailPage() {
  const { courseId } = useParams();
  const { user } = useAuth();
  return <CourseDetails key={courseId + ':' + (user?.id ?? 'guest')} courseId={courseId} />;
}

function CourseDetails({ courseId }) {
  const navigate = useNavigate();
  const chatOpening = useRef(false);
  const isSubmittingReview = useRef(false);
  const { user, isAuthenticated } = useAuth();
  const { isOnline } = useOnlinePresence(user?.id);
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewMedia, setReviewMedia] = useState(null);
  const [isAnonymousReview, setIsAnonymousReview] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyMedia, setReplyMedia] = useState({});
  const [openContentMenu, setOpenContentMenu] = useState(null);
  const [editingContent, setEditingContent] = useState(null);
  const [likesTarget, setLikesTarget] = useState(null);
  const [message, setMessage] = useState('Chào thầy/cô, em muốn trao đổi thêm để sắp xếp lịch học phù hợp ạ.');
  const [showMessage, setShowMessage] = useState(false);
  const [course, setCourse] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [courseAttempt, setCourseAttempt] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState(false);
  const [reviewsAttempt, setReviewsAttempt] = useState(0);
  const retryReviews = () => {
    setReviewsLoading(true);
    setReviewsError(false);
    setReviewsAttempt((value) => value + 1);
  };
  const retryCourse = () => {
    setLoadError(null);
    setCourseAttempt((value) => value + 1);
    if (reviewsError) retryReviews();
  };
  const [confirmAction, setConfirmAction] = useState(null);
  const saving = useRef(false);
  useEffect(() => {
    let active = true;
    courseService.show(courseId).then((data) => {
      if (active) setCourse(data);
    }).catch((error) => {
      if (active) setLoadError(error);
    });
    return () => { active = false; };
  }, [courseId, courseAttempt]);

  useEffect(() => {
    let active = true;
    courseService.reviews(courseId).then((data) => {
      if (active) setReviews(data);
    }).catch((error) => {
      if (active) setReviewsError(error.response?.status !== 404);
    }).finally(() => { if (active) setReviewsLoading(false); });
    return () => { active = false; };
  }, [courseId, reviewsAttempt]);

  const displayReviews = reviews;
  const averageRating = displayReviews.length
    ? displayReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / displayReviews.length
    : 0;
  if (!course && !loadError) return <CourseDetailLoading />;
  if (!course && loadError?.response?.status !== 404) return (
    <section className="learning-page">
      <div className="learning-container">
        <RequestNotice title="Không tải được khóa học" description="Vui lòng thử lại sau ít phút." onRetry={retryCourse}>
          <Link to={ROUTES.HOME}>Về trang chủ</Link>
        </RequestNotice>
      </div>
    </section>
  );
  if (!course) return <section className="learning-page"><div className="learning-empty"><h1>Không tìm thấy khóa học</h1><p>Khóa học có thể đã được gỡ hoặc đường dẫn không còn hợp lệ.</p><Link to={ROUTES.HOME}>Về trang chủ</Link></div></section>;
  const isCourseOwner = isAuthenticated && user?.id === course.teacher?.id;
  const hasRatedCourse = displayReviews.some((item) => item.isOwner);
  const teacherRole = normalizeRole(course.teacher?.role, course.teacher?.name, course.teacher?.id, 'teacher');
  const isCenterCourse = teacherRole === 'center';
  const providerIsOnline = isOnline(course.teacher?.id);
  const providerType = isCenterCourse ? 'Trung tâm Đào tạo' : 'giáo viên';
  const publicPhone = Boolean(course.teacher?.isPhonePublic && course.teacher?.phone);
  const providerTrustCount = course.teacher.heartCount;
  const isEnrollmentOpen = course.enrollmentStatus !== 'closed';
  const updateEnrollmentStatus = async () => {
    if (saving.current) return;
    saving.current = true;
    const status = isEnrollmentOpen ? 'closed' : 'open';
    try {
      setCourse(await courseService.updateEnrollmentStatus(course.id, status));
      toast.success(status === 'open' ? 'Lớp đã được mở tuyển sinh.' : 'Lớp đã đóng tuyển sinh.');
    } catch (error) {
      toast.error(courseError(error));
    } finally {
      saving.current = false;
    }
  };
  const changeReview = async (action, onSuccess, refreshProvider = false) => {
    if (isSubmittingReview.current) return;
    isSubmittingReview.current = true;
    try {
      await action();
      onSuccess?.();
      setReviews(await courseService.reviews(courseId));
      if (refreshProvider) {
        const provider = await providerService.show(course.teacher.id);
        setCourse((current) => ({ ...current, teacher: { ...current.teacher, heartCount: provider.heartCount } }));
      }
    } catch (error) {
      toast.error(courseError(error));
    } finally {
      isSubmittingReview.current = false;
    }
  };
  const review = (event) => {
    event.preventDefault();
    if (user?.role !== 'student') { toast.error('Vui lòng đăng nhập với tài khoản học viên để đánh giá.'); return; }
    if (hasRatedCourse) { toast.error('Bạn chỉ có thể đánh giá sao một lần cho mỗi khóa học.'); return; }
    if (!comment.trim() && !reviewMedia) { toast.error('Hãy viết nhận xét hoặc đính kèm ảnh trước khi gửi.'); return; }
    changeReview(() => courseService.addReview(courseId, { rating, comment: comment.trim(), media: reviewMedia, isAnonymous: isAnonymousReview }), () => {
      setComment('');
      setReviewMedia(null);
      setIsAnonymousReview(false);
      toast.success('Cảm ơn đánh giá của bạn!');
    }, true);
  };
  const replyToReview = (event, review) => {
    event.preventDefault();
    const text = String(replyDrafts[review.id] || '').trim();
    const media = replyMedia[review.id] || null;
    if (!text && !media) return;
    changeReview(() => courseService.addReply(review.id, { comment: text, media }), () => {
      setReplyDrafts((current) => ({ ...current, [review.id]: '' }));
      setReplyMedia((current) => ({ ...current, [review.id]: null }));
      toast.success('Đã gửi phản hồi.');
    });
  };
  const reviewPath = (review, reply) => reply ? '/review-replies/' + reply.id : '/reviews/' + review.id;
  const toggleReviewLike = (review, reply = null) => {
    if (!isAuthenticated) { toast.error('Vui lòng đăng nhập để thích bình luận.'); return; }
    changeReview(() => courseService.likeReview(reviewPath(review, reply), !(reply || review).likes.includes(user.id)));
  };
  const saveReviewContent = (review, reply, text, media) => {
    if (!(reply || review).isOwner || (!text && !media)) return;
    changeReview(() => courseService.editReview(reviewPath(review, reply), { comment: text, media }), () => setEditingContent(null));
  };
  const removeReviewContent = (review, reply = null) => {
    if (!(reply || review).isOwner) return;
    setConfirmAction({
      title: reply ? 'Xóa phản hồi' : 'Xóa đánh giá',
      message: reply ? 'Bạn có chắc chắn muốn xóa phản hồi này?' : 'Bạn có chắc chắn muốn xóa đánh giá này?',
      confirmText: 'Xóa',
      onConfirm: () => changeReview(() => courseService.removeReview(reviewPath(review, reply)), null, !reply),
    });
  };
  const send = async (event) => {
    event.preventDefault();
    if (!isAuthenticated) { toast.error(`Vui lòng đăng nhập để nhắn tin với ${providerType}.`); return; }
    if (!message.trim() || chatOpening.current) return;
    chatOpening.current = true;
    try {
      const { conversation } = await courseService.enroll(course.id, message.trim());
      setShowMessage(false);
      navigate(`${ROUTES.MESSAGES}?conversation=${conversation.id}`);
    } catch (error) { toast.error(courseError(error)); }
    finally { chatOpening.current = false; }
  };
  return <><section className="learning-page"><div className="learning-container course-detail">
    <Link className="back-link" to={ROUTES.HOME}><ArrowLeft size={17} /> Tất cả khóa học</Link>
    <div className="course-detail__grid"><article className="course-detail__main">
      <span className="course-detail__eyebrow">{modeLabel(course)} · {paymentLabel(course.paymentType)} · {enrollmentLabel(course)}</span>
      <h1>{course.title}</h1><p className="course-detail__lead">{course.description}</p>
      <div className="course-stat-grid"><span><CalendarDays size={19} /><strong>{course.paymentType === 'monthly' ? `${course.sessionsPerWeek} buổi/tuần` : course.sessions ? `${course.sessions} buổi học` : 'Linh hoạt'}</strong></span><span><Clock3 size={19} /><strong>{course.duration ? `${course.duration} phút/buổi` : paymentLabel(course.paymentType)}</strong></span><span><Monitor size={19} /><strong>{modeLabel(course)}</strong></span></div>
      {course.schedule && <section className="detail-block"><h2>Lịch học dự kiến</h2><p>{course.schedule}</p></section>}
      {course.learningMode === 'in-person' && <section className="detail-block"><h2>Địa điểm</h2><p>{course.inPersonType === 'home' ? 'Nhận dạy tại ' : 'Lớp học tại '}{course.location}</p></section>}
      <section className="teacher-profile-card"><div className="teacher-profile-card__avatar"><RoleAvatar src={course.teacher.avatar} userId={course.teacher.id} name={course.teacher.name} role={teacherRole} size={23} alt={`Ảnh đại diện của ${course.teacher.name}`} /></div><div className="teacher-profile-card__info"><p>{isCenterCourse ? 'TRUNG TÂM ĐÀO TẠO' : 'GIÁO VIÊN ĐỒNG HÀNH'}</p><Link className="teacher-profile-card__name" to={ROUTES.TEACHER_PROFILE(course.teacher.id)}><h2>{course.teacher.name}</h2></Link><span className={`teacher-profile-card__trust ${providerTrustCount < 3 ? 'is-new' : ''}`}>{providerTrustCount < 3 ? 'Mới trên EduMatch' : <><Heart size={14} fill="currentColor" /> {providerTrustCount} lượt tin tưởng</>}</span><VerifiedBadge userId={course.teacher.id} provider={course.teacher} />{course.teacher.bio && <p className="teacher-profile-card__intro">{course.teacher.bio}</p>}</div><div className="teacher-profile-card__details"><dl className="teacher-profile-card__facts"><div><dt>Lĩnh vực giảng dạy</dt><dd>{course.teacher.teachingField || course.subject || 'Đang cập nhật'}</dd></div>{isCenterCourse ? <div><dt>Năm thành lập</dt><dd>{course.teacher.foundedYear || 'Đang cập nhật'}</dd></div> : <><div><dt>Tuổi</dt><dd>{getAge(course.teacher.dob)} tuổi</dd></div><div><dt>Bằng cấp, chứng chỉ</dt><dd>{course.teacher.qualifications || 'Đang cập nhật'}</dd></div><div><dt>Kinh nghiệm giảng dạy</dt><dd>{course.teacher.experience || 'Đang cập nhật'}</dd></div></>}</dl>{publicPhone && <a className="teacher-profile-card__phone" href={`tel:${course.teacher.phone.replace(/\s/g, '')}`}><Phone size={16} /><span>Số điện thoại liên hệ</span><strong>{course.teacher.phone}</strong></a>}</div></section>
      <section className="review-section"><div className="detail-block__head"><div><h2>Đánh giá khóa học</h2></div>{displayReviews.length > 0 && <div className="review-summary"><Star size={18} fill="currentColor" /><strong>{averageRating.toFixed(1)}</strong><span>/ 5 · {displayReviews.length} đánh giá</span></div>}</div>
        {reviewsLoading && <div className="learning-skeleton__person">
          <span className="sr-only" role="status">Đang tải đánh giá</span>
          <Skeleton width={34} height={34} className="request-skeleton--round" />
          <div className="learning-skeleton__lines"><Skeleton width="35%" /><Skeleton width="72%" /></div>
        </div>}
        {reviewsError && <RequestNotice title="Không tải được đánh giá" onRetry={retryReviews} />}
        {!reviewsLoading && !reviewsError && (!isAuthenticated || user?.role === 'student') && !hasRatedCourse && <form className="review-form" onSubmit={review}><div className="star-picker" aria-label="Chọn số sao">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} sao`}><Star size={21} fill={value <= rating ? 'currentColor' : 'none'} /></button>)}</div><textarea value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={submitOnPlainEnter} placeholder="Chia sẻ trải nghiệm của bạn về khóa học..." rows="3" /><div className="review-form__actions"><label className="anonymous-choice"><input type="checkbox" checked={isAnonymousReview} onChange={(event) => setIsAnonymousReview(event.target.checked)} /> Đánh giá ẩn danh</label><ImageAttachment id="review-image" value={reviewMedia} onChange={setReviewMedia} /><button type="submit">Gửi đánh giá</button></div></form>}
        <div className="review-list">{displayReviews.map((item) => {
          const isReviewLiked = (item.likes || []).includes(user?.id);
          return <article key={item.id}>
            <div className="discussion-item__head"><ReviewAuthor authorId={item.authorId} name={item.author} isAnonymous={item.isAnonymous} anonymousLabel={getAnonymousReviewLabel(item)} /><span className="review-item__rating">{Array.from({ length: item.rating }, (_, index) => <Star key={index} size={13} fill="currentColor" />)}</span>{item.isOwner && <ContentMenu id={`review-${item.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => setEditingContent(`review-${item.id}`)} onDelete={() => removeReviewContent(item)} label="đánh giá" />}</div>
            {editingContent === `review-${item.id}` && item.isOwner ? <ReviewContentEditor text={item.comment} media={item.media} onCancel={() => setEditingContent(null)} onSave={(text, media) => saveReviewContent(item, null, text, media)} /> : <>{item.comment && <p>{item.comment}</p>}<DiscussionMedia media={item.media} className="review-media" alt="Ảnh đính kèm trong đánh giá" expandable /></>}<time className="review-item__time" dateTime={item.createdAt || undefined}>{formatRelativeTime(item.createdAt)}</time>
            <div className="review-item__actions"><button type="button" className={isReviewLiked ? 'is-liked' : ''} onClick={() => toggleReviewLike(item)}><Heart size={14} fill={isReviewLiked ? 'currentColor' : 'none'} /> Thích</button>{item.likes?.length > 0 && <button type="button" className="review-likes-count" onClick={() => setLikesTarget({ people: item.likedBy, label: 'Những người đã thích đánh giá này' })}>{item.likes.length} lượt thích</button>}</div>
            {item.replies?.length > 0 && <div className="review-replies">{item.replies.map((reply) => {
              const isReplyLiked = (reply.likes || []).includes(user?.id);
              return <div className="review-reply" key={reply.id}><div className="discussion-item__head"><div className="review-reply__identity"><ReviewAuthor authorId={reply.authorId} name={reply.author} isAnonymous={reply.isAnonymous} anonymousLabel={getAnonymousReviewLabel(item)} />{reply.isReviewOwner && <span>Chủ đánh giá</span>}</div>{reply.isOwner && <ContentMenu id={`review-reply-${reply.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => setEditingContent(`review-reply-${reply.id}`)} onDelete={() => removeReviewContent(item, reply)} label="phản hồi" />}</div>{editingContent === `review-reply-${reply.id}` && reply.isOwner ? <ReviewContentEditor text={reply.text} media={reply.media} onCancel={() => setEditingContent(null)} onSave={(text, media) => saveReviewContent(item, reply, text, media)} /> : <>{reply.text && <p>{reply.text}</p>}<DiscussionMedia media={reply.media} className="review-media" alt="Ảnh đính kèm trong phản hồi" expandable /></>}<time className="review-reply__time" dateTime={reply.createdAt || undefined}>{formatRelativeTime(reply.createdAt)}</time><div className="review-reply__actions"><button type="button" className={isReplyLiked ? 'is-liked' : ''} onClick={() => toggleReviewLike(item, reply)}><Heart size={13} fill={isReplyLiked ? 'currentColor' : 'none'} /> Thích</button>{reply.likes?.length > 0 && <button type="button" className="review-likes-count" onClick={() => setLikesTarget({ people: reply.likedBy, label: 'Những người đã thích phản hồi này' })}>{reply.likes.length} lượt thích</button>}</div></div>;
            })}</div>}
            {isAuthenticated && <form className="review-reply-form" onSubmit={(event) => replyToReview(event, item)}><textarea value={replyDrafts[item.id] || ''} onChange={(event) => setReplyDrafts((current) => ({ ...current, [item.id]: event.target.value }))} onKeyDown={submitOnPlainEnter} placeholder="Viết phản hồi..." aria-label={`Phản hồi đánh giá của ${item.isAnonymous ? 'học viên ẩn danh' : item.author}`} rows="1" /><ImageAttachment id={`review-reply-image-${item.id}`} value={replyMedia[item.id] || null} onChange={(media) => setReplyMedia((current) => ({ ...current, [item.id]: media }))} /><button type="submit" aria-label="Gửi phản hồi" title="Gửi phản hồi"><Send size={15} aria-hidden="true" /></button></form>}
          </article>;
        })}</div>
      </section>
    </article><aside className="course-enroll-card"><span>HỌC PHÍ</span><strong>{formatCurrency(course.price)}</strong><small>{paymentLabel(course.paymentType)}</small><span className={`course-enroll-status ${isEnrollmentOpen ? '' : 'is-closed'}`}>{enrollmentLabel(course)}</span>{isCourseOwner ? <div className="course-owner-control"><p>{isEnrollmentOpen ? 'Lớp đang nhận học viên mới.' : 'Lớp đã tạm dừng nhận học viên mới.'}</p><Link className="course-edit-link" to={`${ROUTES.CREATE_COURSE}?edit=${course.id}`}><Pencil size={16} /> Chỉnh sửa khóa học</Link><button type="button" onClick={updateEnrollmentStatus}>{isEnrollmentOpen ? <><LockKeyhole size={17} /> Đóng lớp</> : 'Mở lớp'}</button></div> : isEnrollmentOpen ? <button onClick={() => setShowMessage(true)}><MessageCircle size={18} /> Đăng ký học</button> : <p className="course-closed-note"><LockKeyhole size={17} /> Lớp đã đóng tuyển sinh. Vui lòng xem khóa học khác.</p>}<ul><li>Trao đổi trực tiếp với giáo viên</li><li>Thống nhất lịch phù hợp trước khi học</li></ul></aside></div>
    {showMessage && <div className="message-panel" role="dialog" aria-modal="true" aria-label={`Nhắn tin với ${providerType}`}><form className="message-dialog" onSubmit={send}><header className="message-dialog__header"><span className="message-dialog__icon"><MessageCircle size={20} /></span><div><p>NHẮN TIN TRỰC TIẾP</p><h2>Hẹn lịch học</h2></div><button className="message-dialog__close" type="button" onClick={() => setShowMessage(false)} aria-label="Đóng hộp nhắn tin"><ArrowLeft size={20} className="message-dialog__close-back hidden" aria-hidden="true" /><X size={19} className="message-dialog__close-x" aria-hidden="true" /></button></header><div className="message-dialog__recipient"><span><RoleAvatar src={course.teacher.avatar} userId={course.teacher.id} name={course.teacher.name} role={teacherRole} size={18} alt="" /></span><div><strong>{course.teacher.name}</strong><small>{isCenterCourse ? 'Trung tâm của khóa học này' : 'Giáo viên của khóa học này'}</small></div><i className={providerIsOnline ? 'is-online' : ''}>{providerIsOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}</i></div><label className="message-dialog__field">Lời nhắn mở đầu<textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={submitOnPlainEnter} rows="5" /></label><p className="message-dialog__hint">Hai bên sẽ tự trao đổi để thống nhất lịch học phù hợp.</p><div className="message-dialog__actions"><button className="message-dialog__cancel" type="button" onClick={() => setShowMessage(false)}>Để sau</button><button className="message-dialog__send" type="submit"><Send size={17} /> Gửi tin nhắn</button></div></form></div>}
  </div></section><LikesModal target={likesTarget} onClose={() => setLikesTarget(null)} /><ConfirmDialog open={Boolean(confirmAction)} title={confirmAction?.title} message={confirmAction?.message} confirmText={confirmAction?.confirmText || 'Xóa'} cancelText="Hủy" onCancel={() => setConfirmAction(null)} onConfirm={() => { confirmAction?.onConfirm?.(); setConfirmAction(null); }} /></>;
}
