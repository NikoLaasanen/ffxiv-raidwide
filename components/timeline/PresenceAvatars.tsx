"use client";

import { cn } from "@/lib/utils";
import type { Peer } from "@/lib/collab/presence";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function Avatar({ peer, className }: { peer: Peer; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white dark:ring-slate-950",
        className,
      )}
      style={{ backgroundColor: peer.color }}
      title={peer.name}
    >
      {initials(peer.name)}
    </span>
  );
}

/** Overlapping avatar stack for the timeline header — shows who's editing. */
export function PresenceStack({ peers, max = 4 }: { peers: Peer[]; max?: number }) {
  if (peers.length === 0) return null;
  const shown = peers.slice(0, max);
  const overflow = peers.length - shown.length;
  return (
    <div className="flex items-center gap-1.5" aria-label={`${peers.length} other ${peers.length === 1 ? "person" : "people"} editing`}>
      <div className="flex -space-x-2">
        {shown.map((p) => (
          <Avatar key={p.sessionId} peer={p} />
        ))}
        {overflow > 0 && (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-400 text-[10px] font-semibold text-white ring-2 ring-white dark:bg-slate-600 dark:ring-slate-950">
            +{overflow}
          </span>
        )}
      </div>
      <span className="hidden text-xs text-zinc-500 dark:text-slate-400 sm:inline">editing</span>
    </div>
  );
}

/** Shows the local user how they appear to everyone else (name + color). */
export function SelfBadge({ identity }: { identity: { name: string; color: string } }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:border-slate-700 dark:text-slate-300"
      title={`Others see you as "${identity.name}"`}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: identity.color }} />
      <span className="font-medium">You</span>
      <span className="text-zinc-400 dark:text-slate-500">·</span>
      <span>{identity.name}</span>
    </span>
  );
}

/** Small dots shown on a timeline row for peers currently editing it. */
export function RowPeerChips({ peers }: { peers: Peer[] }) {
  if (peers.length === 0) return null;
  return (
    <span className="ml-1 inline-flex -space-x-1 align-middle">
      {peers.map((p) => (
        <span
          key={p.sessionId}
          className="h-2 w-2 rounded-full ring-1 ring-white dark:ring-slate-950"
          style={{ backgroundColor: p.color }}
          title={p.name}
        />
      ))}
    </span>
  );
}
