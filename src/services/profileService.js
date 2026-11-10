import api from './api';
import { sharedGet } from './sharedGet';
import { normalizeAuthUser } from './authService';

const withUser = (response) => {
  const userPayload = response?.user || response?.data?.user || (response?.data?.id ? response.data : null);
  return { ...response, user: userPayload ? normalizeAuthUser(userPayload) : response?.user };
};

export const profileService = {
  async get() {
    return withUser(await sharedGet('/profile'));
  },
  async update(data) {
    return withUser(await api.put('/profile', data));
  },
  async uploadAvatar(file) {
    const data = new FormData();
    data.append('avatar', file);
    return withUser(
      await api.post('/profile/avatar', data, {
        // Remove the API's default JSON header. The browser then supplies the
        // multipart boundary required by the uploaded image.
        transformRequest: [(payload, headers) => {
          if (typeof headers?.setContentType === 'function') {
            headers.setContentType(undefined);
          } else if (headers) {
            delete headers['Content-Type'];
            delete headers['content-type'];
          }
          return payload;
        }],
      })
    );
  },
  async uploadCover(file) {
    const data = new FormData();
    data.append('cover_image', file);
    return withUser(
      await api.post('/profile/cover', data, {
        transformRequest: [(payload, headers) => {
          if (typeof headers?.setContentType === 'function') headers.setContentType(undefined);
          else if (headers) {
            delete headers['Content-Type'];
            delete headers['content-type'];
          }
          return payload;
        }],
      })
    );
  },
  async areas(params) {
    const response = await sharedGet('/administrative-areas', params);
    return response.data;
  },
};
