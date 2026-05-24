const STORAGE_KEY = "ffxiv-raidwide-favorites";

export interface FavoriteEntry {
  viewLinkId: string;
  title: string;
  encounterId: string | null;
  savedAt: number;
}

const EMPTY: FavoriteEntry[] = [];
let cachedRaw: string | null = null;
let cachedFavorites: FavoriteEntry[] = EMPTY;

export function getFavorites(): FavoriteEntry[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedFavorites;
    cachedRaw = raw;
    cachedFavorites = raw ? (JSON.parse(raw) as FavoriteEntry[]) : EMPTY;
    return cachedFavorites;
  } catch {
    return EMPTY;
  }
}

const FAVORITES_EVENT = "ffxiv-favorites-updated";

function dispatch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FAVORITES_EVENT));
  }
}

export function subscribeToFavorites(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(FAVORITES_EVENT, callback);
  return () => window.removeEventListener(FAVORITES_EVENT, callback);
}

export function isFavorite(viewLinkId: string): boolean {
  return getFavorites().some((f) => f.viewLinkId === viewLinkId);
}

export function addFavorite(entry: FavoriteEntry): void {
  if (typeof window === "undefined") return;
  const favorites = getFavorites().filter((f) => f.viewLinkId !== entry.viewLinkId);
  favorites.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  dispatch();
}

export function removeFavorite(viewLinkId: string): void {
  if (typeof window === "undefined") return;
  const favorites = getFavorites().filter((f) => f.viewLinkId !== viewLinkId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  dispatch();
}
