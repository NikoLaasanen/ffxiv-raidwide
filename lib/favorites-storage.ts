import { createLocalStorage } from "@/lib/local-storage";

export interface FavoriteEntry {
  viewLinkId: string;
  title: string;
  encounterId: string | null;
  savedAt: number;
}

const store = createLocalStorage<FavoriteEntry>("ffxiv-raidwide-favorites", "ffxiv-favorites-updated");

export const getFavorites = () => store.get();
export const getFavoritesServerSnapshot = () => store.getServerSnapshot();
export const subscribeToFavorites = (cb: () => void) => store.subscribe(cb);
export const isFavorite = (viewLinkId: string) => store.get().some((f) => f.viewLinkId === viewLinkId);
export const addFavorite = (entry: FavoriteEntry) => store.upsert(entry, (e) => e.viewLinkId);
export const removeFavorite = (viewLinkId: string) => store.remove(viewLinkId, (e) => e.viewLinkId);
