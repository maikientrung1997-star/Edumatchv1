/**
 * Safe LocalStorage wrapper utility
 */
const overflowKey = (key) => `edumatch:overflow:${key}`;
const getSessionStorage = () => (typeof window !== 'undefined' ? window.sessionStorage : null);

const parseStoredValue = (item, key) => {
  try {
    return JSON.parse(item);
  } catch (error) {
    console.error(`Error reading key "${key}" from browser storage:`, error);
    return null;
  }
};

export const storage = {
  get: (key, defaultValue = null) => {
    try {
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
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      getSessionStorage()?.removeItem(overflowKey(key));
      return true;
    } catch (error) {
      try {
        const sessionStorage = getSessionStorage();
        if (!sessionStorage) throw error;
        sessionStorage.setItem(overflowKey(key), JSON.stringify(value));
        console.warn(`LocalStorage is full for key "${key}"; using this browser session instead.`, error);
        return true;
      } catch (overflowError) {
        console.error(`Error setting key "${key}" in browser storage:`, overflowError);
        return false;
      }
    }
  },

  remove: (key) => {
    try {
      window.localStorage.removeItem(key);
      getSessionStorage()?.removeItem(overflowKey(key));
    } catch (error) {
      console.error(`Error removing key "${key}" from localStorage:`, error);
    }
  },

  clear: () => {
    try {
      window.localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  },
};

export default storage;
