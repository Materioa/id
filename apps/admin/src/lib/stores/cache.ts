export const cache = new Map<string, any>();

export const pageCache = {
  get: <T>(key: string): T | null => {
    return cache.get(key) || null;
  },
  set: <T>(key: string, data: T) => {
    cache.set(key, data);
  },
  clear: () => {
    cache.clear();
  }
};
