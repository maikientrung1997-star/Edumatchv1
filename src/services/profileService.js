import api from './api';
import { sharedGet } from './sharedGet';
import { normalizeAuthUser } from './authService';
import { hydrateMedia } from '@/utils/mediaLibrary';

async function galleryKey(media) {
  if (media.key) return media.key;
  const existing = /\/media\/profiles\/\d+\/([^/?#]+)(?:[?#]|$)/.exec(media.src || '');
  if (existing) return existing[1];
  const source = media.storageKey ? ((await hydrateMedia(media.storageKey)).src || media.src) : media.src;
  if (!/^(data:|blob:)/.test(source || '')) throw new Error('Tệp hồ sơ chưa sẵn sàng. Vui lòng chọn lại tệp.');
  const response = await fetch(source);
  if (!response.ok) throw new Error('Không thể đọc tệp hồ sơ.');
  const data = new FormData();
  data.append('media', await response.blob(), media.name || 'tep-ho-so');
  return (await api.post('/profile/media', data, { headers: { 'Content-Type': 'multipart/form-data' } })).data.key;
}

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
  async savePortfolio(detailedProfile, images) {
    const keys = [];
    for (const src of images) keys.push(await galleryKey({ src }));
    return profileService.update({ detailed_profile: detailedProfile, profile_portfolio_images: keys });
  },
  async saveAlbums(albums) {
    const normalized = [];
    for (const album of albums) {
      const media = [];
      for (const item of album.media) {
        media.push({
          id: item.id, key: await galleryKey(item), type: item.type,
          description: item.description || null, createdAt: item.createdAt || null,
        });
      }
      normalized.push({ id: album.id, name: album.name, description: album.description || null, createdAt: album.createdAt || null, media });
    }
    return profileService.update({ photo_albums: normalized });
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
