"use client";

import { useState } from "react";
import { GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { parseFflogsUrl } from "@/hooks/use-fflogs-import";
import { getPlan, getPlanByViewLink } from "@/lib/plan-service";
import { castsToPlanAssignments, parsePlanUrl, translatePlanAssignments } from "@/lib/comparison-utils";
import type { Player } from "@/types/player";
import type { TimelineRow, MitigationAssignment } from "@/types/timeline";
import type { JobAbilityRecord } from "@/types/job-ability";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { FflogsImportResult } from "@/types/fflogs";
import { cn } from "@/lib/utils";

interface CompareDialogProps {
  originalPlayers: Player[];
  originalTimeline: TimelineRow[];
  originalTitle: string;
  abilitiesByJob: Record<JobAbbreviation, JobAbilityRecord[]>;
  abilitiesLoading: boolean;
  onCompare: (assignments: MitigationAssignment[], label: string) => void;
  onClear: () => void;
}

function detectUrlType(url: string): "fflogs" | "plan" | null {
  if (!url.trim()) return null;
  if (parseFflogsUrl(url)) return "fflogs";
  if (parsePlanUrl(url)) return "plan";
  return null;
}

function namesMatch(a: string, b: string): boolean {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  return al.includes(bl) || bl.includes(al);
}

export function CompareDialog({
  originalPlayers,
  originalTimeline,
  originalTitle,
  abilitiesByJob,
  abilitiesLoading,
  onCompare,
}: CompareDialogProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [bossWarning, setBossWarning] = useState(false);
  const [pendingResult, setPendingResult] = useState<{ assignments: MitigationAssignment[]; label: string } | null>(null);

  const urlType = detectUrlType(url);

  function reset() {
    setUrl("");
    setStatus("idle");
    setErrorMsg("");
    setBossWarning(false);
    setPendingResult(null);
  }

  function applyPending() {
    if (!pendingResult) return;
    onCompare(pendingResult.assignments, pendingResult.label);
    reset();
    setOpen(false);
  }

  async function handleImport() {
    setBossWarning(false);
    setPendingResult(null);
    setStatus("loading");
    setErrorMsg("");

    try {
      if (urlType === "fflogs") {
        const parsed = parseFflogsUrl(url)!;
        const res = await fetch("/api/fflogs/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        const result = (await res.json()) as FflogsImportResult;
        const assignments = castsToPlanAssignments({
          casts: result.casts,
          fflogsPlayers: result.players,
          originalPlayers,
          originalTimeline,
          abilitiesByJob,
        });
        const label = result.fight.name;

        if (!namesMatch(originalTitle, label)) {
          setPendingResult({ assignments, label });
          setStatus("idle");
          setBossWarning(true);
          return;
        }

        onCompare(assignments, label);
        reset();
        setOpen(false);
      } else if (urlType === "plan") {
        const parsed = parsePlanUrl(url)!;
        const plan =
          parsed.kind === "view"
            ? await getPlanByViewLink(parsed.id)
            : await getPlan(parsed.id);

        if (!plan) throw new Error("Plan not found. Check that the URL is correct.");

        const assignments = translatePlanAssignments({ comparisonPlan: plan, originalPlayers });
        onCompare(assignments, plan.title);
        reset();
        setOpen(false);
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
    }
  }

  const canImport = !!url.trim() && urlType !== null && status !== "loading" && !abilitiesLoading && !bossWarning;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Compare plans">
          <GitCompareArrows className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compare Against…</DialogTitle>
          <DialogDescription>
            Enter an FFLogs report URL or a plan link to overlay differences.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <Input
            placeholder="https://www.fflogs.com/reports/… or https://…/plan/view/…"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setStatus("idle");
              setErrorMsg("");
              setBossWarning(false);
              setPendingResult(null);
            }}
            disabled={status === "loading"}
            onKeyDown={(e) => { if (e.key === "Enter" && canImport) handleImport(); }}
          />

          {urlType && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {urlType === "fflogs" ? "FFLogs report detected" : "Plan link detected"}
            </p>
          )}

          {bossWarning && pendingResult && (
            <div className={cn(
              "rounded-md border p-3 text-sm flex flex-col gap-2",
              "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200"
            )}>
              <p>
                This report is for &ldquo;{pendingResult.label}&rdquo; which may not match this plan
                (&ldquo;{originalTitle}&rdquo;).
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={applyPending}>Apply Anyway</Button>
                <Button size="sm" variant="ghost" onClick={() => { setBossWarning(false); setPendingResult(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}

          {abilitiesLoading && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Loading abilities…</p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">Cancel</Button>
          </DialogClose>
          <Button size="sm" onClick={handleImport} disabled={!canImport}>
            {status === "loading" ? "Importing…" : "Compare"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
