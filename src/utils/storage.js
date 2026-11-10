/**
 * Safe LocalStorage wrapper utility
 */
const overflowKey = (key) => `edumatch:overflow:${key}`;
const getSessionStorage = () => (typeof window !== 'undefined' ? window.sessionStorage : null);
const memoryOverflow = new Map();
const parsedCache = new Map();

const parseStoredValue = (item, key) => {
  const cached = parsedCache.get(key);
  if (cached && cached.raw === item) {
    return cached.value;
  }
  try {
    const parsed = JSON.parse(item);
    parsedCache.set(key, { raw: item, value: parsed });
    return parsed;
  } catch (error) {
    console.error(`Error reading key "${key}" from browser storage:`, error);
    return null;
  }
};

export const storage = {
  get: (key, defaultValue = null) => {
    try {
      if (memoryOverflow.has(key)) return memoryOverflow.get(key) ?? defaultValue;
      const overflow = getSessionStorage()?.getItem(overflowKey(key));
      if (overflow != null) return parseStoredValue(overflow, key) ?? defaultValue;
      const item = window.localStorage.getItem(key);
      return item !== null ? parseStoredValue(item, key) ?? defaultValue : defaultValue;
    } catch (error) {
      console.error(`Error reading key "${key}" from localStorage:`, error);
      return defaultValue;
    }
  },

  set: (key, value) => {
    const serialized = JSON.stringify(value);
    parsedCache.set(key, { raw: serialized, value });
    try {
      window.localStorage.setItem(key, serialized);
      getSessionStorage()?.removeItem(overflowKey(key));
      memoryOverflow.delete(key);
      return true;
    } catch (error) {
      try {
        const sessionStorage = getSessionStorage();
        if (!sessionStorage) throw error;
        sessionStorage.setItem(overflowKey(key), serialized);
        memoryOverflow.delete(key);
        console.warn(`LocalStorage is full for key "${key}"; using this browser session instead.`, error);
        return true;
      } catch (overflowError) {
        memoryOverflow.set(key, value);
        console.warn(`Browser storage is full for key "${key}"; using in-memory session storage.`, overflowError);
        return true;
      }
    }
  },

  remove: (key) => {
    try {
      parsedCache.delete(key);
      memoryOverflow.delete(key);
      window.localStorage.removeItem(key);
      getSessionStorage()?.removeItem(overflowKey(key));
    } catch (error) {
      console.error(`Error removing key "${key}" from localStorage:`, error);
    }
  },

  clear: () => {
    try {
      parsedCache.clear();
      memoryOverflow.clear();
      window.localStorage.clear();
      getSessionStorage()?.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  },
};

export default storage;
