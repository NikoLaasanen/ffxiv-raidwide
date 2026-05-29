"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { usePlanStore } from "@/store/plan-store";
import type { EncounterDoc, EncounterType } from "@/types/encounter";

// ─── EncounterCoverArt ──────────────────────────────────────────────────────

export function EncounterCoverArt({
  type,
  uid,
  imageName,
  className = "",
  children,
}: {
  type: EncounterType | null | undefined;
  uid: string;
  imageName?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const gradients: Record<string, [string, string]> = {
    Savage: ["#7c2d12", "#c2410c"],
    Ultimate: ["#1e3a8a", "#3b82f6"],
    Criterion: ["#164e63", "#0891b2"],
    Other: ["#1e293b", "#334155"],
  };
  const [a, b] = gradients[type ?? "Other"] ?? gradients["Other"];
  const patId = `g-${uid}`;

  const glyph: Record<string, React.ReactNode> = {
    Savage: (
      <>
        <circle cx="50" cy="50" r="13" fill="rgba(255,255,255,0.92)" />
        {Array.from({ length: 10 }).map((_, i) => {
          const ang = (i / 10) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={50 + Math.cos(ang) * 19}
              y1={50 + Math.sin(ang) * 19}
              x2={50 + Math.cos(ang) * 30}
              y2={50 + Math.sin(ang) * 30}
              stroke="rgba(255,255,255,0.88)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          );
        })}
      </>
    ),
    Ultimate: (
      <path
        d="M55 22 L36 54 L48 54 L42 78 L66 44 L52 44 Z"
        fill="rgba(255,255,255,0.92)"
      />
    ),
    Criterion: (
      <>
        <polygon
          points="50,26 60,46 80,46 64,60 70,80 50,68 30,80 36,60 20,46 40,46"
          fill="none"
          stroke="rgba(255,255,255,0.88)"
          strokeWidth="2"
        />
        <circle cx="50" cy="50" r="8" fill="rgba(255,255,255,0.92)" />
      </>
    ),
    Other: (
      <>
        <rect
          x="34"
          y="34"
          width="32"
          height="32"
          rx="4"
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="2"
          transform="rotate(45 50 50)"
        />
        <circle cx="50" cy="50" r="5" fill="rgba(255,255,255,0.8)" />
      </>
    ),
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)` }}
    >
      {imageName && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(/encounters/${imageName})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          aria-hidden
        />
      )}
      {!imageName && <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="block"
      >
        <defs>
          <pattern
            id={patId}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M10 0 H0 V10"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.6"
              fill="none"
            />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#${patId})`} />
        {glyph[type ?? "Other"] ?? glyph["Other"]}
      </svg>}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50 pointer-events-none" />
      {children}
    </div>
  );
}

// ─── EncounterTile ──────────────────────────────────────────────────────────

export function EncounterTile({
  enc,
  highlight,
  onNavigate,
}: {
  enc: EncounterDoc;
  highlight?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const setPlan = usePlanStore((s) => s.setPlan);

  const handleClick = () => {
    const editLinkId = crypto.randomUUID();
    const viewLinkId = crypto.randomUUID();
    const now = Date.now();
    setPlan({
      id: editLinkId,
      editLinkId,
      viewLinkId,
      title: enc.name,
      encounterId: enc.id,
      encounterType: enc.type ?? null,
      encounterTier: enc.tier ?? null,
      raidplanLink: null,
      timeline: enc.timeline,
      players: [],
      phases: enc.phases ?? [],
      assignments: [],
      createdAt: now,
      updatedAt: now,
    });
    onNavigate?.();
    router.push(`/plan/${editLinkId}`);
  };

  return (
    <button
      onClick={handleClick}
      className={`group relative text-left w-full h-[200px] rounded-xl overflow-hidden border transition-all cursor-pointer p-0 bg-transparent ${highlight
          ? "border-primary/50 [box-shadow:0_0_0_3px_rgba(45,212,191,0.10)]"
          : "border-zinc-200 dark:border-slate-800 hover:border-zinc-300 dark:hover:border-slate-700"
        }`}
    >
      <EncounterCoverArt
        type={enc.type}
        uid={enc.id}
        imageName={enc.imageName}
        className="absolute inset-0 w-full h-full"
      >
        {/* Bottom scrim for text legibility */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center gap-1.5">
          <span className="px-1.5 py-[3px] rounded bg-black/40 backdrop-blur-sm text-[10.5px] font-medium text-slate-300 tracking-wide">
            {enc.type} · {enc.patch}
          </span>
        </div>

        {/* Bottom */}
        <div className="absolute left-3 right-3 bottom-2.5 flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-semibold text-white leading-tight drop-shadow">
              {enc.name}
            </div>
          </div>
          <span
            className="w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0 bg-primary text-primary-foreground opacity-0 translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
          >
            <ArrowRight size={14} />
          </span>
        </div>
      </EncounterCoverArt>
    </button>
  );
}
