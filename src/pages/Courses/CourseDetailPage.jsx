import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, Clock3, Heart, LockKeyhole, MessageCircle, Monitor, Pencil, Phone, Send, Star, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { chatService, chatError } from '@/services/chatService';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { ImageAttachment } from '@/components/forms/ImageAttachment';
import { DefaultRoleAvatar } from '@/components/common/DefaultRoleAvatar';
import { ContentMenu } from '@/components/feedback/ContentMenu';
import { LikesModal } from '@/components/feedback/LikesModal';
import { submitOnPlainEnter } from '@/utils/submitOnPlainEnter';
import { formatRelativeTime } from '@/utils/formatDate';
import { addCourseRatingTrust, addCourseReview, addCourseReviewReply, createConversationId, createNotification, deleteCourseReview, enrollmentLabel, getAge, getCourse, getCourseReviews, getProviderTrustCount, modeLabel, paymentLabel, toggleCourseReviewLike, trackProviderAffinity, updateCourse, updateCourseReview } from '@/features/learning/marketplace';
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
const createAnonymousCode = () => `HV-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export function CourseDetailPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const chatOpening = useRef(false);
  const { user, isAuthenticated } = useAuth();
  const { isOnline } = useOnlinePresence(user?.id);
  const [reviews, setReviews] = useState(() => getCourseReviews(courseId));
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewMedia, setReviewMedia] = useState(null);
  const [isAnonymousReview, setIsAnonymousReview] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyMedia, setReplyMedia] = useState({});
  const [openContentMenu, setOpenContentMenu] = useState(null);
  const [likesTarget, setLikesTarget] = useState(null);
  const [message, setMessage] = useState('Chào thầy/cô, em muốn trao đổi thêm để sắp xếp lịch học phù hợp ạ.');
  const [showMessage, setShowMessage] = useState(false);
  const [course, setCourse] = useState(() => getCourse(courseId));
  useEffect(() => {
    const refreshReviews = () => setReviews(getCourseReviews(courseId));
    window.addEventListener('edumatch:course-reviews-updated', refreshReviews);
    return () => window.removeEventListener('edumatch:course-reviews-updated', refreshReviews);
  }, [courseId]);
  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
    : 0;
  if (!course) return <section className="learning-page"><div className="learning-empty"><h1>Không tìm thấy khóa học</h1><p>Khóa học có thể đã được gỡ hoặc đường dẫn không còn hợp lệ.</p><Link to={ROUTES.HOME}>Về trang chủ</Link></div></section>;
  const isCourseOwner = isAuthenticated && user?.id === course.teacher.id;
  const hasRatedCourse = isAuthenticated && reviews.some((item) => item.authorId === user?.id);
  const isCenterCourse = course.teacher?.role === 'center';
  const providerIsOnline = isOnline(course.teacher?.id);
  const providerType = isCenterCourse ? 'Trung tâm Đào tạo' : 'giáo viên';
  const publicPhone = Boolean(course.teacher?.isPhonePublic && course.teacher?.phone);
  const providerTrustCount = getProviderTrustCount(course.teacher.id, course.teacher.heartCount);
  const isEnrollmentOpen = course.enrollmentStatus !== 'closed';
  const updateEnrollmentStatus = () => {
    const enrollmentStatus = isEnrollmentOpen ? 'closed' : 'open';
    const updatedCourse = updateCourse(course.id, { enrollmentStatus });
    if (updatedCourse) setCourse(updatedCourse);
    toast.success(enrollmentStatus === 'open' ? 'Lớp đã được mở tuyển sinh.' : 'Lớp đã đóng tuyển sinh.');
  };
  const review = (event) => {
    event.preventDefault();
    if (!isAuthenticated) { toast.error('Vui lòng đăng nhập với tài khoản học viên để đánh giá.'); return; }
    if (hasRatedCourse) { toast.error('Bạn chỉ có thể đánh giá sao một lần cho mỗi khóa học.'); return; }
    if (!comment.trim() && !reviewMedia) { toast.error('Hãy viết nhận xét hoặc đính kèm ảnh trước khi gửi.'); return; }
    const next = { id: `review-${Date.now()}`, courseId, rating, comment: comment.trim(), media: reviewMedia, author: user.name || 'Học viên EduMatch', authorId: user.id, isAnonymous: isAnonymousReview, anonymousCode: isAnonymousReview ? createAnonymousCode() : '', createdAt: new Date().toISOString() };
    addCourseReview(next);
    trackProviderAffinity(user.id, course.teacher.id, 'reviewed-course', 5);
    if (rating === 5) addCourseRatingTrust(user.id, course.teacher.id, course.id);
    if (course.teacher.id !== user.id) {
      createNotification({
        recipientId: course.teacher.id,
        actorName: isAnonymousReview ? 'Một học viên ẩn danh' : user.name || 'Một học viên',
        actorAvatar: user.avatar || '',
        type: 'course_rating',
        title: `${isAnonymousReview ? 'Một học viên ẩn danh' : user.name || 'Một học viên'} đã đánh giá ${rating} sao cho khóa học của bạn`,
        description: comment.trim(),
        link: ROUTES.COURSE_DETAIL(courseId),
      });
    }
    setReviews((current) => [next, ...current]); setComment(''); setReviewMedia(null); setIsAnonymousReview(false); toast.success('Cảm ơn đánh giá của bạn!');
  };
  const replyToReview = (event, review) => {
    event.preventDefault();
    if (!isAuthenticated) { toast.error('Vui lòng đăng nhập để trả lời đánh giá.'); return; }
    const text = String(replyDrafts[review.id] || '').trim();
    const media = replyMedia[review.id] || null;
    if (!text && !media) return;
    const isAnonymousOwnerReply = Boolean(review.isAnonymous && review.authorId === user.id);
    const reply = {
      id: createConversationId('review-reply'),
      author: user.name || 'Thành viên EduMatch',
      authorId: user.id,
      isAnonymous: isAnonymousOwnerReply,
      isReviewOwner: isAnonymousOwnerReply,
      text,
      media,
      createdAt: new Date().toISOString(),
    };
    addCourseReviewReply(review.id, reply);
    setReviews(getCourseReviews(courseId));
    setReplyDrafts((current) => ({ ...current, [review.id]: '' }));
    setReplyMedia((current) => ({ ...current, [review.id]: null }));
    if (review.authorId && review.authorId !== user.id) {
      createNotification({
        recipientId: review.authorId,
        actorName: isAnonymousOwnerReply ? 'Học viên ẩn danh' : user.name || 'Một thành viên',
        actorAvatar: user.avatar || '',
        type: 'course_comment',
        title: `${isAnonymousOwnerReply ? 'Học viên ẩn danh' : user.name || 'Một thành viên'} đã trả lời đánh giá của bạn`,
        description: text,
        link: ROUTES.COURSE_DETAIL(courseId),
      });
    }
    toast.success('Đã gửi phản hồi.');
  };
  const toggleReviewLike = (review, reply = null) => {
    if (!isAuthenticated) { toast.error('Vui lòng đăng nhập để thích bình luận.'); return; }
    const target = reply || review;
    const hadLiked = (target.likes || []).includes(user.id);
    toggleCourseReviewLike(review.id, user.id, reply?.id);
    setReviews(getCourseReviews(courseId));
    if (!hadLiked && target.authorId && target.authorId !== user.id) {
      createNotification({
        recipientId: target.authorId,
        actorName: user.name || 'Một thành viên',
        actorAvatar: user.avatar || '',
        type: 'course_comment',
        title: `${user.name || 'Một thành viên'} đã thích bình luận của bạn`,
        description: 'Bấm để xem đánh giá khóa học.',
        link: ROUTES.COURSE_DETAIL(courseId),
      });
    }
  };
  const ownsReviewContent = (authorId) => Boolean(user?.id && authorId === user.id);
  const editReviewContent = (review, reply = null) => {
    const target = reply || review;
    if (!ownsReviewContent(target.authorId)) return;
    const text = window.prompt(reply ? 'Chỉnh sửa phản hồi' : 'Chỉnh sửa đánh giá', target.text || target.comment || '');
    if (text === null) return;
    updateCourseReview(review.id, (current) => reply
      ? { ...current, replies: (current.replies || []).map((item) => item.id === reply.id ? { ...item, text: text.trim() } : item) }
      : { ...current, comment: text.trim() });
    setReviews(getCourseReviews(courseId));
  };
  const removeReviewContent = (review, reply = null) => {
    const target = reply || review;
    if (!ownsReviewContent(target.authorId) || !window.confirm(reply ? 'Xóa phản hồi này?' : 'Xóa đánh giá này?')) return;
    if (reply) updateCourseReview(review.id, (current) => ({ ...current, replies: (current.replies || []).filter((item) => item.id !== reply.id) }));
    else deleteCourseReview(review.id);
    setReviews(getCourseReviews(courseId));
  };
  const send = async (event) => {
    event.preventDefault();
    if (!isAuthenticated) { toast.error(`Vui lòng đăng nhập để nhắn tin với ${providerType}.`); return; }
    if (!message.trim() || chatOpening.current) return;
    chatOpening.current = true;
    try {
      const conversation = await chatService.startDirect(course.teacher.id, message);
      setShowMessage(false);
      navigate(`${ROUTES.MESSAGES}?conversation=${conversation.id}`);
    } catch (error) { toast.error(chatError(error)); }
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
      <section className="teacher-profile-card"><div className="teacher-profile-card__avatar">{course.teacher.avatar ? <img src={course.teacher.avatar} alt={`Ảnh đại diện của ${course.teacher.name}`} /> : <DefaultRoleAvatar role={course.teacher.role} size={23} />}</div><div className="teacher-profile-card__info"><p>{isCenterCourse ? 'TRUNG TÂM ĐÀO TẠO' : 'GIÁO VIÊN ĐỒNG HÀNH'}</p><Link className="teacher-profile-card__name" to={ROUTES.TEACHER_PROFILE(course.teacher.id)}><h2>{course.teacher.name}</h2></Link><span className={`teacher-profile-card__trust ${providerTrustCount < 3 ? 'is-new' : ''}`}>{providerTrustCount < 3 ? 'Mới trên EduMatch' : <><Heart size={13} fill="currentColor" /> {providerTrustCount} lượt tin tưởng</>}</span><VerifiedBadge userId={course.teacher.id} />{course.teacher.bio && <p className="teacher-profile-card__intro">{course.teacher.bio}</p>}</div><div className="teacher-profile-card__details"><dl className="teacher-profile-card__facts"><div><dt>Lĩnh vực giảng dạy</dt><dd>{course.teacher.teachingField || course.subject || 'Đang cập nhật'}</dd></div>{isCenterCourse ? <div><dt>Năm thành lập</dt><dd>{course.teacher.foundedYear || 'Đang cập nhật'}</dd></div> : <><div><dt>Tuổi</dt><dd>{getAge(course.teacher.dob)} tuổi</dd></div><div><dt>Bằng cấp, chứng chỉ</dt><dd>{course.teacher.qualifications || 'Đang cập nhật'}</dd></div><div><dt>Kinh nghiệm giảng dạy</dt><dd>{course.teacher.experience || 'Đang cập nhật'}</dd></div></>}</dl>{publicPhone && <a className="teacher-profile-card__phone" href={`tel:${course.teacher.phone.replace(/\s/g, '')}`}><Phone size={16} /><span>Số điện thoại liên hệ</span><strong>{course.teacher.phone}</strong></a>}</div></section>
      <section className="review-section"><div className="detail-block__head"><div><h2>Đánh giá khóa học</h2></div>{reviews.length > 0 && <div className="review-summary"><Star size={18} fill="currentColor" /><strong>{averageRating.toFixed(1)}</strong><span>/ 5 · {reviews.length} đánh giá</span></div>}</div>
        {!isCourseOwner && !hasRatedCourse && <form className="review-form" onSubmit={review}><div className="star-picker" aria-label="Chọn số sao">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} sao`}><Star size={21} fill={value <= rating ? 'currentColor' : 'none'} /></button>)}</div><textarea value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={submitOnPlainEnter} placeholder="Chia sẻ trải nghiệm của bạn về khóa học..." rows="3" /><div className="review-form__actions"><label className="anonymous-choice"><input type="checkbox" checked={isAnonymousReview} onChange={(event) => setIsAnonymousReview(event.target.checked)} /> Đánh giá ẩn danh</label><ImageAttachment id="review-image" value={reviewMedia} onChange={setReviewMedia} label="Đính kèm tệp" /><button type="submit">Gửi đánh giá</button></div></form>}
        <div className="review-list">{reviews.map((item) => {
          const isReviewLiked = (item.likes || []).includes(user?.id);
          return <article key={item.id}>
            <div className="review-item__head"><ReviewAuthor authorId={item.authorId} name={item.author} isAnonymous={item.isAnonymous} anonymousLabel={getAnonymousReviewLabel(item)} /><span>{Array.from({ length: item.rating }, (_, index) => <Star key={index} size={13} fill="currentColor" />)}</span>{ownsReviewContent(item.authorId) && <ContentMenu id={`review-${item.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editReviewContent(item)} onDelete={() => removeReviewContent(item)} label="đánh giá" />}</div>
            {item.comment && <p>{item.comment}</p>}{item.media && (item.media.type === 'video' ? <video className="review-media" src={item.media.src} controls preload="metadata" /> : <img className="review-media" src={item.media.src} alt="Ảnh đính kèm trong đánh giá" />)}<time className="review-item__time" dateTime={item.createdAt || undefined}>{formatRelativeTime(item.createdAt)}</time>
            <div className="review-item__actions"><button type="button" className={isReviewLiked ? 'is-liked' : ''} onClick={() => toggleReviewLike(item)}><Heart size={14} fill={isReviewLiked ? 'currentColor' : 'none'} /> Thích</button>{item.likes?.length > 0 && <button type="button" className="review-likes-count" onClick={() => setLikesTarget({ ids: item.likes, label: 'Những người đã thích đánh giá này' })}>{item.likes.length} lượt thích</button>}</div>
            {item.replies?.length > 0 && <div className="review-replies">{item.replies.map((reply) => {
              const isReplyLiked = (reply.likes || []).includes(user?.id);
              return <div className="review-reply" key={reply.id}><div className="review-reply__head"><div className="review-reply__identity"><ReviewAuthor authorId={reply.authorId} name={reply.author} isAnonymous={reply.isAnonymous} anonymousLabel={getAnonymousReviewLabel(item)} />{reply.isReviewOwner && <span>Chủ đánh giá</span>}</div>{ownsReviewContent(reply.authorId) && <ContentMenu id={`review-reply-${reply.id}`} openId={openContentMenu} onToggle={setOpenContentMenu} onEdit={() => editReviewContent(item, reply)} onDelete={() => removeReviewContent(item, reply)} label="phản hồi" />}</div>{reply.text && <p>{reply.text}</p>}{reply.media && (reply.media.type === 'video' ? <video className="review-media" src={reply.media.src} controls preload="metadata" /> : <img className="review-media" src={reply.media.src} alt="Ảnh đính kèm trong phản hồi" />)}<time className="review-reply__time" dateTime={reply.createdAt || undefined}>{formatRelativeTime(reply.createdAt)}</time><div className="review-reply__actions"><button type="button" className={isReplyLiked ? 'is-liked' : ''} onClick={() => toggleReviewLike(item, reply)}><Heart size={13} fill={isReplyLiked ? 'currentColor' : 'none'} /> Thích</button>{reply.likes?.length > 0 && <button type="button" className="review-likes-count" onClick={() => setLikesTarget({ ids: reply.likes, label: 'Những người đã thích phản hồi này' })}>{reply.likes.length} lượt thích</button>}</div></div>;
            })}</div>}
            {isAuthenticated && <form className="review-reply-form" onSubmit={(event) => replyToReview(event, item)}><textarea value={replyDrafts[item.id] || ''} onChange={(event) => setReplyDrafts((current) => ({ ...current, [item.id]: event.target.value }))} onKeyDown={submitOnPlainEnter} placeholder="Viết phản hồi..." aria-label={`Phản hồi đánh giá của ${item.isAnonymous ? 'học viên ẩn danh' : item.author}`} rows="1" /><ImageAttachment id={`review-reply-image-${item.id}`} value={replyMedia[item.id] || null} onChange={(media) => setReplyMedia((current) => ({ ...current, [item.id]: media }))} label="Tệp" /><button type="submit"><Send size={15} /> Trả lời</button></form>}
          </article>;
        })}</div>
      </section>
    </article><aside className="course-enroll-card"><span>HỌC PHÍ</span><strong>{formatCurrency(course.price)}</strong><small>{paymentLabel(course.paymentType)}</small><span className={`course-enroll-status ${isEnrollmentOpen ? '' : 'is-closed'}`}>{enrollmentLabel(course)}</span>{isCourseOwner ? <div className="course-owner-control"><p>{isEnrollmentOpen ? 'Lớp đang nhận học viên mới.' : 'Lớp đã tạm dừng nhận học viên mới.'}</p><Link className="course-edit-link" to={`${ROUTES.CREATE_COURSE}?edit=${course.id}`}><Pencil size={16} /> Chỉnh sửa khóa học</Link><button type="button" onClick={updateEnrollmentStatus}>{isEnrollmentOpen ? <><LockKeyhole size={17} /> Đóng lớp</> : 'Mở lớp'}</button></div> : isEnrollmentOpen ? <button onClick={() => setShowMessage(true)}><MessageCircle size={18} /> Đăng ký học</button> : <p className="course-closed-note"><LockKeyhole size={17} /> Lớp đã đóng tuyển sinh. Vui lòng xem khóa học khác.</p>}<ul><li>Trao đổi trực tiếp với giáo viên</li><li>Thống nhất lịch phù hợp trước khi học</li></ul></aside></div>
    {showMessage && <div className="message-panel" role="dialog" aria-modal="true" aria-label={`Nhắn tin với ${providerType}`}><form className="message-dialog" onSubmit={send}><header className="message-dialog__header"><span className="message-dialog__icon"><MessageCircle size={20} /></span><div><p>NHẮN TIN TRỰC TIẾP</p><h2>Hẹn lịch học</h2></div><button className="message-dialog__close" type="button" onClick={() => setShowMessage(false)} aria-label="Đóng hộp nhắn tin"><X size={19} /></button></header><div className="message-dialog__recipient"><span>{course.teacher.avatar ? <img src={course.teacher.avatar} alt="" /> : <DefaultRoleAvatar role={course.teacher.role} size={18} />}</span><div><strong>{course.teacher.name}</strong><small>{isCenterCourse ? 'Trung tâm của khóa học này' : 'Giáo viên của khóa học này'}</small></div><i className={providerIsOnline ? 'is-online' : ''}>{providerIsOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}</i></div><label className="message-dialog__field">Lời nhắn mở đầu<textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={submitOnPlainEnter} rows="5" /></label><p className="message-dialog__hint">Hai bên sẽ tự trao đổi để thống nhất lịch học phù hợp.</p><div className="message-dialog__actions"><button className="message-dialog__cancel" type="button" onClick={() => setShowMessage(false)}>Để sau</button><button className="message-dialog__send" type="submit"><Send size={17} /> Gửi tin nhắn</button></div></form></div>}
  </div></section><LikesModal target={likesTarget} onClose={() => setLikesTarget(null)} /></>;
}
