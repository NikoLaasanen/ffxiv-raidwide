"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Link2, ArrowRight, Check, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useFflogsImport, parseFflogsUrl } from "@/hooks/use-fflogs-import";
import { useEncounters } from "@/hooks/use-encounters";
import { usePlanStore } from "@/store/plan-store";
import { EncounterTile } from "@/components/encounter/EncounterTile";
import type { FflogsImportResult } from "@/types/fflogs";

const CURRENT_PATCH = "7.5";
const FEATURED_LIMIT = 3;

export default function NewPlanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const setPendingImport = usePlanStore((s) => s.setPendingImport);
  const setDraftPlan = usePlanStore((s) => s.setDraftPlan);
  const { mutate, isPending, error } = useFflogsImport();
  const { data: encounters = [] } = useEncounters();

  const [url, setUrl] = useState("");

  const close = () => onOpenChange(false);

  const handleImportSuccess = (result: FflogsImportResult) => {
    // Clear any staged copy so only one draft source is active at a time.
    setDraftPlan(null);
    setPendingImport(result);
    close();
    router.push("/plan/new");
  };

  const detected = parseFflogsUrl(url);
  const valid = detected !== null;

  const handleSubmit = () => {
    if (!valid || isPending) return;
    mutate({ reportUrl: url }, { onSuccess: handleImportSuccess });
  };

  const featured = encounters
    .filter((e) => e.patch === CURRENT_PATCH)
    .slice(0, FEATURED_LIMIT);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New plan</DialogTitle>
          <DialogDescription>
            Import an FFLogs report to auto-detect the encounter, party, deaths,
            and a starter mit plan.
          </DialogDescription>
        </DialogHeader>

        {/* Primary: FFLogs import */}
        <div>
          <div
            className={`flex items-stretch h-12 rounded-lg border bg-white dark:bg-slate-900 overflow-hidden transition-all ${
              valid
                ? "border-primary/60 [box-shadow:0_0_0_4px_rgba(45,212,191,0.12)]"
                : "border-zinc-200 dark:border-slate-800"
            }`}
          >
            <div
              className={`inline-flex items-center justify-center w-11 shrink-0 transition-colors ${
                valid ? "text-primary" : "text-zinc-400 dark:text-slate-600"
              }`}
            >
              <Link2 size={17} />
            </div>
            <input
              type="url"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Paste an FFLogs report URL…"
              disabled={isPending}
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-zinc-900 dark:text-slate-100 text-[14px] pr-1 placeholder:text-zinc-400 dark:placeholder:text-slate-600 disabled:opacity-50"
            />
            <button
              type="button"
              disabled={!valid || isPending}
              onClick={handleSubmit}
              className={`inline-flex items-center gap-1.5 m-[5px] px-3.5 rounded-md border-0 text-[13.5px] font-semibold transition-all ${
                valid && !isPending
                  ? "bg-primary text-primary-foreground cursor-pointer hover:opacity-90"
                  : "bg-zinc-100 dark:bg-slate-800 text-zinc-400 dark:text-slate-600 cursor-not-allowed"
              }`}
            >
              {isPending ? "Importing…" : "Import"}
              {!isPending && <ArrowRight size={14} />}
            </button>
          </div>

          <div className="mt-2 pl-1 text-[12px] text-zinc-500 dark:text-slate-500 min-h-[18px]">
            {error ? (
              <span className="text-destructive">{error.message}</span>
            ) : detected ? (
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
              <span>fflogs.com/reports/…?fight=…</span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 text-[11.5px] font-medium text-zinc-400 dark:text-slate-600 uppercase tracking-wide">
          <span className="flex-1 h-px bg-zinc-200 dark:bg-slate-800" />
          or start from a preset
          <span className="flex-1 h-px bg-zinc-200 dark:bg-slate-800" />
        </div>

        {/* Secondary: featured encounters */}
        {featured.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {featured.map((enc) => (
              <EncounterTile key={enc.id} enc={enc} onNavigate={close} />
            ))}
          </div>
        )}

        {/* Footer links */}
        <div className="flex items-center justify-between text-[12.5px]">
          <Link
            href="/encounters"
            onClick={close}
            className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-200 font-medium transition-colors no-underline"
          >
            Browse all encounters
            <ArrowRight size={13} />
          </Link>
          <Link
            href="/encounters"
            onClick={close}
            className="inline-flex items-center gap-1 text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-200 font-medium transition-colors no-underline"
          >
            <Plus size={12} /> Start a blank plan
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
