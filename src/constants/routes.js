const postDetailPath = (postId = ':postId') => `/bai-viet/${postId}`;
export const POST_COMMENTS_ANCHOR = 'binh-luan';

/**
 * Application route constants
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  PROFILE: '/profile',
  VERIFICATION: '/xac-minh',
  REGISTER: '/register',
  STUDENT_WELCOME: '/chao-mung-hoc-vien',
  PARTNER_TERMS: '/dieu-khoan-giao-vien-doi-tac',
  CENTER_SUPPORT: '/ho-tro-trung-tam-dao-tao',
  CONTACT: '/lien-he',
  FEED: '/bang-tin',
  POST_DETAIL: postDetailPath,
  POST_COMMENTS: (postId) => `${postDetailPath(postId)}#${POST_COMMENTS_ANCHOR}`,
  SEARCH_RESULTS: '/tim-kiem',
  MESSAGES: '/tin-nhan',
  CREATE_COURSE: '/khoa-hoc/them-moi',
  COURSE_DETAIL: (courseId = ':courseId') => `/khoa-hoc/${courseId}`,
  TEACHER_PROFILE: (teacherId = ':teacherId') => `/giao-vien/${teacherId}`,
  DASHBOARD: '/dashboard',
  FORBIDDEN: '/403',
  NOT_FOUND: '*',
};
