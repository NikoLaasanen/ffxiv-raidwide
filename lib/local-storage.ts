export interface LocalStorage<T> {
  get(): T[];
  subscribe(callback: () => void): () => void;
  upsert(item: T, key: (item: T) => string): void;
  remove(key: string, itemKey: (item: T) => string): void;
}

export function createLocalStorage<T>(storageKey: string, eventName: string, maxEntries = Infinity): LocalStorage<T> {
  const EMPTY: T[] = [];
  let cachedRaw: string | null = null;
  let cached: T[] = EMPTY;

  function dispatch() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(eventName));
    }
  }

  return {
    get(): T[] {
      if (typeof window === "undefined") return EMPTY;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw === cachedRaw) return cached;
        cachedRaw = raw;
        cached = raw ? (JSON.parse(raw) as T[]) : EMPTY;
        return cached;
      } catch {
        return EMPTY;
      }
    },

    subscribe(callback: () => void): () => void {
      if (typeof window === "undefined") return () => {};
      window.addEventListener(eventName, callback);
      return () => window.removeEventListener(eventName, callback);
    },

    upsert(item: T, key: (item: T) => string): void {
      if (typeof window === "undefined") return;
      const id = key(item);
      const items = this.get().filter((i) => key(i) !== id);
      items.unshift(item);
      localStorage.setItem(storageKey, JSON.stringify(items.slice(0, maxEntries)));
      dispatch();
    },

    remove(id: string, itemKey: (item: T) => string): void {
      if (typeof window === "undefined") return;
      const items = this.get().filter((i) => itemKey(i) !== id);
      localStorage.setItem(storageKey, JSON.stringify(items));
      dispatch();
    },
  };
}
