import { STORAGE_KEYS } from '@/constants/storageKeys';
import { storage } from '@/utils/storage';

export const normalizeProfileAlbums = (value) => (Array.isArray(value) ? value : []).map((album, index) => ({
  id: String(album?.id || `album-${index}`),
  name: String(album?.name || album?.title || 'Album ảnh').trim() || 'Album ảnh',
  description: String(album?.description || '').trim(),
  media: (Array.isArray(album?.media) ? album.media : Array.isArray(album?.images) ? album.images : []).map((item, mediaIndex) => ({
    id: String(item?.id || `media-${mediaIndex}`),
    src: typeof item === 'string' ? item : item?.src || '',
    storageKey: typeof item === 'object' ? item?.storageKey || '' : '',
    type: typeof item === 'object' && item?.type === 'video' ? 'video' : 'image',
    description: typeof item === 'object' ? String(item?.description || item?.caption || '').trim() : '',
  })).filter((item) => item.src || item.storageKey),
  createdAt: album?.createdAt || album?.created_at || '',
})).filter((album) => album.name);

export const readProfileAlbums = (profileId, fallback = []) => {
  const storedAlbums = storage.get(STORAGE_KEYS.PROFILE_ALBUMS, {})?.[String(profileId)] || [];
  return normalizeProfileAlbums(storedAlbums.length ? storedAlbums : fallback);
};

export const saveProfileAlbumsToStorage = (profileId, albums) => {
  if (profileId == null) return [];
  const normalizedAlbums = normalizeProfileAlbums(albums);
  const albumsByProfile = storage.get(STORAGE_KEYS.PROFILE_ALBUMS, {});
  storage.set(STORAGE_KEYS.PROFILE_ALBUMS, {
    ...albumsByProfile,
    [String(profileId)]: normalizedAlbums,
  });
  return normalizedAlbums;
};

export const addMediaToProfileAlbum = (albums, albumId, media) => normalizeProfileAlbums(albums).map((album) => album.id !== albumId ? album : {
  ...album,
  media: [...album.media, ...media.map((item) => ({ ...item, description: item.description || '' }))],
});
