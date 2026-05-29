/**
 * Anonymous collaboration identity.
 *
 * No auth exists in the app, so each collaborator is identified by:
 * - `sessionId`: unique per browser tab (in-memory, not persisted) so two tabs
 *   from the same person are distinct cursors.
 * - `name` / `color`: generated once and cached in localStorage, so a refresh
 *   keeps the same friendly identity.
 */

export interface CollabIdentity {
  sessionId: string;
  name: string;
  color: string;
}

const STORAGE_KEY = "ffxiv-collab-identity";

// Distinct, legible hues that read well on both light and dark backgrounds.
const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

// FFXIV bestiary creatures — friendly, recognizable monster names.
const CREATURES = [
  "Chocobo", "Moogle", "Tonberry", "Coeurl", "Cactuar", "Mandragora", "Bomb",
  "Goobbue", "Ahriman", "Morbol", "Behemoth", "Apkallu", "Spriggan", "Namazu",
  "Dodo", "Amaro", "Adamantoise", "Zu", "Atomos", "Otter", "Carbuncle",
  "Sahagin", "Ochu", "Flan",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let cached: CollabIdentity | null = null;

/** Returns the stable name/color for this browser plus a fresh per-tab sessionId. */
export function getCollabIdentity(): CollabIdentity {
  if (cached) return cached;

  let name: string | undefined;
  let color: string | undefined;

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { name?: string; color?: string };
        name = parsed.name;
        color = parsed.color;
      }
    } catch {
      /* ignore malformed storage */
    }
  }

  if (!name || !color) {
    name = `Anonymous ${randomItem(CREATURES)}`;
    color = randomItem(COLORS);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, color }));
      } catch {
        /* ignore quota / disabled storage */
      }
    }
  }

  cached = { sessionId: crypto.randomUUID(), name, color };
  return cached;
}
