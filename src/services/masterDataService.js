import { sharedGet } from './sharedGet';

const MASTER_DATA_TTL = 5 * 60 * 1000; // 5 phút cache in-memory cho danh mục tĩnh

export const masterDataService = {
  subjects: async () => (await sharedGet('/subjects', {}, { ttlMs: MASTER_DATA_TTL })).data,
  levels: async () => (await sharedGet('/education-levels', {}, { ttlMs: MASTER_DATA_TTL })).data,
  banners: async () => (await sharedGet('/banners', {}, { ttlMs: MASTER_DATA_TTL })).data,
  provinces: async () => (await sharedGet('/administrative-areas/provinces', {}, { ttlMs: MASTER_DATA_TTL })).data,
  districts: async (id) => (await sharedGet(`/administrative-areas/districts/${id}`, {}, { ttlMs: MASTER_DATA_TTL })).data,
  wards: async (id) => (await sharedGet(`/administrative-areas/wards/${id}`, {}, { ttlMs: MASTER_DATA_TTL })).data,
  // Mọi giáo viên / trung tâm đang hoạt động (kể cả chưa đăng khóa học) để tìm hồ sơ theo tên
  providers: async () => (await sharedGet('/providers', {}, { ttlMs: 60 * 1000 })).data || [],
  provider: async (id) => {
    const res = await sharedGet(`/providers/${id}`);
    return res?.data !== undefined ? res.data : res;
  },
};
