import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Headphones,
  Heart,
  LockKeyhole,
  Monitor,
  Phone,
  Search,
  ShieldCheck,
  Star,
  MessageCircle,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/feedback/Modal';
import { useAuth } from '@/hooks/useAuth';
import { chatService, chatError } from '@/services/chatService';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { ROUTES } from '@/constants/routes';
import { CourseCard } from '@/components/courses/CourseCard';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { useMasterData } from '@/hooks/useMasterData';
import { useAdministrativeOptions } from '@/hooks/useAdministrativeOptions';
import { AdministrativePicker } from '@/components/forms/AdministrativePicker';
import { createNotification, getCourseRating, getCourses, getProviderTrustCount, hasProviderTrust, toggleProviderTrust, trackProviderAffinity } from '@/features/learning/marketplace';
import toast from 'react-hot-toast';
import heroImage from '@/assets/tutoring-hero.webp';
import heroImageMobile from '@/assets/tutoring-hero-720.webp';
import communityTeacherStrip from '@/assets/vietnamese-teachers-avatar-strip.png';
import { subjects as subjectStyles, tutors } from './homeData';
import './home.css';
import '@/components/courses/course.css';

const initialFilters = { subject: '', mode: '', province: '', ward: '', provider: '', description: '' };
const initialCourseFilters = { subject: '', mode: '', province: '', ward: '', description: '' };
const communityTeacherPositions = ['0% center', '50% center', '100% center'];
const sampleCenterOrder = [
  'center-old-school',
  'center-horizon-learning',
  'center-educare',
  'center-bright-path',
  'center-melody-studio',
];
const normalize = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
const searchStopWords = new Set(['toi', 'muon', 'tim', 'mot', 'khoa', 'hoc', 'giao', 'vien', 'va', 'voi', 'o', 'tai', 'cho', 'la', 'nhung', 'phu', 'hop', 'can']);
const needTokens = (value) => normalize(value).split(/[^a-z0-9]+/).filter((token) => token.length > 1 && !searchStopWords.has(token));
const matchesDescription = (candidate, description, gender = '') => {
  if (!description.trim()) return true;
  const need = normalize(description);
  const searchableCandidate = normalize(candidate);
  if (/(truc tiep|tai lop|tai nha)/.test(need) && !searchableCandidate.includes('truc tiep')) return false;
  if (/(truc tuyen|online)/.test(need) && !searchableCandidate.includes('truc tuyen')) return false;
  if (/(giao vien nu|nu gioi|co giao)/.test(need) && gender !== 'female') return false;
  if (/(giao vien nam|nam gioi|thay giao)/.test(need) && gender !== 'male') return false;
  const tokens = needTokens(description);
  if (!tokens.length) return true;
  const matchingTerms = tokens.filter((token) => searchableCandidate.includes(token)).length;
  // Với cụm từ ngắn, yêu cầu khớp toàn bộ các từ khóa có nghĩa để tránh việc
  // một từ rất phổ biến (ví dụ “cách”) kéo theo các hồ sơ không liên quan.
  const requiredMatches = tokens.length <= 2
    ? tokens.length
    : Math.max(1, Math.ceil(tokens.length * 0.35));
  return matchingTerms >= requiredMatches;
};
const inferredGender = (provider) => {
  const match = tutors.find((tutor) => normalize(`${tutor.name} ${tutor.title}`).includes(normalize(provider?.name || '')));
  if (match?.title === 'Cô') return 'female';
  if (match?.title === 'Thầy') return 'male';
  return provider?.gender || '';
};
const scrollTo = (element, block = 'start') =>
  element?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block,
  });

function SectionHeading({ title, description, children }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}

function FilterField({ label, icon: Icon, id, name, value, onChange, children }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <div className="filter-input">
        <Icon size={19} aria-hidden="true" />
        <select id={id || `${name}-filter`} name={name} value={value} onChange={onChange}>
          {children}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
    </label>
  );
}

function SubjectFilterField({ value, onChange, subjects = [], id = 'subject-filter', listId = 'subject-suggestions', label = 'Môn học / Lĩnh vực' }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <div className="filter-input filter-input--search">
        <BookOpen size={19} aria-hidden="true" />
        <input
          id={id}
          name="subject"
          type="search"
          value={value}
          onChange={onChange}
          list={listId}
          placeholder="Nhập môn học hoặc từ khóa"
          autoComplete="off"
          aria-label="Tìm môn học hoặc lĩnh vực"
        />
        <datalist id={listId}>
          {subjects.map((subject) => <option key={subject.name} value={subject.name} />)}
        </datalist>
      </div>
    </label>
  );
}

function DescriptionFilterField({ value, onChange, name = 'description' }) {
  return <label className="filter-field"><span>Tìm kiếm qua mô tả</span><div className="filter-input filter-input--search"><Search size={19} aria-hidden="true" /><input name={name} type="search" value={value} onChange={onChange} placeholder="Ví dụ: Tiếng Anh trực tiếp tại Ninh Bình" autoComplete="off" /></div></label>;
}

function TutorCard({ tutor, saved, onSave, onOpen }) {
  const trustCount = getProviderTrustCount(tutor.id, tutor.heartCount);
  return (
    <article className="tutor-card">
      <div className="tutor-top">
        {tutor.image ? <img src={tutor.image} alt={tutor.name} width="68" height="76" loading="lazy" /> : <span className="tutor-avatar-fallback" aria-hidden="true">{tutor.name.slice(0, 1)}</span>}
        <div className="tutor-identity">
          <h3>
            <Link className="tutor-name-link" to={ROUTES.TEACHER_PROFILE(tutor.id)}>
              {[tutor.title, tutor.name].filter(Boolean).join(' ')}
            </Link>
          </h3>
          {tutor.reviews ? (
            <div className="tutor-rating"><Star size={13} fill="currentColor" /><strong>{tutor.rating.toFixed(1)}</strong><span>({tutor.reviews} đánh giá)</span></div>
          ) : null}
          <span className="subject-tag">{tutor.teachingField || tutor.subject}</span>
        </div>
        <button
          className={`save-button ${saved ? 'is-saved' : ''}`}
          onClick={onSave}
          aria-label={`${saved ? 'Bỏ tin tưởng' : 'Tin tưởng'} ${tutor.name}`}
          aria-pressed={saved}
        >
          <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="tutor-credibility">
        {tutor.providerType !== 'student' && <span className={`tutor-trust ${trustCount < 3 ? 'is-new' : ''}`}>
          {trustCount < 3 ? 'Mới trên EduMatch' : <><Heart size={13} fill="currentColor" /> {trustCount} tin tưởng</>}
        </span>}
        <VerifiedBadge userId={tutor.id} />
      </div>
      <p className="tutor-meta">
        <GraduationCap size={15} />
        {tutor.providerType === 'center'
          ? 'Trung tâm đào tạo'
          : 'Giáo viên'}
        <span className="mode-tag">{tutor.mode === 'online' ? 'Trực tuyến' : tutor.mode === 'recorded' ? 'Video quay sẵn' : tutor.mode === 'offline' ? 'Trực tiếp' : 'Trực tuyến & trực tiếp'}</span>
      </p>
      {tutor.isPhonePublic && tutor.phone && <div className="tutor-contact"><a className="tutor-phone" href={`tel:${tutor.phone.replace(/\s/g, '')}`}><Phone size={13} /> {tutor.phone}</a></div>}
      <div className="tutor-bottom">
        <Button className="edu-button profile-button" size="sm" onClick={onOpen}>
          Xem chi tiết <ArrowRight size={14} />
        </Button>
      </div>
    </article>
  );
}

export const Home = () => {
  const catalog = useMasterData();
  const catalogSubjects = catalog.subjects.length ? catalog.subjects : subjectStyles;
  const subjects = catalogSubjects.map((subject) => ({ ...subject,
    icon: subjectStyles.find((item) => item.name === subject.name)?.icon || BookOpen,
    color: subjectStyles.find((item) => item.name === subject.name)?.color || 'green' }));
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const chatOpening = useRef(false);
  const query = params.get('q') || '';
  const needQuery = params.get('need') || '';
  const courseQuery = params.get('course-query') || '';
  const hasNeedQuery = params.has('need');
  const hasCourseQuery = params.has('course-query');
  const descriptionQuery = hasNeedQuery ? needQuery : courseQuery;
  const hasDescriptionQuery = hasNeedQuery || hasCourseQuery;
  const isSearchResults = location.pathname === ROUTES.SEARCH_RESULTS;
  const dialog = params.get('dialog');
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [courseFilters, setCourseFilters] = useState(initialCourseFilters);
  const [appliedCourseFilters, setAppliedCourseFilters] = useState(initialCourseFilters);
  const [savedIds, setSavedIds] = useLocalStorage('edumatch:saved-tutors', []);
  const [savedOnly, setSavedOnly] = useState(false);
  const [trustFirst, setTrustFirst] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showAllSubjects, setShowAllSubjects] = useState(false);
  const [courseSort, setCourseSort] = useState('newest');
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [coursePage, setCoursePage] = useState(1);
  const [showAllSponsored, setShowAllSponsored] = useState(false);
  const [sponsoredPage, setSponsoredPage] = useState(1);
  const [tutorPage, setTutorPage] = useState(1);
  const [showOtherSubjectSearch, setShowOtherSubjectSearch] = useState(false);
  const [otherCourseQuery, setOtherCourseQuery] = useState('');
const [profile, setProfile] = useState(null);
const isCenterProfile = profile?.providerType === 'center';
const profileTrustCount = profile ? getProviderTrustCount(profile.id, profile.heartCount) : 0;
const profileCourses = profile
  ? getCourses().filter(
      (course) =>
        (course.teacher?.id === profile.id || course.teacher?.id === `teacher-${profile.id}`)
    )
  : [];
  const [consultationComplete, setConsultationComplete] = useState(false);
  const [consultation, setConsultation] = useState({ name: '', phone: '', subject: '', note: '' });
  const resultsRef = useRef(null);
  const filterRef = useRef(null);
  const courseRef = useRef(null);
  const sponsoredRef = useRef(null);
  const otherSubjectInputRef = useRef(null);
  const visibleCourseFilters = hasDescriptionQuery ? { ...courseFilters, description: descriptionQuery } : courseFilters;
  const activeCourseFilters = hasDescriptionQuery ? { ...appliedCourseFilters, description: descriptionQuery } : appliedCourseFilters;
  const visibleTutorFilters = hasDescriptionQuery ? { ...filters, description: descriptionQuery } : filters;
  const activeTutorFilters = hasDescriptionQuery ? { ...appliedFilters, description: descriptionQuery } : appliedFilters;
  const rankedCourses = getCourses()
    .map((course) => ({ ...course, ranking: getCourseRating(course.id) }))
    .filter((course) => {
      const courseMode = course.learningMode === 'in-person'
        ? 'in-person'
        : course.learningMode === 'recorded'
          ? 'recorded'
          : 'online';
      const courseSearchText = normalize([
        course.title,
        course.subject,
        course.description,
        course.teacher?.name,
        course.location,
        course.province,
        course.ward,
        course.district,
        course.schedule,
      ].filter(Boolean).join(' '));

      return (
        (!activeCourseFilters.subject || courseSearchText.includes(normalize(activeCourseFilters.subject))) &&
        (!activeCourseFilters.mode || courseMode === activeCourseFilters.mode) &&
        (!activeCourseFilters.province || normalize(`${course.province || ''} ${course.location || ''}`).includes(normalize(activeCourseFilters.province))) &&
        (!activeCourseFilters.ward || normalize(`${course.ward || ''} ${course.district || ''} ${course.location || ''}`).includes(normalize(activeCourseFilters.ward))) &&
        matchesDescription(`${courseSearchText} ${courseMode === 'in-person' ? 'truc tiep' : courseMode === 'online' ? 'truc tuyen' : 'video quay san'}`, activeCourseFilters.description, inferredGender(course.teacher))
      );
    })
    .sort((first, second) => {
      if (courseSort === 'top-rated') {
        return second.ranking.total - first.ranking.total
          || second.ranking.average - first.ranking.average
          || new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
      }
      return new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
    });
  const coursePageSize = 9;
  const totalCoursePages = Math.max(1, Math.ceil(rankedCourses.length / coursePageSize));
  const visibleCourses = showAllCourses
    ? rankedCourses.slice((coursePage - 1) * coursePageSize, coursePage * coursePageSize)
    : rankedCourses.slice(0, 6);
  const sponsoredCourses = getCourses()
    .map((course) => ({ ...course, ranking: getCourseRating(course.id) }))
    .sort((first, second) => second.ranking.total - first.ranking.total
      || second.ranking.average - first.ranking.average
      || new Date(second.createdAt || 0) - new Date(first.createdAt || 0));
  const sponsoredPageSize = 3;
  const totalSponsoredPages = Math.max(1, Math.ceil(sponsoredCourses.length / sponsoredPageSize));
  const visibleSponsoredCourses = showAllSponsored
    ? sponsoredCourses.slice((sponsoredPage - 1) * sponsoredPageSize, sponsoredPage * sponsoredPageSize)
    : sponsoredCourses.slice(0, 3);
  const searchableTutors = (() => {
    const providers = new Map();

    getCourses().forEach((course) => {
      const provider = course.teacher;
      const key = provider.id;
      const rating = getCourseRating(course.id);
      const mode = course.learningMode === 'in-person' ? 'offline' : course.learningMode === 'recorded' ? 'recorded' : 'online';
      const current = providers.get(key) || {
        id: key,
        name: provider.name,
        title: provider.role === 'center' ? '' : 'GV.',
        providerType: provider.role === 'center' ? 'center' : 'teacher',
        ratingSum: 0,
        reviews: 0,
        heartCount: Number(provider.heartCount || 0),
        subjects: [],
        courseTitles: [],
        modes: new Set(),
        locations: [],
        province: '',
        ward: '',
        image: provider.avatar || '',
        phone: provider.phone || '',
        isPhonePublic: Boolean(provider.isPhonePublic),
        licenseVerificationStatus: provider.licenseVerificationStatus || '',
        courseId: course.id,
        experience: provider.experience || 'Đang cập nhật',
        foundedYear: provider.foundedYear || '',
        teachingField: provider.teachingField || provider.teaching_field || '',
        price: course.price,
        description: provider.bio || course.description,
        bio: provider.bio || '',
        methods: ['Lộ trình học theo khóa', 'Chủ động trao đổi lịch học'],
      };
      current.subjects.push(course.subject || '');
      current.courseTitles.push(course.title || '');
      current.modes.add(mode);
      current.locations.push(course.location || '');
      current.province ||= course.province || '';
      current.ward ||= course.ward || course.district || '';
      current.ratingSum += rating.average * rating.total;
      current.reviews += rating.total;
      current.price = Math.min(Number(current.price || 0) || Infinity, Number(course.price || 0) || Infinity);
      providers.set(key, current);
    });

    const courseProviders = [...providers.values()].map((provider) => ({
      ...provider,
      subject: [...new Set(provider.subjects.filter(Boolean))].join(' · ') || 'Đang cập nhật',
      searchableCourses: [...new Set(provider.courseTitles.filter(Boolean))].join(' · '),
      mode: provider.modes.size === 1 ? [...provider.modes][0] : 'both',
      location: provider.locations.filter(Boolean).join(' · '),
      rating: provider.reviews ? provider.ratingSum / provider.reviews : 0,
      price: Number.isFinite(provider.price) ? provider.price : 0,
    }));

    const currentProvider = ['teacher', 'center'].includes(user?.role)
      ? {
          id: user.id,
          name: user.name || 'Hồ sơ EduMatch',
          title: user.role === 'center' ? '' : 'GV.',
          providerType: user.role,
          rating: 0,
          reviews: 0,
          heartCount: Number(user.heartCount || 0),
          subject: user.teachingField || 'Đang cập nhật',
          teachingField: user.teachingField || '',
          searchableCourses: '',
          mode: user.learningMode || 'both',
          location: user.location || user.address || '',
          province: user.province || '',
          ward: user.ward || '',
          image: user.avatar || '',
          phone: user.phone || '',
          isPhonePublic: Boolean(user.isPhonePublic),
          licenseVerificationStatus: user.licenseVerificationStatus || '',
          experience: user.experience || 'Đang cập nhật',
          foundedYear: user.foundedYear || '',
          price: 0,
          description: user.detailedProfile || user.bio || '',
          bio: user.detailedProfile || user.bio || '',
          methods: [],
        }
      : null;

    return [
      ...tutors.map((tutor) => ({
        ...tutor,
        providerType: 'teacher',
        heartCount: Number(tutor.heartCount || 0),
      })),
      ...courseProviders,
      ...(currentProvider && !courseProviders.some((provider) => String(provider.id) === String(currentProvider.id))
        ? [currentProvider]
        : []),
    ];
  })();

  const filteredTutors = (() => {
    return searchableTutors.filter((tutor) => {
        const matchesQuery =
          !query ||
          normalize(`${tutor.title} ${tutor.name} ${tutor.subject} ${tutor.teachingField || ''} ${tutor.searchableCourses || ''} ${tutor.description}`).includes(
            normalize(query)
          );
        return (
          matchesQuery &&
          (!activeTutorFilters.subject ||
            normalize(`${tutor.subject} ${tutor.teachingField || ''} ${tutor.searchableCourses || ''} ${tutor.title} ${tutor.description}`).includes(
              normalize(activeTutorFilters.subject)
            )) &&
          (!activeTutorFilters.mode ||
            (activeTutorFilters.mode === 'online'
              ? tutor.mode === 'online' || tutor.mode === 'both'
              : activeTutorFilters.mode === 'recorded'
                ? tutor.mode === 'recorded'
                : tutor.mode === 'offline' || tutor.mode === 'both')) &&
          (!activeTutorFilters.province || normalize(`${tutor.province || ''} ${tutor.location || ''}`).includes(normalize(activeTutorFilters.province))) &&
          (!activeTutorFilters.ward || normalize(`${tutor.ward || ''} ${tutor.location || ''}`).includes(normalize(activeTutorFilters.ward))) &&
          (!activeTutorFilters.rating || tutor.rating >= Number(activeTutorFilters.rating)) &&
          (!activeTutorFilters.provider || tutor.providerType === activeTutorFilters.provider) &&
          matchesDescription(`${tutor.title} ${tutor.name} ${tutor.subject} ${tutor.teachingField || ''} ${tutor.searchableCourses || ''} ${tutor.description} ${tutor.location} ${tutor.mode === 'offline' ? 'truc tiep' : tutor.mode === 'online' ? 'truc tuyen' : ''}`, activeTutorFilters.description, tutor.title === 'Cô' ? 'female' : tutor.title === 'Thầy' ? 'male' : '') &&
          (!savedOnly || (isAuthenticated ? hasProviderTrust(user.id, tutor.id) : savedIds.includes(tutor.id)))
        );
    }).sort((first, second) => {
      const firstSampleCenterIndex = sampleCenterOrder.indexOf(first.id);
      const secondSampleCenterIndex = sampleCenterOrder.indexOf(second.id);
      const firstSampleCenterRank = firstSampleCenterIndex === -1 ? Number.MAX_SAFE_INTEGER : firstSampleCenterIndex;
      const secondSampleCenterRank = secondSampleCenterIndex === -1 ? Number.MAX_SAFE_INTEGER : secondSampleCenterIndex;
      if (firstSampleCenterRank !== secondSampleCenterRank) {
        return firstSampleCenterRank - secondSampleCenterRank;
      }
      const firstHearts = first.heartCount + (savedIds.includes(first.id) ? 1 : 0);
      const secondHearts = second.heartCount + (savedIds.includes(second.id) ? 1 : 0);
      if (trustFirst) {
        return getProviderTrustCount(second.id, second.heartCount) - getProviderTrustCount(first.id, first.heartCount)
          || second.reviews - first.reviews
          || second.rating - first.rating;
      }
      return secondHearts - firstHearts
        || second.reviews - first.reviews
        || second.rating - first.rating;
    });
  })();

  const isFiltered = Boolean(query || savedOnly || trustFirst || Object.values(activeTutorFilters).some(Boolean));
  const tutorPageSize = 12;
  const totalTutorPages = Math.max(1, Math.ceil(filteredTutors.length / tutorPageSize));
  const visibleTutors = showAll
    ? filteredTutors.slice((tutorPage - 1) * tutorPageSize, tutorPage * tutorPageSize)
    : filteredTutors.slice(0, 8);
  const { administrativeProvinces, wardOptions, error: areaError } = useAdministrativeOptions(filters.province);
  const { administrativeProvinces: courseProvinces, wardOptions: courseWardOptions, error: courseAreaError } = useAdministrativeOptions(courseFilters.province);
  const registerForTutor = async (tutor) => {
    if (!isAuthenticated) { toast.error('Vui lòng đăng nhập để đăng ký học.'); setProfile(null); navigate(ROUTES.LOGIN); return; }
    if (chatOpening.current) return;
    chatOpening.current = true;
    try {
      const conversation = await chatService.startDirect(tutor.id, 'Chào thầy/cô, em muốn trao đổi thêm để đăng ký học và sắp xếp lịch phù hợp ạ.');
      setProfile(null);
      navigate(`${ROUTES.MESSAGES}?conversation=${conversation.id}`);
    } catch (error) { toast.error(chatError(error)); }
    finally { chatOpening.current = false; }
  };
  const updateFilter = (event) => {
    const { name, value } = event.target;
    if (name === 'description' && hasDescriptionQuery) {
      setParams((current) => {
        current.delete('need');
        current.delete('course-query');
        return current;
      }, { replace: true });
    }
    setFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === 'mode' && value !== 'in-person' ? { province: '', ward: '' } : {}),
    }));
  };
  const updateCourseFilter = (event) => {
    const { name, value } = event.target;
    if (name === 'description' && hasDescriptionQuery) {
      setParams((current) => {
        current.delete('need');
        current.delete('course-query');
        return current;
      }, { replace: true });
    }
    setCourseFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === 'mode' && value !== 'in-person' ? { province: '', ward: '' } : {}),
    }));
  };
  const selectLocation = (name) => (value) => {
    setFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === 'province' ? { ward: '' } : {}),
    }));
  };
  const selectCourseLocation = (name) => (value) => {
    setCourseFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === 'province' ? { ward: '' } : {}),
    }));
  };
  const goToCoursePage = (page) => {
    setCoursePage(page);
    requestAnimationFrame(() => scrollTo(courseRef.current));
  };
  const goToTutorPage = (page) => {
    setTutorPage(page);
    requestAnimationFrame(() => scrollTo(resultsRef.current));
  };
  const goToSponsoredPage = (page) => {
    setSponsoredPage(page);
    requestAnimationFrame(() => scrollTo(sponsoredRef.current));
  };
  const closeDialog = () => {
    setConsultationComplete(false);
    setParams(
      (current) => {
        current.delete('dialog');
        return current;
      },
      { replace: true }
    );
  };
  const openDialog = (name) => {
    setConsultationComplete(false);
    setParams((current) => {
      current.set('dialog', name);
      return current;
    });
  };
  const resetSearch = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setSavedOnly(false);
    setTrustFirst(false);
    setShowAll(false);
    setTutorPage(1);
    setParams(
      (current) => {
        current.delete('q');
        current.delete('need');
        current.delete('course-query');
        return current;
      },
      { replace: true }
    );
  };
  const chooseSubject = (subject) => {
    const tutorFilters = { ...initialFilters, subject };
    const nextCourseFilters = { ...initialCourseFilters, subject };
    setFilters(tutorFilters);
    setAppliedFilters(tutorFilters);
    setCourseFilters(nextCourseFilters);
    setAppliedCourseFilters(nextCourseFilters);
    setSavedOnly(false);
    setShowAll(false);
    setTutorPage(1);
    setShowAllCourses(false);
    setCoursePage(1);
    setShowOtherSubjectSearch(false);
    setOtherCourseQuery('');
    setParams(
      (current) => {
        current.delete('q');
        current.delete('need');
        current.delete('course-query');
        return current;
      },
      { replace: true }
    );
    scrollTo(courseRef.current);
  };
  const openOtherSubjectSearch = () => {
    setShowOtherSubjectSearch(true);
    requestAnimationFrame(() => otherSubjectInputRef.current?.focus());
  };
  const searchOtherSubject = (event) => {
    event.preventDefault();
    const keyword = otherCourseQuery.trim();
    if (keyword) chooseSubject(keyword);
  };

  return (
    <div className={`edu-home ${isSearchResults ? 'edu-home--search-results' : ''}`}>
      {catalog.error && <p className="edu-container account-error" role="alert">{catalog.error}</p>}
      {!isSearchResults && catalog.banners.length > 0 && <section className="cms-banners edu-container" aria-label="Thông tin từ EduMatch">{catalog.banners.map((banner) => /^https?:\/\//i.test(banner.link_url || '') ? <a key={banner.id} href={banner.link_url} target="_blank" rel="noopener noreferrer"><img src={banner.image_url} alt={banner.title || 'Thông tin EduMatch'} loading="lazy" /></a> : <img key={banner.id} src={banner.image_url} alt={banner.title || 'Thông tin EduMatch'} loading="lazy" />)}</section>}
      {isSearchResults ? (
        <section className="search-results-hero" aria-labelledby="search-results-title">
          <div className="edu-container">
            <span><Search size={16} /> KẾT QUẢ THEO NHU CẦU</span>
            <h1 id="search-results-title">Khóa học và người đồng hành <em>phù hợp với bạn</em></h1>
            <p>{descriptionQuery ? <>Kết quả cho mô tả: <strong>“{descriptionQuery}”</strong></> : 'Nhập mô tả nhu cầu vào ô tìm kiếm để nhận các gợi ý phù hợp.'}</p>
          </div>
        </section>
      ) : (
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="edu-container hero-grid">
          <div className="hero-copy">
            <span className="hero-eyebrow">
              <GraduationCap size={15} /> CHỌN ĐÚNG NƠI, HỌC ĐÚNG CHỖ.
            </span>
            <h1 id="hero-title">
              Kết nối Học viên với
              <br />
              <span>Giáo viên, Trung Tâm Uy Tín</span>
            </h1>
            <p>
              Khám phá và lựa chọn giáo viên, trung tâm đào tạo cùng những khóa học phù hợp với nhu cầu, mục tiêu và lịch trình của bạn.
            </p>
            <div className="hero-actions">
              <Button
                className="edu-button"
                size="lg"
                onClick={() => {
                  scrollTo(courseRef.current, 'center');
                }}
              >
                <Search size={19} />
                Tìm kiếm lớp học
                <ArrowRight size={17} />
              </Button>
              <Button
                className="edu-button edu-button-outline"
                size="lg"
                onClick={() => {
                  scrollTo(filterRef.current, 'center');
                  document.getElementById('subject-filter')?.focus({ preventScroll: true });
                }}
              >
                <Search size={19} />
                Tìm kiếm giáo viên
                <ArrowRight size={17} />
              </Button>
            </div>
            <div className="hero-assurances">
              <span>
                <ShieldCheck size={18} />
                Hồ sơ xác thực
              </span>
              <span>
                <Headphones size={18} />
                Hỗ trợ tận tâm
              </span>
              <span>
                <LockKeyhole size={17} />
                Thanh toán an toàn
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <img
              className="hero-photo"
              src={heroImage}
              srcSet={`${heroImageMobile} 720w, ${heroImage} 1448w`}
              sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) 55vw, 650px"
              alt="Cô giáo và học viên cùng học bên máy tính"
              width="1448"
              height="1086"
              fetchPriority="high"
            />
            <div className="community-note">
              <div className="avatar-stack">
                {communityTeacherPositions.map((backgroundPosition) => (
                  <span
                    key={backgroundPosition}
                    aria-hidden="true"
                    style={{ backgroundImage: `url(${communityTeacherStrip})`, backgroundPosition }}
                  />
                ))}
              </div>
              <div>
                <strong>Cùng nhau tiến bộ</strong>
                <span>Mỗi ngày, một bước xa hơn</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      <div className="edu-container home-content">
        <section id="khoa-hoc" className="home-section course-section" ref={courseRef} aria-labelledby="courses-heading">
          <SectionHeading
            title={<span id="courses-heading">{isSearchResults ? <>Khóa học <span className="accent-text">phù hợp</span></> : <>Lựa chọn <span className="accent-text">khóa học phù hợp</span></>}</span>}
            description={isSearchResults ? 'Các khóa học được lọc theo mô tả nhu cầu của bạn.' : undefined}
          >
            <fieldset className="course-sort" aria-label="Sắp xếp khóa học">
              <legend className="sr-only">Sắp xếp khóa học</legend>
              <label>
                <input
                  type="radio"
                  name="course-sort"
                  value="newest"
                  checked={courseSort === 'newest'}
                  onChange={(event) => { setCourseSort(event.target.value); setCoursePage(1); }}
                />
                Hiển thị khóa học mới nhất
              </label>
              <label>
                <input
                  type="radio"
                  name="course-sort"
                  value="top-rated"
                  checked={courseSort === 'top-rated'}
                  onChange={(event) => { setCourseSort(event.target.value); setCoursePage(1); }}
                />
                Hiển thị theo lượt đánh giá
              </label>
            </fieldset>
          </SectionHeading>
          <form
            id="tim-khoa-hoc"
            className={`course-search ${courseFilters.mode === 'in-person' ? 'course-search--location' : ''}`}
            aria-label="Tìm kiếm khóa học"
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedCourseFilters(courseFilters);
              setCoursePage(1);
              setShowAllCourses(false);
            }}
          >
            <DescriptionFilterField value={visibleCourseFilters.description} onChange={updateCourseFilter} />
            <FilterField
              id="course-mode-filter"
              label="Hình thức học"
              icon={Monitor}
              name="mode"
              value={visibleCourseFilters.mode}
              onChange={updateCourseFilter}
            >
              <option value="">Tất cả hình thức</option>
              <option value="online">Trực tuyến</option>
              <option value="in-person">Học trực tiếp</option>
              <option value="recorded">Video quay sẵn</option>
            </FilterField>
            {courseAreaError && <p className="account-error" role="alert">{courseAreaError}</p>}
            {courseFilters.mode === 'in-person' && <>
              <AdministrativePicker
                id="course-province-filter"
                label="Tỉnh / Thành phố"
                value={courseFilters.province}
                options={courseProvinces}
                onSelect={selectCourseLocation('province')}
                placeholder="Gõ để tìm tỉnh/thành, rồi chọn"
              />
              <AdministrativePicker
                id="course-ward-filter"
                label="Xã / Phường / Đặc khu"
                value={courseFilters.ward}
                options={courseWardOptions}
                onSelect={selectCourseLocation('ward')}
                placeholder={courseFilters.province ? 'Gõ để tìm xã/phường, rồi chọn' : 'Chọn tỉnh/thành trước'}
                disabled={!courseFilters.province}
                emptyText="Không tìm thấy xã/phường trong tỉnh/thành đã chọn."
              />
            </>}
            <Button type="submit" className="edu-button course-search__submit">
              <Search size={18} />
              Tìm kiếm khóa học
            </Button>
          </form>
          <div className="course-grid">
            {visibleCourses.map((course) => <CourseCard key={course.id} course={course} />)}
          </div>
          {rankedCourses.length === 0 && (
            <div className="search-empty course-search__empty">
              <Search size={30} />
              <h3>Chưa tìm thấy khóa học phù hợp</h3>
              <p>Thử điều chỉnh mô tả nhu cầu hoặc hình thức học.</p>
              <Button className="edu-button" onClick={() => { setCourseFilters(initialCourseFilters); setAppliedCourseFilters(initialCourseFilters); setParams((current) => { current.delete('course-query'); return current; }, { replace: true }); }}>
                Xóa bộ lọc
              </Button>
            </div>
          )}
          {rankedCourses.length > 6 && (
            <div className="course-pagination" aria-label="Điều hướng danh sách khóa học">
              {!showAllCourses ? (
                <button type="button" className="course-pagination__all" onClick={() => { setShowAllCourses(true); setCoursePage(1); }}>
                  Xem tất cả khóa học <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => { setShowAllCourses(false); setCoursePage(1); }}>Thu gọn danh sách</button>
                  <div className="course-pagination__pages">
                    <button type="button" onClick={() => goToCoursePage(1)} disabled={coursePage === 1}>Về đầu</button>
                    <button type="button" onClick={() => goToCoursePage(Math.max(1, coursePage - 1))} disabled={coursePage === 1}>Trước</button>
                    {Array.from({ length: totalCoursePages }, (_, index) => index + 1).map((page) => (
                      <button type="button" key={page} className={page === coursePage ? 'is-current' : ''} aria-current={page === coursePage ? 'page' : undefined} onClick={() => goToCoursePage(page)}>{page}</button>
                    ))}
                    <button type="button" onClick={() => goToCoursePage(Math.min(totalCoursePages, coursePage + 1))} disabled={coursePage === totalCoursePages}>Trang sau</button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
        <section
          id="giao-vien"
          className="home-section tutors-section"
          ref={resultsRef}
          aria-labelledby="tutors-heading"
        >
          <SectionHeading
            title={
              <span id="tutors-heading">
                {isSearchResults ? <>Giáo viên, trung tâm <span className="accent-text">phù hợp</span></> : <>Gặp người thầy <span className="accent-text">truyền cảm hứng</span></>}
              </span>
            }
            description={isSearchResults ? 'Những hồ sơ được lọc theo cùng mô tả nhu cầu của bạn.' : undefined}
          >
            <button
              type="button"
              className={`trust-priority-sort ${trustFirst ? 'is-active' : ''}`}
              aria-pressed={trustFirst}
              onClick={() => setTrustFirst((current) => !current)}
            >
              <Heart size={15} fill={trustFirst ? 'currentColor' : 'none'} />
              Ưu tiên nhiều tin tưởng
            </button>
          </SectionHeading>
          <div id="tim-gia-su" className="tutor-search tutor-search--inline" ref={filterRef} aria-label="Bộ lọc giáo viên và trung tâm">
            <form
              aria-label="Bộ lọc giáo viên và trung tâm"
              className={`filter-grid ${filters.mode === 'in-person' ? 'filter-grid--location' : ''}`}
              onSubmit={(event) => {
                event.preventDefault();
                setAppliedFilters(filters);
                setShowAll(false);
                setTutorPage(1);
                scrollTo(resultsRef.current);
              }}
            >
              <DescriptionFilterField value={visibleTutorFilters.description} onChange={updateFilter} />
              <SubjectFilterField subjects={subjects} value={visibleTutorFilters.subject} onChange={updateFilter} />
              {areaError && <p className="account-error" role="alert">{areaError}</p>}
              <FilterField
                label="Hình thức giảng dạy"
                icon={Monitor}
                name="mode"
                value={visibleTutorFilters.mode}
                onChange={updateFilter}
              >
                <option value="">Tất cả hình thức</option>
                <option value="online">Trực tuyến</option>
                <option value="in-person">Học trực tiếp</option>
                <option value="recorded">Video quay sẵn</option>
              </FilterField>
              <FilterField
                label="Loại hồ sơ"
                icon={Users}
                name="provider"
                value={visibleTutorFilters.provider}
                onChange={updateFilter}
              >
                <option value="">Giáo viên & Trung tâm</option>
                <option value="teacher">Giáo viên</option>
                <option value="center">Trung tâm đào tạo</option>
              </FilterField>
              {filters.mode === 'in-person' && <>
                <AdministrativePicker
                  id="province-filter"
                  label="Tỉnh / Thành phố"
                  value={filters.province}
                  options={administrativeProvinces}
                  onSelect={selectLocation('province')}
                  placeholder="Gõ để tìm tỉnh/thành, rồi chọn"
                />
                <AdministrativePicker
                  id="ward-filter"
                  label="Xã / Phường / Đặc khu"
                  value={filters.ward}
                  options={wardOptions}
                  onSelect={selectLocation('ward')}
                  placeholder={filters.province ? 'Gõ để tìm xã/phường, rồi chọn' : 'Chọn tỉnh/thành trước'}
                  disabled={!filters.province}
                  emptyText="Không tìm thấy xã/phường trong tỉnh/thành đã chọn."
                />
              </>}
              <Button type="submit" className="edu-button search-submit">
                <Search size={18} />
                Tìm kiếm giáo viên
              </Button>
            </form>
          </div>
          {(isFiltered || savedIds.length > 0) && (
            <div className="results-toolbar">
              {isFiltered && <span role="status">{`${filteredTutors.length} hồ sơ phù hợp${descriptionQuery ? ` với “${descriptionQuery}”` : query ? ` với “${query}”` : ''}`}</span>}
              <div>
                <button
                  className={`saved-filter ${savedOnly ? 'active' : ''}`}
                  onClick={() => setSavedOnly((current) => !current)}
                  aria-pressed={savedOnly}
                >
                  <Heart size={14} />
                  Đã tin tưởng ({savedIds.length})
                </button>
                {isFiltered && (
                  <button className="text-link" onClick={resetSearch}>
                    Xóa bộ lọc
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="tutors-grid">
            {visibleTutors.map((tutor) => (
              <TutorCard
                key={tutor.id}
                tutor={tutor}
                saved={isAuthenticated ? hasProviderTrust(user.id, tutor.id) : savedIds.includes(tutor.id)}
                onSave={() => {
                  if (!isAuthenticated) { toast.error('Vui lòng đăng nhập để tin tưởng giáo viên hoặc trung tâm.'); return; }
                  const isTrusted = toggleProviderTrust(user.id, tutor.id);
                  setSavedIds((current) => isTrusted ? [...new Set([...current, tutor.id])] : current.filter((id) => id !== tutor.id));
                  if (isTrusted) {
                    trackProviderAffinity(user.id, tutor.id, 'saved-profile', 4);
                    createNotification({ recipientId: tutor.id, actorName: user.name || 'Một học viên', actorAvatar: user.avatar || '', type: 'profile_like', title: `${user.name || 'Một học viên'} đã tin tưởng hồ sơ của bạn`, description: 'Uy tín của bạn được cộng đồng EduMatch ghi nhận.', link: ROUTES.TEACHER_PROFILE(tutor.id) });
                  }
                }}
                onOpen={() => {
                  if (isAuthenticated) trackProviderAffinity(user.id, tutor.id, 'viewed-profile', 1);
                  setProfile(tutor);
                }}
              />
            ))}
          </div>
          {visibleTutors.length === 0 && (
            <div className="search-empty">
              <Search size={30} />
              <h3>Chưa tìm thấy hồ sơ phù hợp</h3>
              <p>Thử chọn môn học, hình thức học hoặc khu vực khác.</p>
              <Button className="edu-button" onClick={resetSearch}>
                Xóa bộ lọc
              </Button>
            </div>
          )}
          {filteredTutors.length > 8 && !showAll && (
            <div className="course-pagination" aria-label="Mở rộng danh sách giáo viên và trung tâm">
              <button type="button" className="course-pagination__all" onClick={() => { setShowAll(true); setTutorPage(1); }}>
                Xem tất cả giáo viên <ArrowRight size={16} />
              </button>
            </div>
          )}
          {filteredTutors.length > 8 && showAll && (
            <div className="course-pagination" aria-label="Điều hướng danh sách giáo viên và trung tâm">
              <button type="button" onClick={() => { setShowAll(false); setTutorPage(1); }}>Thu gọn danh sách</button>
              <div className="course-pagination__pages">
                <button type="button" onClick={() => goToTutorPage(1)} disabled={tutorPage === 1}>Về đầu</button>
                <button type="button" onClick={() => goToTutorPage(Math.max(1, tutorPage - 1))} disabled={tutorPage === 1}>Trước</button>
                {Array.from({ length: totalTutorPages }, (_, index) => index + 1).map((page) => (
                  <button type="button" key={page} className={page === tutorPage ? 'is-current' : ''} aria-current={page === tutorPage ? 'page' : undefined} onClick={() => goToTutorPage(page)}>{page}</button>
                ))}
                <button type="button" onClick={() => goToTutorPage(Math.min(totalTutorPages, tutorPage + 1))} disabled={tutorPage === totalTutorPages}>Trang sau</button>
              </div>
            </div>
          )}
          <p className="sample-note">Hồ sơ giáo viên và trung tâm minh hoạ cho giao diện.</p>
        </section>

        {!isSearchResults && <>
        <section id="mon-hoc" className="home-section" aria-labelledby="subjects-heading">
          <SectionHeading
            title={
              <span id="subjects-heading">
                Khám phá <span className="accent-text">môn học</span>
              </span>
            }
          >
            <button className="text-link" onClick={() => setShowAllSubjects((current) => !current)}>
              {showAllSubjects ? 'Thu gọn môn học' : 'Khám phá các môn học'}
              <ArrowRight size={16} />
            </button>
          </SectionHeading>
          <p className="subject-discovery-label">Môn học nổi bật</p>
          <div className="subjects-grid">
            {subjects
              .slice(0, showAllSubjects ? subjects.length : 12)
              .map(({ name, icon: Icon, icon_url, color }) => (
                <button
                  key={name}
                  className={`subject-tile subject-${color} ${appliedFilters.subject === name ? 'selected' : ''}`}
                  aria-pressed={appliedFilters.subject === name}
                  onClick={() => chooseSubject(name)}
                >
                  <span className="subject-icon">
                    {icon_url ? <img src={icon_url} alt="" width="26" height="26" loading="lazy" /> : <Icon size={26} strokeWidth={1.7} />}
                  </span>
                  <span>{name}</span>
                </button>
              ))}
            <button
              className={`subject-tile subject-other ${showOtherSubjectSearch ? 'selected' : ''}`}
              aria-expanded={showOtherSubjectSearch}
              onClick={openOtherSubjectSearch}
            >
              <span className="subject-icon"><Search size={26} strokeWidth={1.8} /></span>
              <span>Khác</span>
            </button>
          </div>
          {showOtherSubjectSearch && (
            <div className="other-course-search" role="search" aria-label="Tìm khóa học khác">
              <div className="other-course-search__top">
                <button type="button" onClick={() => { setShowOtherSubjectSearch(false); setOtherCourseQuery(''); }} aria-label="Đóng tìm kiếm khóa học"><X size={17} /></button>
              </div>
              <form className="other-course-search__form" onSubmit={searchOtherSubject}>
                <div className="other-course-search__input">
                  <Search size={18} aria-hidden="true" />
                  <input
                    ref={otherSubjectInputRef}
                    value={otherCourseQuery}
                    onChange={(event) => setOtherCourseQuery(event.target.value)}
                    list="featured-subject-keywords"
                    placeholder="Ví dụ: IELTS, đàn guitar, luyện thi đại học..."
                    aria-label="Từ khóa tìm khóa học và giáo viên"
                  />
                  <datalist id="featured-subject-keywords">
                    {subjects.map(({ name }) => <option key={name} value={name} />)}
                  </datalist>
                </div>
                <Button type="submit" className="edu-button other-course-search__submit" disabled={!otherCourseQuery.trim()}>
                  Tìm kiếm <ArrowRight size={16} />
                </Button>
              </form>
            </div>
          )}
        </section>

        <section
          id="khoa-hoc-tai-tro"
          className="home-section sponsored-courses-section"
          ref={sponsoredRef}
          aria-labelledby="sponsored-courses-heading"
        >
          <SectionHeading
            title={
              <span id="sponsored-courses-heading">
                Khóa học <span className="accent-text">được tài trợ</span>
              </span>
            }
            description="Khám phá những khóa học nổi bật đang được giới thiệu trên EduMatch."
          >
            <span className="sponsored-caption">
              <Star size={15} fill="currentColor" />
              Được tài trợ
            </span>
          </SectionHeading>
          <div className="course-grid sponsored-course-grid">
            {visibleSponsoredCourses.map((course) => <CourseCard key={course.id} course={course} sponsored />)}
          </div>
          {sponsoredCourses.length > 3 && (
            <div className="course-pagination sponsored-pagination" aria-label="Điều hướng khóa học được tài trợ">
              {!showAllSponsored ? (
                <button type="button" className="course-pagination__all" onClick={() => { setShowAllSponsored(true); setSponsoredPage(1); }}>
                  Xem tất cả khóa học <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => { setShowAllSponsored(false); setSponsoredPage(1); }}>Thu gọn danh sách</button>
                  <div className="course-pagination__pages">
                    <button type="button" onClick={() => goToSponsoredPage(1)} disabled={sponsoredPage === 1}>Về đầu</button>
                    <button type="button" onClick={() => goToSponsoredPage(Math.max(1, sponsoredPage - 1))} disabled={sponsoredPage === 1}>Trước</button>
                    {Array.from({ length: totalSponsoredPages }, (_, index) => index + 1).map((page) => (
                      <button type="button" key={page} className={page === sponsoredPage ? 'is-current' : ''} aria-current={page === sponsoredPage ? 'page' : undefined} onClick={() => goToSponsoredPage(page)}>{page}</button>
                    ))}
                    <button type="button" onClick={() => goToSponsoredPage(Math.min(totalSponsoredPages, sponsoredPage + 1))} disabled={sponsoredPage === totalSponsoredPages}>Trang sau</button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <section className="bottom-cta">
          <div className="cta-icon">
            <BookOpen size={37} strokeWidth={1.4} />
          </div>
          <div className="cta-copy">
            <h2>Bắt đầu hành trình của bạn hôm nay.</h2>
            <p>Một người thầy phù hợp, những cơ hội mới đang chờ.</p>
          </div>
          <div className="cta-actions">
            <a className="edu-button button-link" href="#khoa-hoc">
              <Search size={18} />
              Tìm kiếm lớp học
            </a>
            <a className="edu-button edu-button-outline button-link" href="#giao-vien">
              <Search size={18} />
              Tìm kiếm giáo viên
            </a>
          </div>
        </section>
        </>}
      </div>

      <Modal
        open={Boolean(profile)}
        onClose={() => setProfile(null)}
        title="Khám phá người đồng hành"
        size="lg"
        className="edu-modal"
      >
        {profile && (
          <div className="profile-detail">
            <div className="profile-detail-heading">
              {profile.image ? <img src={profile.image} alt={profile.name} width="84" height="96" /> : <span className="profile-avatar-fallback" aria-hidden="true">{profile.name.slice(0, 1)}</span>}
              <div>
                <span className="subject-tag">{profile.subject}</span>
                <h3><Link to={ROUTES.TEACHER_PROFILE(profile.id)} onClick={() => setProfile(null)}>{profile.title} {profile.name}</Link></h3>
                {profile.reviews ? (
                  <p><Star size={15} fill="currentColor" /> {profile.rating.toFixed(1)} <span>({profile.reviews} đánh giá)</span></p>
                ) : null}
                <p className={`profile-detail__trust ${profileTrustCount < 3 ? 'is-new' : ''}`}>
                  {profileTrustCount < 3 ? 'Mới trên EduMatch' : <><Heart size={15} fill="currentColor" /> {profileTrustCount} lượt tin tưởng</>}
                </p>
                <VerifiedBadge userId={profile.id} />
              </div>
            </div>
            <dl className="profile-detail__info">
              <div><dt>Lĩnh vực giảng dạy</dt><dd>{profile.teachingField || profile.subject || 'Đang cập nhật'}</dd></div>
              {isCenterProfile ? (
                <div><dt>Năm thành lập</dt><dd>{profile.foundedYear || 'Đang cập nhật'}</dd></div>
              ) : (
                <>
                  <div><dt>Kinh nghiệm</dt><dd>{typeof profile.experience === 'number' ? `${profile.experience} năm` : profile.experience || 'Đang cập nhật'}</dd></div>
                  <div><dt>Hình thức giảng dạy</dt><dd>{profile.mode === 'online' ? 'Trực tuyến' : profile.mode === 'recorded' ? 'Video quay sẵn' : profile.mode === 'offline' ? 'Trực tiếp' : 'Trực tuyến và trực tiếp'}</dd></div>
                </>
              )}
              {profile.isPhonePublic && profile.phone && <div><dt>Số điện thoại liên hệ</dt><dd><a href={`tel:${profile.phone.replace(/\s/g, '')}`}><Phone size={15} /> {profile.phone}</a></dd></div>}
            </dl>
            <div className="profile-detail__bio"><h4>{isCenterProfile ? 'Thông tin trung tâm' : 'Thông tin giáo viên'}</h4><p>{[profile.description, profile.bio].filter(Boolean).join(' ') || 'Đang cập nhật thông tin giới thiệu.'}</p></div>
            {profileCourses.length > 0 && <section className="profile-detail__courses"><h4>Khóa học đang mở trên EduMatch</h4><div>{profileCourses.map((course) => <Link key={course.id} to={ROUTES.COURSE_DETAIL(course.id)} onClick={() => setProfile(null)}><span><strong>{course.title}</strong><small>{course.description}</small></span><ArrowRight size={17} /></Link>)}</div></section>}
            <div className="profile-detail__actions">
              <Button className="edu-button" onClick={() => registerForTutor(profile)}><MessageCircle size={17} /> Đăng Ký Học</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={dialog === 'teacher' || dialog === 'register'}
        onClose={closeDialog}
        title={dialog === 'teacher' ? 'Trở thành giáo viên EduMatch' : 'Bắt đầu cùng EduMatch'}
        className="edu-modal"
      >
        <div className="join-content">
          <span className="join-icon">
            {dialog === 'teacher' ? <GraduationCap size={35} /> : <Users size={35} />}
          </span>
          <h3>
            {dialog === 'teacher'
              ? 'Chia sẻ kiến thức. Truyền cảm hứng.'
              : 'Tìm người thầy phù hợp với bạn.'}
          </h3>
          <p>
            {dialog === 'teacher'
              ? 'Đồng hành cùng học viên, xây dựng lớp học của riêng bạn và giảng dạy theo lịch phù hợp.'
              : 'Khám phá giáo viên, lưu những hồ sơ yêu thích và chọn cách học phù hợp với bạn.'}
          </p>
          <div className="join-benefits">
            <span>
              <CheckCircle2 size={17} />
              Hồ sơ minh bạch
            </span>
            <span>
              <CheckCircle2 size={17} />
              Lịch học linh hoạt
            </span>
            <span>
              <CheckCircle2 size={17} />
              Hỗ trợ tận tâm
            </span>
          </div>
          <p className="dialog-note">
            Giao diện đăng ký đang được chuẩn bị. Bạn có thể tìm hiểu nhu cầu học tập hoặc sử dụng
            trang đăng nhập hiện có.
          </p>
          <Button className="edu-button w-full" onClick={() => openDialog('consultation')}>
            Tìm hiểu thêm
            <ArrowRight size={16} />
          </Button>
          <Link to={ROUTES.LOGIN} className="text-link join-login">
            Đã có tài khoản? Đăng nhập
          </Link>
        </div>
      </Modal>

      <Modal
        open={dialog === 'consultation'}
        onClose={closeDialog}
        title="Tư vấn lộ trình học tập"
        description="Cùng tìm ra cách học phù hợp với bạn."
        className="edu-modal"
      >
        {consultationComplete ? (
          <div className="consultation-success">
            <span className="join-icon">
              <CheckCircle2 size={36} />
            </span>
            <h3>Cảm ơn bạn, {consultation.name}!</h3>
            <p>
              Bạn đã hoàn tất trải nghiệm biểu mẫu. Thông tin chưa được gửi đi vì giao diện chưa kết
              nối dịch vụ tư vấn.
            </p>
            <Button className="edu-button" onClick={closeDialog}>
              Tiếp tục khám phá
              <ArrowRight size={16} />
            </Button>
          </div>
        ) : (
          <form
            className="consultation-form"
            onSubmit={(event) => {
              event.preventDefault();
              setConsultationComplete(true);
            }}
          >
            <a className="consultation-hotline" href="tel:19001345">
              <span><Phone size={19} aria-hidden="true" /></span>
              <div><small>Hotline tư vấn miễn phí</small><strong>1900 1345</strong></div>
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <label>
              Họ và tên
              <input
                name="name"
                autoComplete="name"
                required
                maxLength={80}
                placeholder="Tên của bạn"
                value={consultation.name}
                onChange={(event) =>
                  setConsultation((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label>
              Số điện thoại
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                pattern="[+]?[0-9]{9,15}"
                title="Nhập số điện thoại từ 9 đến 16 ký tự"
                placeholder="Nhập số điện thoại"
                value={consultation.phone}
                onChange={(event) =>
                  setConsultation((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </label>
            <label>
              Khóa học / môn học cần tư vấn
              <input
                name="subject"
                type="text"
                list="consultation-subject-suggestions"
                maxLength={140}
                placeholder="Ví dụ: Luyện thi IELTS, Toán lớp 12..."
                value={consultation.subject}
                onChange={(event) =>
                  setConsultation((current) => ({ ...current, subject: event.target.value }))
                }
              />
              <datalist id="consultation-subject-suggestions">
                {subjects.map((subject) => (
                  <option key={subject.name} value={subject.name} />
                ))}
              </datalist>
            </label>
            <label>
              Ghi chú <em>(không bắt buộc)</em>
              <textarea
                name="note"
                rows="3"
                maxLength={600}
                placeholder="Chia sẻ mục tiêu học, thời gian mong muốn hoặc điều bạn cần được tư vấn..."
                value={consultation.note}
                onChange={(event) =>
                  setConsultation((current) => ({ ...current, note: event.target.value }))
                }
              />
            </label>
            <p className="dialog-note">
              EduMatch hướng tới một môi trường giáo dục an toàn, minh bạch và hiệu quả. Thông tin tư vấn được dùng để kết nối bạn với lựa chọn học tập phù hợp.
            </p>
            <Button type="submit" className="edu-button w-full">
              Hoàn tất biểu mẫu
              <ArrowRight size={16} />
            </Button>
          </form>
        )}
      </Modal>
      <Modal
        open={['terms', 'privacy', 'faq', 'support'].includes(dialog)}
        onClose={closeDialog}
        title={
          {
            terms: 'Điều khoản sử dụng',
            privacy: 'Chính sách bảo mật',
            faq: 'Câu hỏi thường gặp',
            support: 'Hỗ trợ từ EduMatch',
          }[dialog]
        }
        className="edu-modal"
      >
        {dialog === 'faq' ? (
          <div className="faq-list">
            {[
              {
                q: 'Tôi có thể tìm giáo viên như thế nào?',
                a: 'Chọn môn học, hình thức, học phí và đánh giá tại bộ lọc. Bạn cũng có thể tìm theo tên bằng ô tìm kiếm trên đầu trang.',
              },
              {
                q: 'Có thể học trực tuyến không?',
                a: 'Bạn có thể chọn hình thức Trực tuyến trong bộ lọc để tìm những hồ sơ phù hợp.',
              },
              {
                q: 'Làm sao để lưu giáo viên yêu thích?',
                a: 'Nhấn biểu tượng trái tim trên hồ sơ. Danh sách được lưu trong trình duyệt của bạn.',
              },
            ].map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        ) : (
          <div className="info-content">
            <ShieldCheck size={32} />
            <p>
              {dialog === 'support'
                ? 'EduMatch luôn hướng đến môi trường giáo dục an toàn, minh bạch và hiệu quả. Bạn có thể khám phá câu hỏi thường gặp hoặc điền biểu mẫu tư vấn để tìm lựa chọn học tập phù hợp.'
                : 'Chính sách của EduMatch được xây dựng để bảo vệ trải nghiệm học tập an toàn, thông tin minh bạch và kết quả hiệu quả cho mọi thành viên.'}
            </p>
            <Button
              className="edu-button"
              onClick={() => openDialog(dialog === 'support' ? 'faq' : 'consultation')}
            >
              {dialog === 'support' ? 'Xem câu hỏi thường gặp' : 'Tìm hiểu thêm'}
              <ArrowRight size={16} />
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Home;
