import api from './api';
import { sharedGet } from './sharedGet';

async function catalogPages(path, params = {}, isActive = () => true) {
  const records = new Map();
  for (let page = 1; isActive(); page += 1) {
    const result = await sharedGet(path, { ...params, page, per_page: 100 });
    result.data.forEach((record) => records.set(record.id, record));
    if (page >= result.last_page) break;
  }
  return [...records.values()];
}

export function courseError(error, fallback = 'Không thể kết nối dịch vụ khóa học. Vui lòng thử lại.') {
  const body = error.response?.data;
  return Object.values(body?.errors || {}).flat()[0] || body?.message || fallback;
}

async function sendReview(path, data, editing = false) {
  const { media, ...fields } = data;
  if (!media || !/^(blob:|data:)/i.test(media.src || '')) {
    return editing
      ? api.put(path, { ...fields, removeMedia: !media })
      : api.post(path, fields);
  }
  const response = await fetch(media.src);
  if (!response.ok) throw new Error('Không thể đọc ảnh đã chọn.');
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => body.append(key, typeof value === 'boolean' ? Number(value) : value));
  body.append('media', await response.blob(), media.name || 'anh-danh-gia.jpg');
  if (editing) body.append('_method', 'PUT');
  return api.post(path, body, { headers: { 'Content-Type': 'multipart/form-data' } });
}

export const courseService = {
  list: (params, isActive) => catalogPages('/courses', params, isActive),
  show: async (id) => (await sharedGet(`/courses/${id}`)).data,
  create: async (course) => (await api.post('/courses', course)).data,
  update: async (id, course) => (await api.put(`/courses/${id}`, course)).data,
  updateEnrollmentStatus: async (id, enrollmentStatus) => (
    await api.patch(`/courses/${id}/enrollment-status`, { enrollmentStatus })
  ).data,
  enroll: async (id, message) => (await api.post(`/courses/${id}/enroll`, { message })).data,
  consult: (data) => api.post('/consultations', data),
  reviews: async (id) => (await sharedGet(`/courses/${id}/reviews`)).data,
  addReview: (id, data) => sendReview(`/courses/${id}/reviews`, data),
  addReply: (id, data) => sendReview(`/reviews/${id}/replies`, data),
  editReview: (path, data) => sendReview(path, data, true),
  removeReview: (path) => api.delete(path),
  likeReview: (path, liked) => api.post(`${path}/like`, { liked }),
};

export const providerService = {
  list: (isActive) => catalogPages('/providers', {}, isActive),
  show: async (id) => (await sharedGet(`/providers/${id}`)).data,
  trust: async (id, trusted) => (await api.post(`/providers/${id}/trust`, { trusted })).data,
  trustUsers: (id) => catalogPages(`/providers/${id}/trust-users`),
};

