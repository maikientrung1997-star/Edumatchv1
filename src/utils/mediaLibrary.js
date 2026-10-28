const DATABASE_NAME = 'edumatch-media-library';
const STORE_NAME = 'videos';
const mediaUrls = new Map();
const pendingReads = new Map();
let databasePromise;

const supportsIndexedDb = () => typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const openDatabase = () => {
  if (!supportsIndexedDb()) return Promise.reject(new Error('IndexedDB is unavailable.'));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không thể mở thư viện tệp.'));
  });
  return databasePromise;
};

const completeRequest = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Không thể lưu tệp.'));
});

const completeTransaction = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onabort = () => reject(transaction.error || new Error('Không đủ dung lượng để lưu video.'));
  transaction.onerror = () => reject(transaction.error || new Error('Không thể lưu video.'));
});

const createKey = (file, kind = 'media') => `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${file.size}`;

export const saveMedia = async (file, kind = 'media') => {
  const id = createKey(file, kind);
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).put({ id, file, type: file.type, name: file.name || `${kind}-attachment`, createdAt: Date.now() });
  await completeTransaction(transaction);
  const src = URL.createObjectURL(file);
  mediaUrls.set(id, src);
  return { storageKey: id, src };
};

export const saveVideoMedia = (file) => saveMedia(file, 'video');
export const saveImageMedia = (file) => saveMedia(file, 'image');

// Blob URLs are only valid for the browser session that created them. After a
// refresh they must be rebuilt from IndexedDB, rather than reused from storage.
export const getMediaUrl = (storageKey, fallback = '') =>
  mediaUrls.get(storageKey) || (String(fallback).startsWith('blob:') ? '' : fallback);

export const getVideoMediaUrl = getMediaUrl;

export const hydrateMedia = async (storageKey) => {
  if (!storageKey || !supportsIndexedDb()) return { src: '', hydrated: false };
  if (mediaUrls.has(storageKey)) return { src: mediaUrls.get(storageKey), hydrated: false };
  if (pendingReads.has(storageKey)) return pendingReads.get(storageKey);

  const task = (async () => {
    const database = await openDatabase();
    const record = await completeRequest(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(storageKey));
    if (!record?.file) return { src: '', hydrated: false };
    const src = URL.createObjectURL(record.file);
    mediaUrls.set(storageKey, src);
    return { src, hydrated: true };
  })().finally(() => pendingReads.delete(storageKey));
  pendingReads.set(storageKey, task);
  return task;
};

export const hydrateVideoMedia = hydrateMedia;
