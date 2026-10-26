import { STORAGE_KEYS } from '@/constants/storageKeys';
import { storage } from '@/utils/storage';
import { getVideoMediaUrl, hydrateVideoMedia } from '@/utils/mediaLibrary';
import tutoringHero from '@/assets/tutoring-hero.webp';
import studyTogether from '@/assets/register-student.webp';
import teacherCommunity from '@/assets/vietnamese-teachers-avatar-strip.png';
import fullCenterAvatar from '@/assets/full-center-avatar.svg';
import fullCenterCover from '@/assets/backgroup.webp';

const centerProfiles = {
  oldSchool: {
    id: 'center-old-school',
    name: 'Trung tâm The Old School',
    role: 'center',
    foundedYear: '2017',
    licenseVerificationStatus: 'verified',
    heartCount: 128,
    bio: 'Trung tâm ngoại ngữ với chương trình cá nhân hóa và đội ngũ giáo viên giàu kinh nghiệm.',
    detailedProfile: `The Old School xây dựng lộ trình tiếng Anh theo năng lực đầu vào, mục tiêu đầu ra và nhịp học của từng học viên. Mỗi lớp duy trì quy mô nhỏ để giáo viên có thể theo dõi tiến độ, phản hồi bài tập và điều chỉnh nội dung phù hợp.\n\nĐội ngũ chuyên môn của trung tâm tập trung vào tiếng Anh giao tiếp, IELTS nền tảng và IELTS Writing. Học viên được kiểm tra đầu vào, nhận kế hoạch học rõ ràng và tham gia các buổi thực hành định kỳ. Không gian học được thiết kế yên tĩnh, an toàn và thân thiện để người học tự tin đặt câu hỏi và tiến bộ từng tuần.\n\nTrung tâm cam kết công khai thông tin khóa học, học phí và lộ trình trước khi đăng ký. Hồ sơ pháp lý đã được EduMatch xác thực.`,
    profilePortfolioImages: [tutoringHero, studyTogether],
  },
  educare: {
    id: 'center-educare',
    name: 'Trung tâm EduCare',
    role: 'center',
    foundedYear: '2021',
    licenseVerificationStatus: 'pending',
    heartCount: 18,
    bio: 'Đơn vị đào tạo kỹ năng thực hành dành cho học sinh, sinh viên và người đi làm.',
    detailedProfile: `EduCare phát triển các chương trình kỹ năng thực hành dành cho học sinh, sinh viên và người đi làm. Nội dung học tập được thiết kế theo tình huống thực tế, kết hợp hướng dẫn chuyên môn, thực hành nhóm và phản hồi cá nhân.\n\nCác lớp nổi bật gồm thuyết trình, tư duy làm việc và ứng dụng Excel trong công việc. Trước mỗi khóa, học viên được chia sẻ mục tiêu, thời lượng và học phí để chủ động lựa chọn. Sau khóa học, EduCare gửi nhận xét tiến bộ và gợi ý lộ trình tiếp theo.\n\nHồ sơ giấy phép của trung tâm đã được gửi đến EduMatch và đang trong quá trình xét duyệt.`,
    profilePortfolioImages: [studyTogether, teacherCommunity],
  },
  melody: {
    id: 'center-melody-studio',
    name: 'Melody Studio',
    role: 'center',
    foundedYear: '2023',
    heartCount: 2,
    bio: 'Không gian học âm nhạc gần gũi dành cho trẻ em và người lớn.',
  },
  horizon: {
    id: 'center-horizon-learning',
    name: 'Horizon Learning Hub',
    role: 'center',
    foundedYear: '2019',
    licenseVerificationStatus: 'verified',
    heartCount: 64,
    bio: 'Trung tâm tiếng Anh ứng dụng với lớp học nhỏ, lộ trình rõ ràng và phản hồi sát sao.',
    detailedProfile: `Horizon Learning Hub đồng hành cùng học viên từ tiếng Anh nền tảng đến TOEIC và giao tiếp chuyên nghiệp. Trung tâm xây dựng lớp học nhỏ, kiểm tra đầu vào trước khi xếp lớp và công khai kế hoạch học, học phí cùng mục tiêu đầu ra.\n\nĐội ngũ giáo viên có kinh nghiệm luyện thi và đào tạo tiếng Anh cho người đi làm. Mỗi học viên có báo cáo tiến độ theo từng chặng để chủ động điều chỉnh mục tiêu học tập.\n\nHồ sơ pháp lý của trung tâm đã được EduMatch xác thực.`,
    profilePortfolioImages: [tutoringHero, teacherCommunity],
  },
  brightPath: {
    id: 'center-bright-path',
    name: 'Bright Path Academy',
    role: 'center',
    foundedYear: '2025',
    heartCount: 1,
    bio: 'Không gian đào tạo kỹ năng giao tiếp và thuyết trình dành cho sinh viên, người đi làm.',
  },
  fullProfile: {
    id: 'center-trung-tam-day-du',
    name: 'Trung Tâm Đầy Đủ',
    role: 'center',
    avatar: fullCenterAvatar,
    coverImage: fullCenterCover,
    foundedYear: '2014',
    licenseVerificationStatus: 'verified',
    heartCount: 1286,
    isPhonePublic: true,
    phone: '0908123456',
    bio: 'Trung tâm đào tạo đa kỹ năng với lộ trình rõ ràng, đội ngũ chuyên môn và hoạt động học tập thường xuyên.',
    detailedProfile: `Trung Tâm Đầy Đủ xây dựng các chương trình học theo nhu cầu thực tế của học viên, từ tiếng Anh, kỹ năng học tập đến kỹ năng nghề nghiệp. Mỗi lộ trình đều có tư vấn đầu vào, mục tiêu rõ ràng và phản hồi định kỳ để học viên theo dõi tiến bộ.\n\nĐội ngũ giảng viên của trung tâm có kinh nghiệm chuyên môn, ưu tiên lớp học quy mô phù hợp và môi trường trao đổi cởi mở. Hồ sơ pháp lý, thông tin khóa học và học phí được công khai minh bạch trên EduMatch.`,
    profilePortfolioImages: [tutoringHero, studyTogether, teacherCommunity],
  },
};

const teacherProfiles = {
  linhAn: {
    id: 'teacher-linh-an',
    name: 'Cô Lê Linh An',
    role: 'teacher',
    dob: '1991-08-12',
    qualifications: 'Thạc sĩ Giảng dạy tiếng Anh, IELTS 8.0',
    experience: '9 năm giảng dạy tiếng Anh giao tiếp và IELTS',
    heartCount: 247,
    isPhonePublic: true,
    phone: '0901234567',
    bio: 'Tôi giúp người học xây phản xạ tiếng Anh tự nhiên bằng lộ trình vừa sức và nhiều thực hành.',
    detailedProfile: `Tôi tập trung vào tiếng Anh giao tiếp, IELTS nền tảng và kỹ năng thuyết trình bằng tiếng Anh. Mỗi học viên được trao đổi mục tiêu ngay từ đầu để xây dựng nhịp học phù hợp, ưu tiên sử dụng ngôn ngữ trong những tình huống gần gũi.\n\nLớp học kết hợp phản xạ nghe nói, bài tập cá nhân và nhận xét sau từng buổi. Tôi tin rằng sự tiến bộ bền vững bắt đầu từ cảm giác an toàn khi được thử, được sai và được phản hồi rõ ràng.`,
    profilePortfolioImages: [studyTogether, tutoringHero],
  },
  ducHieu: {
    id: 'teacher-duc-hieu',
    name: 'Thầy Nguyễn Đức Hiếu',
    role: 'teacher',
    dob: '1997-03-22',
    qualifications: 'Cử nhân Sư phạm Toán học',
    experience: '3 năm đồng hành cùng học sinh THPT',
    heartCount: 2,
    bio: 'Dạy Toán theo tư duy nền tảng, giúp học viên hiểu bản chất trước khi luyện đề.',
  },
  phuongThao: {
    id: 'teacher-phuong-thao',
    name: 'Cô Phạm Phương Thảo',
    role: 'teacher',
    dob: '1993-11-04',
    qualifications: 'Cử nhân Thiết kế đồ họa, chứng chỉ Adobe Certified Professional',
    experience: '6 năm làm nghề và giảng dạy thiết kế',
    heartCount: 58,
    bio: 'Tôi hướng dẫn thiết kế từ nền tảng thị giác đến quy trình xây dựng một portfolio cá nhân.',
    detailedProfile: `Tôi dạy thiết kế đồ họa cho người mới bắt đầu, tập trung vào tư duy thị giác, bố cục, màu sắc và khả năng kể chuyện bằng hình ảnh. Lộ trình học đi từ bài tập nhỏ đến dự án portfolio cá nhân.\n\nHọc viên được xem phản hồi trực tiếp trên bài làm, nhận định hướng tài nguyên phù hợp và thực hành theo brief gần với môi trường công việc.`,
    profilePortfolioImages: [teacherCommunity, studyTogether],
  },
  minhKhoa: {
    id: 'teacher-minh-khoa',
    name: 'Thầy Trần Minh Khoa',
    role: 'teacher',
    dob: '1990-01-17',
    qualifications: 'Kỹ sư Công nghệ thông tin, chứng chỉ AWS Cloud Practitioner',
    experience: '8 năm phát triển phần mềm và 4 năm hướng dẫn lập trình',
    heartCount: 103,
    bio: 'Học lập trình bằng dự án nhỏ, từng bước hiểu cách biến ý tưởng thành sản phẩm.',
    detailedProfile: `Tôi hướng dẫn Python, JavaScript và kỹ năng xây dựng sản phẩm web cho người mới. Nội dung học luôn gắn với bài tập có đầu ra rõ ràng, giúp học viên hiểu luồng tư duy thay vì chỉ ghi nhớ cú pháp.\n\nHọc viên được theo sát từ bước cài đặt môi trường, chia nhỏ bài toán đến hoàn thiện dự án cá nhân.`,
    profilePortfolioImages: [tutoringHero, teacherCommunity],
  },
};

const sampleCourses = [
  {
    id: 'course-english-foundation',
    title: 'Tiếng Anh giao tiếp nền tảng',
    description: 'Xây nền phản xạ nghe nói với lộ trình rõ ràng và bài tập cá nhân hoá.',
    price: 1800000,
    paymentType: 'full-course',
    sessions: 12,
    duration: 90,
    schedule: 'Thứ 3 và Thứ 6, 19:00 – 20:30',
    learningMode: 'online',
    enrollmentStatus: 'open',
    createdAt: '2026-10-01T09:00:00.000Z',
    teacher: { ...teacherProfiles.linhAn },
  },
  {
    id: 'course-old-school-ielts',
    title: 'IELTS nền tảng đến 6.5',
    description: 'Lộ trình tiếng Anh có kiểm tra đầu vào, theo sát tiến độ và luyện kỹ năng theo từng tuần.',
    price: 4200000,
    paymentType: 'full-course',
    sessions: 24,
    duration: 90,
    schedule: 'Thứ 3, Thứ 5 và Chủ nhật',
    learningMode: 'in-person',
    inPersonType: 'classroom',
    location: 'Cầu Giấy, Hà Nội',
    enrollmentStatus: 'open',
    createdAt: '2026-10-06T09:00:00.000Z',
    teacher: { ...centerProfiles.oldSchool },
  },
  {
    id: 'course-educare-skills',
    title: 'Kỹ năng thuyết trình tự tin',
    description: 'Lớp thực hành giúp học viên xây dựng tư duy trình bày, giọng nói và sự tự tin trước đám đông.',
    price: 2600000,
    paymentType: 'full-course',
    sessions: 10,
    duration: 120,
    schedule: 'Thứ 7 hằng tuần',
    learningMode: 'in-person',
    inPersonType: 'classroom',
    location: 'Hải Châu, Đà Nẵng',
    enrollmentStatus: 'open',
    createdAt: '2026-10-05T09:00:00.000Z',
    teacher: { ...centerProfiles.educare },
  },
  {
    id: 'course-melody-piano',
    title: 'Piano cho người mới bắt đầu',
    description: 'Học đọc nhạc và chơi những giai điệu đầu tiên trong lớp quy mô nhỏ, phù hợp người mới.',
    price: 1800000,
    paymentType: 'monthly',
    sessionsPerWeek: 2,
    duration: 60,
    schedule: 'Lịch linh hoạt theo lớp',
    learningMode: 'in-person',
    inPersonType: 'classroom',
    location: 'Quận 3, TP. Hồ Chí Minh',
    enrollmentStatus: 'open',
    createdAt: '2026-10-04T09:00:00.000Z',
    teacher: { ...centerProfiles.melody },
  },
  {
    id: 'course-old-school-ielts-writing',
    title: 'IELTS Writing chuyên sâu 6.5+',
    description: 'Lớp luyện viết theo chủ đề với chữa bài cá nhân và chiến lược triển khai ý rõ ràng.',
    price: 3200000,
    paymentType: 'full-course',
    sessions: 16,
    duration: 120,
    schedule: 'Thứ 2 và Thứ 6, 19:00 – 21:00',
    learningMode: 'online',
    enrollmentStatus: 'open',
    createdAt: '2026-10-07T08:30:00.000Z',
    teacher: { ...centerProfiles.oldSchool },
  },
  {
    id: 'course-educare-excel',
    title: 'Excel thực hành cho công việc',
    description: 'Thực hành công thức, báo cáo và xử lý dữ liệu với các tình huống công việc phổ biến.',
    price: 1950000,
    paymentType: 'full-course',
    sessions: 8,
    duration: 120,
    schedule: 'Chủ nhật hằng tuần',
    learningMode: 'in-person',
    inPersonType: 'classroom',
    location: 'Hải Châu, Đà Nẵng',
    enrollmentStatus: 'open',
    createdAt: '2026-10-07T10:00:00.000Z',
    teacher: { ...centerProfiles.educare },
  },
  {
    id: 'course-melody-guitar',
    title: 'Guitar đệm hát cho người mới',
    description: 'Bắt đầu từ hợp âm cơ bản đến tự tin đệm hát những ca khúc yêu thích.',
    price: 2100000,
    paymentType: 'monthly',
    sessionsPerWeek: 2,
    duration: 75,
    schedule: 'Tối thứ 4 và thứ 7',
    learningMode: 'in-person',
    inPersonType: 'classroom',
    location: 'Quận 3, TP. Hồ Chí Minh',
    enrollmentStatus: 'open',
    createdAt: '2026-10-07T11:00:00.000Z',
    teacher: { ...centerProfiles.melody },
  },
  {
    id: 'course-horizon-toeic',
    title: 'TOEIC nền tảng cho người đi làm',
    description: 'Lộ trình củng cố ngữ pháp, từ vựng và kỹ năng làm bài theo mục tiêu thực tế.',
    price: 3600000,
    paymentType: 'full-course',
    sessions: 18,
    duration: 90,
    schedule: 'Thứ 3 và Thứ 7, 19:00 – 20:30',
    learningMode: 'in-person',
    inPersonType: 'classroom',
    location: 'Thanh Xuân, Hà Nội',
    enrollmentStatus: 'open',
    createdAt: '2026-10-12T09:00:00.000Z',
    teacher: { ...centerProfiles.horizon },
  },
  {
    id: 'course-horizon-speaking',
    title: 'Tiếng Anh giao tiếp công sở',
    description: 'Thực hành các tình huống họp, giới thiệu bản thân và giao tiếp trong công việc.',
    price: 2400000,
    paymentType: 'monthly',
    sessionsPerWeek: 2,
    duration: 90,
    schedule: 'Thứ 2 và Thứ 5, 18:30 – 20:00',
    learningMode: 'online',
    enrollmentStatus: 'open',
    createdAt: '2026-10-11T14:00:00.000Z',
    teacher: { ...centerProfiles.horizon },
  },
  {
    id: 'course-bright-path-speaking',
    title: 'Thuyết trình tự tin từ nền tảng',
    description: 'Lớp thực hành giọng nói, cấu trúc nội dung và kỹ năng trình bày trước đám đông.',
    price: 2200000,
    paymentType: 'full-course',
    sessions: 8,
    duration: 120,
    schedule: 'Sáng Chủ nhật',
    learningMode: 'in-person',
    inPersonType: 'classroom',
    location: 'Bình Thạnh, TP. Hồ Chí Minh',
    enrollmentStatus: 'open',
    createdAt: '2026-10-10T10:00:00.000Z',
    teacher: { ...centerProfiles.brightPath },
  },
  {
    id: 'course-linh-an-speaking',
    title: 'Phản xạ tiếng Anh giao tiếp',
    description: 'Luyện nói theo tình huống đời sống với phản hồi cá nhân sau từng buổi học.',
    price: 2800000,
    paymentType: 'full-course',
    sessions: 12,
    duration: 90,
    schedule: 'Thứ 4 và Chủ nhật, 20:00 – 21:30',
    learningMode: 'online',
    enrollmentStatus: 'open',
    createdAt: '2026-10-13T08:00:00.000Z',
    teacher: { ...teacherProfiles.linhAn },
  },
  {
    id: 'course-duc-hieu-math',
    title: 'Toán nền tảng 10',
    description: 'Củng cố tư duy đại số và hình học cho học sinh cần học chắc từ gốc.',
    price: 1600000,
    paymentType: 'monthly',
    sessionsPerWeek: 2,
    duration: 90,
    schedule: 'Thứ 3 và Thứ 6, 18:00 – 19:30',
    learningMode: 'in-person',
    inPersonType: 'home',
    location: 'Nam Từ Liêm, Hà Nội',
    enrollmentStatus: 'open',
    createdAt: '2026-10-12T13:00:00.000Z',
    teacher: { ...teacherProfiles.ducHieu },
  },
  {
    id: 'course-phuong-thao-design',
    title: 'Thiết kế đồ họa cho người mới',
    description: 'Làm chủ bố cục, màu sắc và hoàn thiện portfolio thiết kế đầu tiên.',
    price: 3000000,
    paymentType: 'full-course',
    sessions: 10,
    duration: 120,
    schedule: 'Tối thứ 3 và thứ 5',
    learningMode: 'online',
    enrollmentStatus: 'open',
    createdAt: '2026-10-09T08:00:00.000Z',
    teacher: { ...teacherProfiles.phuongThao },
  },
  {
    id: 'course-minh-khoa-python',
    title: 'Python qua dự án thực tế',
    description: 'Khởi đầu cùng Python bằng các bài tập nhỏ và một dự án cá nhân hoàn chỉnh.',
    price: 3400000,
    paymentType: 'full-course',
    sessions: 14,
    duration: 120,
    schedule: 'Thứ 2 và Thứ 6, 19:30 – 21:30',
    learningMode: 'online',
    enrollmentStatus: 'open',
    createdAt: '2026-10-08T14:00:00.000Z',
    teacher: { ...teacherProfiles.minhKhoa },
  },
  {
    id: 'course-trung-tam-day-du-english',
    title: 'Tiếng Anh ứng dụng cho người đi làm',
    description: 'Lộ trình giao tiếp thực hành với phản hồi cá nhân, phù hợp người cần dùng tiếng Anh trong công việc.',
    price: 2800000,
    paymentType: 'monthly',
    sessionsPerWeek: 2,
    duration: 90,
    schedule: 'Thứ 3 và Thứ 6, 19:00 - 20:30',
    learningMode: 'both',
    enrollmentStatus: 'open',
    createdAt: '2026-10-15T09:00:00.000Z',
    rating: 4.9,
    reviewCount: 186,
    teacher: { ...centerProfiles.fullProfile },
  },
];

const fullCenterPostImages = [tutoringHero, studyTogether, teacherCommunity];
const fullCenterPostCopy = [
  'Hôm nay lớp giao tiếp đã hoàn thành phần thực hành giới thiệu dự án. Các nhóm nhận phản hồi trực tiếp để hoàn thiện bài nói trong buổi sau.',
  'Trung tâm vừa cập nhật lịch workshop cuối tuần. Học viên có thể đăng ký để trải nghiệm một buổi học ngắn trước khi chọn lộ trình phù hợp.',
  'Một số khoảnh khắc từ buổi chữa bài theo nhóm. Cảm ơn các bạn đã chuẩn bị rất kỹ và chủ động đặt câu hỏi.',
  'Lớp mới sẽ bắt đầu vào tuần tới với bài kiểm tra đầu vào và buổi tư vấn mục tiêu học tập miễn phí.',
  'Đội ngũ giảng viên đã họp chuyên môn để cập nhật bộ bài tập thực hành theo những tình huống gần với công việc hằng ngày.',
];

const fullCenterPosts = Array.from({ length: 50 }, (_, index) => {
  const number = index + 1;
  const isAlbum = number % 10 === 0;
  const hasImage = isAlbum || number % 4 === 0;
  const imageAt = index % fullCenterPostImages.length;
  return {
    id: `sample-full-center-post-${number}`,
    teacherId: centerProfiles.fullProfile.id,
    authorId: centerProfiles.fullProfile.id,
    authorName: centerProfiles.fullProfile.name,
    authorRole: 'center',
    authorLicenseVerificationStatus: 'verified',
    text: fullCenterPostCopy[index % fullCenterPostCopy.length],
    ...(isAlbum ? {
      mediaItems: fullCenterPostImages.map((src, imageIndex) => ({
        src,
        type: 'image',
        name: `Hoạt động lớp học ${imageIndex + 1}`,
      })),
    } : hasImage ? {
      media: {
        src: fullCenterPostImages[imageAt],
        type: 'image',
        name: 'Khoảnh khắc hoạt động tại trung tâm',
      },
    } : {}),
    createdAt: new Date(Date.UTC(2026, 9, 16 - Math.floor(index / 2), 9 + (index % 8), 0)).toISOString(),
    likes: Array.from({ length: 12 + (index % 25) }, (_, likeIndex) => `sample-supporter-${likeIndex + 1}`),
    comments: [],
  };
});

const read = (key, fallback) => storage.get(key, fallback);
const write = (key, value) => storage.set(key, value);
const notifyPostsChange = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('edumatch:posts-updated'));
};
const notifyCourseReviewsChange = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('edumatch:course-reviews-updated'));
};

const normalizePostMediaItem = (postId, item, index) => ({
  ...item,
  ...(item?.type === 'video' && item?.storageKey ? { src: getVideoMediaUrl(item.storageKey, item.src) } : {}),
  id: item?.id || `${postId}-media-${index + 1}`,
  likes: Array.isArray(item?.likes) ? item.likes : [],
  comments: Array.isArray(item?.comments) ? item.comments : [],
});

export const getPostMediaItems = (post) => {
  const rawItems = Array.isArray(post?.mediaItems) && post.mediaItems.length
    ? post.mediaItems
    : post?.media
      ? [post.media]
      : [];

  return rawItems.map((item, index) => normalizePostMediaItem(post?.id || 'post', item, index));
};

const normalizePostMedia = (post) => {
  const mediaItems = getPostMediaItems(post);
  if (!mediaItems.length) return post;

  return {
    ...post,
    mediaItems,
    media: post.media || mediaItems[0],
  };
};

export const getCourses = () => {
  const saved = read(STORAGE_KEYS.COURSES, []);
  const currentUser = read(STORAGE_KEYS.USER_INFO, null);
  const hydratedSavedCourses = saved.map((course) =>
    currentUser?.id != null && course.teacher?.id != null && String(course.teacher.id) === String(currentUser.id)
      ? {
          ...course,
          teacher: {
            ...course.teacher,
            ...(currentUser.avatar ? { avatar: currentUser.avatar } : {}),
            ...(currentUser.phone ? { phone: currentUser.phone } : {}),
            ...(typeof currentUser.isPhonePublic === 'boolean'
              ? { isPhonePublic: currentUser.isPhonePublic }
              : {}),
            ...(currentUser.foundedYear ? { foundedYear: currentUser.foundedYear } : {}),
            ...(currentUser.licenseVerificationStatus ? { licenseVerificationStatus: currentUser.licenseVerificationStatus } : {}),
          },
        }
      : course
  );
  return [...hydratedSavedCourses, ...sampleCourses];
};

export const getCourse = (id) => getCourses().find((course) => course.id === id);

export const saveCourse = (course) => {
  const saved = read(STORAGE_KEYS.COURSES, []);
  write(STORAGE_KEYS.COURSES, [course, ...saved]);
  return course;
};

export const updateCourse = (courseId, updates) => {
  const saved = read(STORAGE_KEYS.COURSES, []);
  const index = saved.findIndex((course) => course.id === courseId);
  if (index === -1) return getCourse(courseId);

  const next = [...saved];
  next[index] = { ...next[index], ...updates };
  write(STORAGE_KEYS.COURSES, next);
  return next[index];
};

export const syncTeacherCourseProfile = (teacherId, profileUpdates) => {
  const saved = read(STORAGE_KEYS.COURSES, []);
  const next = saved.map((course) =>
    course.teacher?.id != null && String(course.teacher.id) === String(teacherId)
      ? { ...course, teacher: { ...course.teacher, ...profileUpdates } }
      : course
  );
  write(STORAGE_KEYS.COURSES, next);
  return next;
};

const normalizeStoredVideo = (media) => media?.type === 'video' && media.storageKey
  ? { ...media, src: getVideoMediaUrl(media.storageKey, media.src) }
  : media;

const collectStoredVideoKeys = (media, keys) => {
  if (media?.type === 'video' && media.storageKey) keys.add(media.storageKey);
};

const queueVideoHydration = (keys, onHydrated) => {
  if (!keys.size) return;
  void Promise.all([...keys].map(hydrateVideoMedia)).then((results) => {
    if (results.some((result) => result.hydrated)) onHydrated();
  }).catch(() => {});
};

export const getCourseReviews = (courseId) => {
  const videoKeys = new Set();
  const reviews = read(STORAGE_KEYS.COURSE_REVIEWS, [])
    .filter((review) => review.courseId === courseId)
    .map((review) => {
      collectStoredVideoKeys(review.media, videoKeys);
      const replies = (review.replies || []).map((reply) => {
        collectStoredVideoKeys(reply.media, videoKeys);
        return { ...reply, media: normalizeStoredVideo(reply.media) };
      });
      return { ...review, media: normalizeStoredVideo(review.media), replies };
    });
  queueVideoHydration(videoKeys, notifyCourseReviewsChange);
  return reviews;
};

export const addCourseReview = (review) => {
  const saved = read(STORAGE_KEYS.COURSE_REVIEWS, []);
  write(STORAGE_KEYS.COURSE_REVIEWS, [{ ...review, replies: review.replies || [] }, ...saved]);
  notifyCourseReviewsChange();
};

export const addCourseReviewReply = (reviewId, reply) => {
  const next = read(STORAGE_KEYS.COURSE_REVIEWS, []).map((review) =>
    review.id === reviewId
      ? { ...review, replies: [...(review.replies || []), reply] }
      : review,
  );
  write(STORAGE_KEYS.COURSE_REVIEWS, next);
  notifyCourseReviewsChange();
  return next.find((review) => review.id === reviewId);
};

export const toggleCourseReviewLike = (reviewId, userId, replyId = null) => {
  let updatedReview = null;
  const next = read(STORAGE_KEYS.COURSE_REVIEWS, []).map((review) => {
    if (review.id !== reviewId) return review;
    if (replyId) {
      const replies = (review.replies || []).map((reply) => {
        if (reply.id !== replyId) return reply;
        const likes = reply.likes || [];
        const nextReply = { ...reply, likes: likes.includes(userId) ? likes.filter((id) => id !== userId) : [...likes, userId] };
        updatedReview = { ...review, replies: (review.replies || []).map((item) => item.id === replyId ? nextReply : item) };
        return nextReply;
      });
      return { ...review, replies };
    }
    const likes = review.likes || [];
    updatedReview = { ...review, likes: likes.includes(userId) ? likes.filter((id) => id !== userId) : [...likes, userId] };
    return updatedReview;
  });
  write(STORAGE_KEYS.COURSE_REVIEWS, next);
  notifyCourseReviewsChange();
  return updatedReview;
};

export const updateCourseReview = (reviewId, updater) => {
  let updatedReview = null;
  const next = read(STORAGE_KEYS.COURSE_REVIEWS, []).map((review) => {
    if (review.id !== reviewId) return review;
    updatedReview = updater(review);
    return updatedReview;
  });
  write(STORAGE_KEYS.COURSE_REVIEWS, next);
  notifyCourseReviewsChange();
  return updatedReview;
};

export const deleteCourseReview = (reviewId) => {
  const next = read(STORAGE_KEYS.COURSE_REVIEWS, []).filter((review) => review.id !== reviewId);
  write(STORAGE_KEYS.COURSE_REVIEWS, next);
  notifyCourseReviewsChange();
  return next;
};

export const getCourseRating = (courseId) => {
  const reviews = getCourseReviews(courseId);
  const total = reviews.length;
  const average = total
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / total
    : 0;
  return { total, average };
};

export const getPosts = (authorId) => {
  const saved = read(STORAGE_KEYS.TEACHER_POSTS, []);
  const currentUser = read(STORAGE_KEYS.USER_INFO, null);
  const savedById = new Map(saved.map((post) => [post.id, post]));
  const sampleIds = new Set(fullCenterPosts.map((post) => post.id));
  const posts = [
    ...saved.filter((post) => !sampleIds.has(post.id)),
    ...fullCenterPosts.map((post) => savedById.get(post.id) || post),
  ].map(normalizePostMedia).map((post) => {
    if (!currentUser?.id || !hasProfileId(post, currentUser.id)) return post;
    const profileUpdates = {
      ...(currentUser.name ? { name: currentUser.name } : {}),
      ...(currentUser.avatar ? { avatar: currentUser.avatar } : {}),
    };
    const mediaItems = getPostMediaItems(post).map((item) => ({
      ...item,
      comments: synchronizeDiscussionAuthors(item.comments, currentUser.id, profileUpdates),
    }));
    return {
      ...post,
      ...(profileUpdates.name ? { authorName: profileUpdates.name, author: profileUpdates.name } : {}),
      ...(profileUpdates.avatar ? { authorAvatar: profileUpdates.avatar } : {}),
      comments: synchronizeDiscussionAuthors(post.comments, currentUser.id, profileUpdates),
      mediaItems,
      ...(post.media ? { media: mediaItems[0] || post.media } : {}),
    };
  });
  const videoKeys = new Set();
  const collectDiscussionVideoKeys = (items) => (items || []).forEach((item) => {
    collectStoredVideoKeys(item?.media, videoKeys);
    collectDiscussionVideoKeys(item?.replies);
  });
  posts.forEach((post) => {
    getPostMediaItems(post).forEach((media) => {
      collectStoredVideoKeys(media, videoKeys);
      collectDiscussionVideoKeys(media.comments);
    });
    collectDiscussionVideoKeys(post.comments);
  });
  queueVideoHydration(videoKeys, notifyPostsChange);
  if (authorId === undefined || authorId === null) return posts;

  const normalizedAuthorId = String(authorId);
  return posts.filter((post) => String(post.teacherId ?? '') === normalizedAuthorId || String(post.authorId ?? '') === normalizedAuthorId);
};

export const savePost = (post) => {
  const saved = read(STORAGE_KEYS.TEACHER_POSTS, []);
  const savedSuccessfully = write(STORAGE_KEYS.TEACHER_POSTS, [normalizePostMedia(post), ...saved]);
  if (savedSuccessfully) notifyPostsChange();
  return savedSuccessfully;
};

export const updatePost = (postId, updater) => {
  const saved = read(STORAGE_KEYS.TEACHER_POSTS, []);
  const existingIndex = saved.findIndex((post) => post.id === postId);
  const source = existingIndex >= 0
    ? saved[existingIndex]
    : fullCenterPosts.find((post) => post.id === postId);
  if (!source) return getPosts();
  const updated = normalizePostMedia(updater(normalizePostMedia(source)));
  const next = existingIndex >= 0
    ? saved.map((post, index) => index === existingIndex ? updated : post)
    : [updated, ...saved];
  write(STORAGE_KEYS.TEACHER_POSTS, next);
  notifyPostsChange();
  return getPosts();
};

export const updatePostMediaItem = (postId, mediaId, updater) => updatePost(postId, (post) => {
  const mediaItems = getPostMediaItems(post);
  const updatedItems = mediaItems.map((item) => item.id === mediaId ? updater(item) : item);
  return {
    ...post,
    mediaItems: updatedItems,
    media: post.media ? updatedItems[0] : undefined,
  };
});

const hasProfileId = (item, profileId) => String(item?.authorId ?? item?.teacherId ?? '') === String(profileId);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const synchronizeDiscussionAuthors = (items, profileId, updates) => (items || []).map((item) => {
  const matches = hasProfileId(item, profileId);
  return {
    ...item,
    ...(matches && hasOwn(updates, 'name') ? { authorName: updates.name, author: updates.name } : {}),
    ...(matches && hasOwn(updates, 'avatar') ? { authorAvatar: updates.avatar } : {}),
    replies: synchronizeDiscussionAuthors(item.replies, profileId, updates),
  };
});

// Posts persist a small author snapshot so old posts can still render offline.
// Refresh that snapshot whenever its owner changes name or avatar, including
// comments and replies, so the interface has one consistent identity.
export const syncPostAuthorProfile = (profileId, profileUpdates = {}) => {
  if (profileId == null || (!hasOwn(profileUpdates, 'name') && !hasOwn(profileUpdates, 'avatar'))) return getPosts();
  const saved = read(STORAGE_KEYS.TEACHER_POSTS, []);
  const next = saved.map((post) => {
    const ownsPost = hasProfileId(post, profileId);
    const mediaItems = getPostMediaItems(post).map((item) => ({
      ...item,
      comments: synchronizeDiscussionAuthors(item.comments, profileId, profileUpdates),
    }));
    const sharedPost = post.sharedPost && (hasProfileId(post.sharedPost, profileId) || String(post.sharedPost.author?.id ?? '') === String(profileId))
      ? {
          ...post.sharedPost,
          author: {
            ...(post.sharedPost.author || {}),
            id: post.sharedPost.author?.id || post.sharedPost.authorId || post.sharedPost.teacherId || profileId,
            ...(hasOwn(profileUpdates, 'name') ? { name: profileUpdates.name } : {}),
            ...(hasOwn(profileUpdates, 'avatar') ? { avatar: profileUpdates.avatar } : {}),
          },
        }
      : post.sharedPost;
    return {
      ...post,
      ...(ownsPost && hasOwn(profileUpdates, 'name') ? { authorName: profileUpdates.name, author: profileUpdates.name } : {}),
      ...(ownsPost && hasOwn(profileUpdates, 'avatar') ? { authorAvatar: profileUpdates.avatar } : {}),
      comments: synchronizeDiscussionAuthors(post.comments, profileId, profileUpdates),
      mediaItems,
      ...(post.media ? { media: mediaItems[0] || post.media } : {}),
      ...(sharedPost ? { sharedPost } : {}),
    };
  });
  const savedSuccessfully = write(STORAGE_KEYS.TEACHER_POSTS, next);
  if (savedSuccessfully) notifyPostsChange();
  return getPosts();
};

export const deletePost = (postId) => {
  const next = read(STORAGE_KEYS.TEACHER_POSTS, []).filter((post) => post.id !== postId);
  write(STORAGE_KEYS.TEACHER_POSTS, next);
  notifyPostsChange();
  return next;
};

const notifyNotificationChange = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('edumatch:notifications-updated'));
};

export const getNotifications = (recipientId) =>
  read(STORAGE_KEYS.NOTIFICATIONS, [])
    .filter((notification) => notification.recipientId === recipientId)
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));

export const createNotification = (notification) => {
  if (!notification.recipientId) return null;
  const nextNotification = {
    id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    isRead: false,
    createdAt: new Date().toISOString(),
    ...notification,
  };
  const saved = read(STORAGE_KEYS.NOTIFICATIONS, []);
  write(STORAGE_KEYS.NOTIFICATIONS, [nextNotification, ...saved]);
  notifyNotificationChange();
  return nextNotification;
};

export const markNotificationRead = (notificationId) => {
  const next = read(STORAGE_KEYS.NOTIFICATIONS, []).map((notification) =>
    notification.id === notificationId ? { ...notification, isRead: true } : notification
  );
  write(STORAGE_KEYS.NOTIFICATIONS, next);
  notifyNotificationChange();
  return next;
};

export const markAllNotificationsRead = (recipientId) => {
  const next = read(STORAGE_KEYS.NOTIFICATIONS, []).map((notification) =>
    notification.recipientId === recipientId ? { ...notification, isRead: true } : notification
  );
  write(STORAGE_KEYS.NOTIFICATIONS, next);
  notifyNotificationChange();
  return next;
};

export const getProviderAffinity = (userId) => {
  if (!userId) return {};
  return read(STORAGE_KEYS.FEED_AFFINITY, [])
    .filter((record) => record.userId === userId)
    .reduce((scores, record) => ({ ...scores, [record.providerId]: (scores[record.providerId] || 0) + Number(record.score || 0) }), {});
};

export const trackProviderAffinity = (userId, providerId, action, score = 1) => {
  if (!userId || !providerId || userId === providerId) return;
  const saved = read(STORAGE_KEYS.FEED_AFFINITY, []);
  const existingIndex = saved.findIndex((record) => record.userId === userId && record.providerId === providerId && record.action === action);
  const entry = { userId, providerId, action, score, updatedAt: new Date().toISOString() };
  const next = existingIndex === -1 ? [entry, ...saved] : saved.map((record, index) => index === existingIndex ? entry : record);
  write(STORAGE_KEYS.FEED_AFFINITY, next);
};

const trustRecords = () => read(STORAGE_KEYS.PROVIDER_TRUSTS, []);

export const getProviderTrustCount = (providerId, baseCount = 0) =>
  Number(baseCount || 0) + trustRecords().filter((record) => record.providerId === providerId).length;

export const getProviderTrustUserIds = (providerId) => [...new Set(
  trustRecords().filter((record) => record.providerId === providerId).map((record) => record.userId)
)];

export const hasProviderTrust = (userId, providerId) =>
  Boolean(userId && trustRecords().some((record) => record.userId === userId && record.providerId === providerId && record.source === 'profile'));

export const toggleProviderTrust = (userId, providerId) => {
  if (!userId || !providerId || userId === providerId) return false;
  const saved = trustRecords();
  const index = saved.findIndex((record) => record.userId === userId && record.providerId === providerId && record.source === 'profile');
  const next = index === -1
    ? [{ id: `trust-${Date.now()}`, userId, providerId, source: 'profile', createdAt: new Date().toISOString() }, ...saved]
    : saved.filter((_, recordIndex) => recordIndex !== index);
  write(STORAGE_KEYS.PROVIDER_TRUSTS, next);
  return index === -1;
};

export const addCourseRatingTrust = (userId, providerId, courseId) => {
  if (!userId || !providerId || !courseId || userId === providerId) return false;
  const source = `rating:${courseId}`;
  const saved = trustRecords();
  if (saved.some((record) => record.userId === userId && record.providerId === providerId && record.source === source)) return false;
  write(STORAGE_KEYS.PROVIDER_TRUSTS, [{ id: `trust-${Date.now()}`, userId, providerId, source, createdAt: new Date().toISOString() }, ...saved]);
  return true;
};

export const saveConversation = (conversation) => {
  const saved = read(STORAGE_KEYS.CONVERSATIONS, []);
  const recipientId = conversation.senderId === conversation.teacherId
    ? conversation.studentId
    : conversation.teacherId;
  write(STORAGE_KEYS.CONVERSATIONS, [{
    ...conversation,
    unreadFor: conversation.unreadFor || (recipientId ? [recipientId] : []),
    tags: conversation.tags || [],
  }, ...saved]);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('edumatch:conversations-updated'));
};

export const createConversationId = (prefix = 'message') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const getConversationsForUser = (userId) =>
  read(STORAGE_KEYS.CONVERSATIONS, []).filter(
    (message) => message.studentId === userId || message.teacherId === userId
  );

export const updateConversationThread = (thread, updater) => {
  const reference = thread.messages?.[0] || thread;
  const sameThread = (message) =>
    message.courseId === reference.courseId
    && message.studentId === reference.studentId
    && message.teacherId === reference.teacherId;
  const next = read(STORAGE_KEYS.CONVERSATIONS, []).map((message) =>
    sameThread(message) ? updater(message) : message
  );
  write(STORAGE_KEYS.CONVERSATIONS, next);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('edumatch:conversations-updated'));
  return next;
};

export const markConversationRead = (thread, userId) =>
  updateConversationThread(thread, (message) => ({
    ...message,
    unreadFor: (message.unreadFor || []).filter((id) => id !== userId),
  }));

export const markConversationUnread = (thread, userId) =>
  updateConversationThread(thread, (message) => ({
    ...message,
    unreadFor: Array.from(new Set([...(message.unreadFor || []), userId])),
  }));

export const setConversationTags = (thread, tags) =>
  updateConversationThread(thread, (message) => ({ ...message, tags }));

export const getMessageTags = (userId) =>
  read(STORAGE_KEYS.MESSAGE_TAGS, []).filter((tag) => tag.userId === userId);

export const saveMessageTag = (userId, tag) => {
  if (!userId || !tag?.id || !tag?.name) return getMessageTags(userId);
  const saved = read(STORAGE_KEYS.MESSAGE_TAGS, []);
  const existing = saved.find((item) => item.userId === userId && item.id === tag.id);
  const nextTag = { ...tag, userId };
  const next = existing
    ? saved.map((item) => item.userId === userId && item.id === tag.id ? { ...item, ...nextTag } : item)
    : [...saved, nextTag];
  write(STORAGE_KEYS.MESSAGE_TAGS, next);
  return next.filter((item) => item.userId === userId);
};

export const deleteMessageTag = (userId, tagId) => {
  const next = read(STORAGE_KEYS.MESSAGE_TAGS, []).filter(
    (tag) => tag.userId !== userId || tag.id !== tagId
  );
  write(STORAGE_KEYS.MESSAGE_TAGS, next);
  return next.filter((tag) => tag.userId === userId);
};

export const getMessageTemplates = (userId) =>
  read(STORAGE_KEYS.MESSAGE_TEMPLATES, []).filter((template) => template.userId === userId);

export const saveMessageTemplate = (userId, template) => {
  if (!userId || !template?.id || !template?.title || !template?.text) return getMessageTemplates(userId);
  const saved = read(STORAGE_KEYS.MESSAGE_TEMPLATES, []);
  const nextTemplate = { ...template, userId, updatedAt: new Date().toISOString() };
  const exists = saved.some((item) => item.userId === userId && item.id === template.id);
  const next = exists
    ? saved.map((item) => item.userId === userId && item.id === template.id ? { ...item, ...nextTemplate } : item)
    : [{ ...nextTemplate, createdAt: nextTemplate.createdAt || nextTemplate.updatedAt }, ...saved];
  write(STORAGE_KEYS.MESSAGE_TEMPLATES, next);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('edumatch:message-templates-updated'));
  return next.filter((item) => item.userId === userId);
};

export const deleteMessageTemplate = (userId, templateId) => {
  const next = read(STORAGE_KEYS.MESSAGE_TEMPLATES, []).filter(
    (template) => template.userId !== userId || template.id !== templateId
  );
  write(STORAGE_KEYS.MESSAGE_TEMPLATES, next);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('edumatch:message-templates-updated'));
  return next.filter((template) => template.userId === userId);
};

export const removeMessageTagFromUserConversations = (userId, tagId) => {
  const next = read(STORAGE_KEYS.CONVERSATIONS, []).map((message) => {
    if (message.studentId !== userId && message.teacherId !== userId) return message;
    return { ...message, tags: (message.tags || []).filter((tag) => (typeof tag === 'string' ? tag.toLowerCase() : tag.id) !== tagId) };
  });
  write(STORAGE_KEYS.CONVERSATIONS, next);
  return next.filter((message) => message.studentId === userId || message.teacherId === userId);
};

export const getAge = (dob) => {
  if (!dob) return '—';
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return '—';
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age -= 1;
  return age;
};

export const paymentLabel = (type) => ({
  'full-course': 'Trọn khóa',
  monthly: 'Theo tháng',
  session: 'Theo buổi',
}[type] || 'Linh hoạt');

export const modeLabel = (course) => {
  if (course.learningMode === 'online') return 'Trực tuyến';
  if (course.learningMode === 'recorded') return 'Video quay sẵn';
  return course.inPersonType === 'home' ? 'Dạy tại nhà' : 'Dạy tại lớp';
};

export const enrollmentLabel = (course) =>
  course.enrollmentStatus === 'closed' ? 'Đã đóng lớp' : 'Mở lớp';
