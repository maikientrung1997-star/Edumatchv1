import axios from 'axios';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { storage } from '@/utils/storage';

const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000/api';

/**
 * Main Axios instance for API communication
 */
export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
});

/**
 * Request Interceptor:
 * Tự động đính kèm Bearer token vào Header nếu token tồn tại trong localStorage
 */
api.interceptors.request.use(
  (config) => {
    const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor:
 * Xử lý kết quả trả về và xử lý lỗi tập trung (401, 403, 500)
 */
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      const { status } = error.response;

      // 401: Unauthorized - Token hết hạn hoặc không hợp lệ
      const isSignIn = /\/auth\/(login|register|google)(?:\/challenge)?$/.test(error.config?.url || '');
      const currentToken = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
      const isCurrentSession = currentToken && error.config?.headers?.Authorization === `Bearer ${currentToken}`;
      if (status === 401 && !isSignIn && isCurrentSession) {
        storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
        storage.remove(STORAGE_KEYS.USER_INFO);
        window.dispatchEvent(new Event('auth:expired'));
        // Không redirect cưỡng chế trực tiếp ở đây để tránh navigation loop
      }

      // 403: Forbidden - Không có quyền truy cập
      if (status === 403) {
        console.warn('Truy cập bị từ chối (403 Forbidden).');
      }

      // 500: Server Error - Lỗi máy chủ nội bộ
      if (status >= 500) {
        console.error('Lỗi hệ thống máy chủ (500 Server Error).');
      }
    } else {
      console.error('Không thể kết nối đến máy chủ mạng hoặc timeout.');
    }

    return Promise.reject(error);
  }
);

export default api;
