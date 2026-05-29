"use client";

import { useState, useEffect, useRef, useSyncExternalStore, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useFflogsImport, parseFflogsUrl } from "@/hooks/use-fflogs-import";
import { usePlanStore } from "@/store/plan-store";
import { getMyPlans, subscribeToMyPlans } from "@/lib/my-plans-storage";
import type { MyPlanEntry } from "@/lib/my-plans-storage";
import type { EncounterDoc, EncounterType } from "@/types/encounter";
import type { FflogsImportResult } from "@/types/fflogs";
import {
  ChevronRight,
  Clock,
  Trash2,
  ArrowRight,
  Link2,
  Check,
  X,
  Plus,
} from "lucide-react";

const CURRENT_PATCH = "7.5";

type FilterTab = "Current" | "Savage" | "Ultimate";

const parsePatch = (p: string) => parseFloat(p);

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

// ─── EncounterCoverArt ──────────────────────────────────────────────────────

function EncounterCoverArt({
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

// ─── ResumeBanner ───────────────────────────────────────────────────────────

function ResumeBanner({
  encounter,
  label,
  onContinue,
  onDiscard,
}: {
  encounter: string;
  label: string;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3 rounded-xl bg-primary/10 border border-primary/40">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground shrink-0">
        <Clock size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-slate-100 dark:text-slate-100 text-zinc-900">
          Unsaved draft{" "}
          <span className="text-slate-400 dark:text-slate-400 text-zinc-500 font-normal">
            · {encounter} — {label}
          </span>
        </div>
      </div>
      <button
        onClick={onDiscard}
        className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-md border border-slate-700 dark:border-slate-700 border-zinc-300 bg-transparent text-slate-500 dark:text-slate-500 text-zinc-500 text-[12.5px] hover:border-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
      >
        <Trash2 size={12} /> Discard
      </button>
      <button
        onClick={onContinue}
        className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-md bg-primary text-primary-foreground text-[12.5px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
      >
        Continue <ArrowRight size={13} />
      </button>
    </div>
  );
}

// ─── FFLogsImportHero ───────────────────────────────────────────────────────

function FFLogsImportHero({
  onImportSuccess,
}: {
  onImportSuccess: (result: FflogsImportResult) => void;
}) {
  const [url, setUrl] = useState("");
  const [focused, setFocused] = useState(false);
  const [pasteError, setPasteError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending, error } = useFflogsImport();

  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    inputRef.current?.focus();
  }, []);

  const detected = parseFflogsUrl(url);
  const valid = detected !== null;

  const borderCls = valid
    ? "border-primary/60"
    : focused
      ? "border-slate-600 dark:border-slate-600 border-zinc-400"
      : "border-slate-800 dark:border-slate-800 border-zinc-200";

  const shadowCls = valid
    ? "[box-shadow:0_0_0_4px_rgba(45,212,191,0.12)]"
    : "";

  const handleSubmit = () => {
    if (!valid || isPending) return;
    mutate({ reportUrl: url }, { onSuccess: onImportSuccess });
  };

  return (
    <div>
      <div
        className={`flex items-stretch h-14 rounded-xl border bg-white dark:bg-slate-900 overflow-hidden transition-all ${borderCls} ${shadowCls}`}
      >
        {/* Leading icon */}
        <div
          className={`inline-flex items-center justify-center w-13 shrink-0 transition-colors ${valid ? "text-primary" : "text-slate-600 dark:text-slate-600 text-zinc-400"
            }`}
        >
          <Link2 size={18} />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text").trim();
            if (parseFflogsUrl(pasted)) {
              e.preventDefault();
              setUrl(pasted);
              mutate({ reportUrl: pasted }, { onSuccess: onImportSuccess });
            }
          }}
          placeholder="Paste an FFLogs report URL — fflogs.com/reports/…?fight=…"
          disabled={isPending}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-zinc-900 dark:text-slate-100 text-[15px] pr-1 placeholder:text-zinc-400 dark:placeholder:text-slate-600 font-sans disabled:opacity-50"
        />

        {/* ⌘V Paste chip */}
        {url === "" && (
          <button
            type="button"
            onClick={async () => {
              inputRef.current?.focus();
              if (!navigator.clipboard?.readText) {
                setPasteError(true);
                setTimeout(() => setPasteError(false), 2500);
                return;
              }
              let txt = "";
              try {
                txt = (await navigator.clipboard.readText()).trim();
              } catch {
                setPasteError(true);
                setTimeout(() => setPasteError(false), 2500);
                return;
              }
              if (!txt) return;
              setUrl(txt);
              if (parseFflogsUrl(txt)) {
                mutate({ reportUrl: txt }, { onSuccess: onImportSuccess });
              }
            }}
            className={`self-center hidden sm:inline-flex items-center gap-1 px-2 py-1 mr-2 rounded-md border font-mono text-[11px] font-medium transition-colors cursor-pointer ${
              pasteError
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-500 dark:text-red-400"
                : "bg-zinc-100 dark:bg-slate-800 border-zinc-200 dark:border-slate-700 text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-300 hover:border-zinc-300 dark:hover:border-slate-600"
            }`}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="8" y="3" width="8" height="4" rx="1" />
              <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
            </svg>
            {pasteError ? "Allow clipboard access" : "Paste"}
            {!pasteError && <span className="text-zinc-400 dark:text-slate-600 ml-0.5">⌘V</span>}
          </button>
        )}

        {/* Clear button */}
        {url !== "" && !isPending && (
          <button
            type="button"
            onClick={() => {
              setUrl("");
              inputRef.current?.focus();
            }}
            aria-label="Clear"
            className="self-center w-7 h-7 mr-1 inline-flex items-center justify-center text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300 transition-colors bg-transparent border-0"
          >
            <X size={14} />
          </button>
        )}

        {/* Import button */}
        <button
          type="button"
          disabled={!valid || isPending}
          onClick={handleSubmit}
          className={`inline-flex items-center gap-1.5 m-[6px] px-4 rounded-lg border-0 text-[14px] font-semibold transition-all ${valid && !isPending
              ? "bg-primary text-primary-foreground cursor-pointer hover:opacity-90"
              : "bg-zinc-100 dark:bg-slate-800 text-zinc-400 dark:text-slate-600 cursor-not-allowed"
            }`}
        >
          {isPending ? "Importing…" : "Import"}
          {!isPending && <ArrowRight size={14} />}
        </button>
      </div>

      {/* Helper row */}
      <div className="flex items-center gap-3.5 mt-2.5 pl-1 text-[12px] text-zinc-500 dark:text-slate-500">
        {detected ? (
          <span className="inline-flex items-center gap-1.5 text-primary font-medium">
            <Check size={13} />
            Report{" "}
            <span className="font-mono text-zinc-700 dark:text-slate-300">
              {detected.reportCode}
            </span>
            <span className="text-zinc-400 dark:text-slate-500">
              · fight {detected.fightId === -1 ? "last" : detected.fightId}
            </span>
          </span>
        ) : (
          <span>
            Auto-detects the encounter, party, deaths, and a starter mit plan
            from your party comp.
          </span>
        )}
        <span className="flex-1" />
        <Link
          href="/encounters"
          className="inline-flex items-center gap-1 text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-200 font-medium transition-colors no-underline"
        >
          <Plus size={12} /> Start a blank plan
        </Link>
      </div>

      {error && (
        <p className="mt-2 text-[12.5px] text-destructive pl-1">{error.message}</p>
      )}
    </div>
  );
}

// ─── EncounterTile ──────────────────────────────────────────────────────────

function EncounterTile({
  enc,
  highlight,
}: {
  enc: EncounterDoc;
  highlight?: boolean;
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

// ─── RecentPlanRow ──────────────────────────────────────────────────────────

function RecentPlanRow({
  plan,
  isLast,
}: {
  plan: MyPlanEntry;
  isLast: boolean;
}) {
  return (
    <Link
      href={`/plan/${plan.editLinkId}`}
      className={`group grid items-center gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-slate-900/60 transition-colors no-underline ${!isLast ? "border-b border-zinc-100 dark:border-slate-800" : ""
        }`}
      style={{ gridTemplateColumns: "44px minmax(0,1fr) 120px 24px" }}
    >
      {/* Mini cover */}
      <div className="w-9 h-9 rounded-md overflow-hidden shrink-0 transition-transform duration-200 group-hover:scale-105">
        {plan.encounterType === "Savage" ? (
          <Image src="/icons/SavageFight.png" alt="Savage" width={36} height={36} className="w-full h-full object-cover" />
        ) : plan.encounterType === "Ultimate" ? (
          <Image src="/icons/UltimateFight.png" alt="Ultimate" width={36} height={36} className="w-full h-full object-cover" />
        ) : (
          <EncounterCoverArt type={plan.encounterType ?? "Other"} uid={`row-${plan.id}`} className="w-full h-full" />
        )}
      </div>

      {/* Title */}
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-zinc-900 dark:text-slate-100 truncate">
          {plan.title}
        </div>
        {plan.encounterId && (
          <div className="text-[11px] font-mono text-zinc-400 dark:text-slate-500 mt-0.5 truncate">
            {plan.encounterId}
          </div>
        )}
      </div>

      {/* Date */}
      <div className="text-[11.5px] font-mono text-zinc-400 dark:text-slate-500 text-right">
        {timeAgo(plan.updatedAt)}
      </div>

      {/* Arrow */}
      <div className="text-zinc-400 dark:text-slate-600 group-hover:text-zinc-600 dark:group-hover:text-slate-400 flex justify-end transition-all duration-200 group-hover:translate-x-0.5">
        <ChevronRight size={14} />
      </div>
    </Link>
  );
}

// ─── HomeClient ─────────────────────────────────────────────────────────────

export default function HomeClient({
  initialEncounters,
}: {
  initialEncounters?: EncounterDoc[];
}) {
  const router = useRouter();
  const setPendingImport = usePlanStore((s) => s.setPendingImport);
  const pendingImport = usePlanStore((s) => s.pendingImport);
  const hasHydrated = usePlanStore((s) => s._hasHydrated);

  const [encounters, setEncounters] = useState<EncounterDoc[]>(initialEncounters ?? []);
  const [isLoadingEncounters, setIsLoadingEncounters] = useState(!initialEncounters);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("Current");

  const plans = useSyncExternalStore(
    subscribeToMyPlans,
    getMyPlans,
    getMyPlans,
  );

  useEffect(() => {
    if (initialEncounters) return;
    fetch("/api/admin/encounters")
      .then((r) => r.json())
      .then((data: { encounters?: EncounterDoc[] }) =>
        setEncounters(data.encounters ?? []),
      )
      .catch(() => {})
      .finally(() => setIsLoadingEncounters(false));
  }, [initialEncounters]);

  const handleImportSuccess = (result: FflogsImportResult) => {
    setPendingImport(result);
    router.push("/plan/new");
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const recentPlans = hasHydrated ? plans.slice(0, 6) : [];

  const displayedEncounters = useMemo(() => {
    if (activeFilter === "Current") {
      const patches = [...new Set(encounters.map((e) => e.patch))]
        .filter((p) => parsePatch(p) <= parsePatch(CURRENT_PATCH))
        .sort((a, b) => parsePatch(b) - parsePatch(a));
      const targetPatch = patches[0];
      return targetPatch ? encounters.filter((e) => e.patch === targetPatch) : [];
    }
    if (activeFilter === "Savage") {
      return [...encounters.filter((e) => e.type === "Savage")].sort(
        (a, b) => parsePatch(b.patch) - parsePatch(a.patch),
      );
    }
    return [...encounters.filter((e) => e.type === "Ultimate")].sort(
      (a, b) => parsePatch(b.patch) - parsePatch(a.patch),
    );
  }, [encounters, activeFilter]);

  return (
    <main className="flex-1 overflow-auto">
      <div className="max-w-[1180px] mx-auto px-6 py-10 pb-16">

        {/* Inline resume banner */}
        {hasHydrated && pendingImport && (
          <div className="mb-7">
            <ResumeBanner
              encounter={pendingImport.fight.name}
              label={`${pendingImport.players.length} players`}
              onContinue={() => router.push("/plan/new")}
              onDiscard={() => setPendingImport(null)}
            />
          </div>
        )}

        {/* Editorial headline */}
        <div className="flex items-baseline gap-4 mb-2">
          <span className="font-mono text-[12px] text-zinc-400 dark:text-slate-500 tracking-wide shrink-0">
            {today}
          </span>
          <span className="flex-1 h-px bg-zinc-200 dark:bg-slate-800" />
          <span className="font-mono text-[12px] text-primary tracking-wide shrink-0">
            ● Patch {CURRENT_PATCH} · live
          </span>
        </div>

        <h1 className="text-[clamp(36px,5vw,48px)] font-semibold tracking-[-0.05em] leading-[1.05] text-zinc-900 dark:text-slate-100 mt-0 mb-2">
          Plan the next pull.
        </h1>
        <p className="text-[14.5px] text-zinc-500 dark:text-slate-400 max-w-[620px] leading-relaxed mb-6">
          Paste an FFLogs report below to auto-import your party, fight
          timeline, and starter mit plan — or pick an encounter to plan from
          scratch.
        </p>

        {/* FFLogs import hero */}
        <FFLogsImportHero onImportSuccess={handleImportSuccess} />

        {/* Encounter tiles */}
        {(isLoadingEncounters || displayedEncounters.length > 0) && (
          <section className="mt-11">
            <div className="flex items-end gap-3 mb-3.5">
              <div className="flex-1">
                <div className="text-[11px] text-zinc-400 dark:text-slate-500 uppercase tracking-[0.05em] font-medium mb-1">
                  {activeFilter === "Current" ? "Current tier" : activeFilter}
                </div>
                {isLoadingEncounters ? (
                  <div className="h-[27px] w-44 rounded-md bg-zinc-100 dark:bg-slate-800 animate-pulse" />
                ) : (
                  <h2 className="text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-slate-100 leading-none m-0">
                    {activeFilter === "Current"
                      ? (displayedEncounters[0]?.tier ?? "Encounters")
                      : activeFilter === "Savage"
                        ? "All Savage raids"
                        : "All Ultimates"}
                  </h2>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                {(["Current", "Savage", "Ultimate"] as FilterTab[]).map((label) => (
                  <button
                    key={label}
                    onClick={() => setActiveFilter(label)}
                    className={`px-3 py-1.5 rounded-full text-[12px] border select-none cursor-pointer transition-colors ${
                      activeFilter === label
                        ? "bg-zinc-100 dark:bg-slate-800 border-zinc-200 dark:border-slate-700 text-zinc-900 dark:text-slate-100 font-medium"
                        : "border-zinc-200 dark:border-slate-800 text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div key={activeFilter} className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {isLoadingEncounters
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[200px] rounded-xl bg-zinc-100 dark:bg-slate-800 animate-pulse"
                    />
                  ))
                : displayedEncounters.map((enc, i) => (
                    <div
                      key={enc.id}
                      className="animate-in fade-in slide-in-from-bottom-3 duration-300 ease-out fill-mode-backwards"
                      style={{ animationDelay: `${i * 45}ms` }}
                    >
                      <EncounterTile enc={enc} highlight={i === 0} />
                    </div>
                  ))}
            </div>
          </section>
        )}

        {/* Recent plans */}
        <section className="mt-9">
          <div className="flex items-center gap-3 mb-3.5">
            <div className="flex-1">
              <div className="text-[11px] text-zinc-400 dark:text-slate-500 uppercase tracking-[0.05em] font-medium mb-1">
                Workspace
              </div>
              <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-slate-100 leading-none m-0">
                Your recent plans
              </h2>
            </div>
            <Link
              href="/my-plans"
              className="inline-flex items-center gap-1 text-[12.5px] text-zinc-400 dark:text-slate-400 hover:text-zinc-600 dark:hover:text-slate-200 transition-colors no-underline"
            >
              See all <ChevronRight size={13} />
            </Link>
          </div>

          {recentPlans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 dark:border-slate-800 px-6 py-10 text-center text-zinc-400 dark:text-slate-600 text-[13.5px]">
              No plans yet. Import a fight or pick an encounter above.
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              {recentPlans.map((plan, i) => (
                <RecentPlanRow
                  key={plan.id}
                  plan={plan}
                  isLast={i === recentPlans.length - 1}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
