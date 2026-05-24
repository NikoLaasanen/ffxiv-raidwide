const STORAGE_KEY = "ffxiv-raidwide-my-plans";
const MAX_ENTRIES = 50;

export interface MyPlanEntry {
  id: string;
  title: string;
  editLinkId: string;
  viewLinkId: string;
  encounterId: string | null;
  updatedAt: number;
  savedAt: number;
}

const EMPTY: MyPlanEntry[] = [];
let cachedRaw: string | null = null;
let cachedPlans: MyPlanEntry[] = EMPTY;

export function getMyPlans(): MyPlanEntry[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedPlans;
    cachedRaw = raw;
    cachedPlans = raw ? (JSON.parse(raw) as MyPlanEntry[]) : EMPTY;
    return cachedPlans;
  } catch {
    return EMPTY;
  }
}

const MY_PLANS_EVENT = "ffxiv-my-plans-updated";

function dispatch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MY_PLANS_EVENT));
  }
}

export function subscribeToMyPlans(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(MY_PLANS_EVENT, callback);
  return () => window.removeEventListener(MY_PLANS_EVENT, callback);
}

export function upsertMyPlan(entry: MyPlanEntry): void {
  if (typeof window === "undefined") return;
  const plans = getMyPlans().filter((p) => p.id !== entry.id);
  plans.unshift(entry);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(plans.slice(0, MAX_ENTRIES))
  );
  dispatch();
}

export function removeMyPlan(id: string): void {
  if (typeof window === "undefined") return;
  const plans = getMyPlans().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  dispatch();
}
