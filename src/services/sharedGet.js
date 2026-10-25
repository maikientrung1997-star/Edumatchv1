import api from './api';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { storage } from '@/utils/storage';

const pendingReads = new Map();
const cacheReads = new Map();

// Share only pending GETs with the same session, URL and query parameters.
// If ttlMs is provided (> 0), the settled response is cached in memory for that duration.
export function sharedGet(url, params = {}, { ttlMs = 0 } = {}) {
  const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
  const query = Object.entries(params).sort(([left], [right]) => left.localeCompare(right));
  const key = JSON.stringify([token, url, query]);

  if (ttlMs > 0 && cacheReads.has(key)) {
    const cached = cacheReads.get(key);
    if (Date.now() < cached.expiresAt) {
      return Promise.resolve(cached.data);
    }
    cacheReads.delete(key);
  }

  if (!pendingReads.has(key)) {
    const request = api
      .get(url, { params, headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => {
        if (ttlMs > 0) {
          cacheReads.set(key, { data: response, expiresAt: Date.now() + ttlMs });
        }
        return response;
      })
      .finally(() => {
        pendingReads.delete(key);
      });
    pendingReads.set(key, request);
  }

  return pendingReads.get(key);
}
