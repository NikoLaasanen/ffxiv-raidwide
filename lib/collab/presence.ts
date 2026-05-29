/**
 * Ephemeral collaboration presence over Firebase Realtime Database.
 *
 * RTDB is used (instead of Firestore) because cursor updates are high-frequency
 * and RTDB is billed by bandwidth, not per-write — and it offers `onDisconnect`
 * for automatic cleanup when a tab closes.
 *
 * Tree: `presence/{editLinkId}/{sessionId}` -> PresenceNode
 */
import { onValue, onDisconnect, ref, remove, set, update } from "firebase/database";
import { getRtdb } from "@/lib/firebase";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { CollabIdentity } from "@/lib/collab/identity";

/** A peer's live cursor state, as stored in RTDB. */
export interface PresenceNode {
  sessionId: string;
  name: string;
  color: string;
  hoverTimestamp: number | null;
  hoverJob: JobAbbreviation | null;
  updatedAt: number;
}

/** A peer = a PresenceNode that isn't the local session. */
export type Peer = PresenceNode;

/** Partial cursor update emitted as the local user hovers cells. */
export type CursorUpdate = {
  hoverTimestamp: number | null;
  hoverJob: JobAbbreviation | null;
};

// Presence nodes older than this are treated as gone (guards against a missed
// onDisconnect, e.g. a hard crash or lost connection).
const STALE_MS = 30_000;

// Throttle cursor writes; RTDB cost is bandwidth but there's no need to spam.
const THROTTLE_MS = 50;

export interface PresenceHandle {
  /** Update this session's cursor (throttled). */
  updateCursor: (cursor: CursorUpdate) => void;
  /** Remove the presence node and detach listeners. */
  leave: () => void;
}

/**
 * Register this session in the presence tree with auto-cleanup on disconnect.
 * Returns a no-op handle when RTDB isn't configured.
 */
export function joinPresence(editLinkId: string, identity: CollabIdentity): PresenceHandle {
  const rtdb = getRtdb();
  if (!rtdb) {
    return { updateCursor: () => {}, leave: () => {} };
  }

  const nodeRef = ref(rtdb, `presence/${editLinkId}/${identity.sessionId}`);

  const initial: PresenceNode = {
    sessionId: identity.sessionId,
    name: identity.name,
    color: identity.color,
    hoverTimestamp: null,
    hoverJob: null,
    updatedAt: Date.now(),
  };
  void set(nodeRef, initial);
  void onDisconnect(nodeRef).remove();

  let pending: CursorUpdate | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (!pending) return;
    const next = pending;
    pending = null;
    void update(nodeRef, { ...next, updatedAt: Date.now() });
  };

  const updateCursor = (cursor: CursorUpdate) => {
    pending = cursor;
    if (timer === null) {
      timer = setTimeout(flush, THROTTLE_MS);
    }
  };

  const leave = () => {
    if (timer !== null) clearTimeout(timer);
    void remove(nodeRef);
  };

  return { updateCursor, leave };
}

/**
 * Subscribe to peers on an edit link. The callback receives everyone present
 * except `ownSessionId`, with stale nodes filtered out. Returns an unsubscribe.
 */
export function subscribePresence(
  editLinkId: string,
  ownSessionId: string,
  cb: (peers: Peer[]) => void,
): () => void {
  const rtdb = getRtdb();
  if (!rtdb) return () => {};

  const roomRef = ref(rtdb, `presence/${editLinkId}`);
  return onValue(roomRef, (snap) => {
    const val = (snap.val() ?? {}) as Record<string, PresenceNode>;
    const now = Date.now();
    const peers = Object.values(val).filter(
      (p) => p.sessionId !== ownSessionId && now - p.updatedAt < STALE_MS,
    );
    cb(peers);
  });
}
