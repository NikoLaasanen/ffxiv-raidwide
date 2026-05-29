"use client";

import { useState, useMemo, useRef } from "react";
import { toBlob } from "html-to-image";
import { Share2, Copy, Check, Download, Loader2 } from "lucide-react";
import type { TimelineRow, MitigationAssignment } from "@/types/timeline";
import type { Player, PhaseDivider } from "@/types/player";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { JobAbilityRecord } from "@/types/job-ability";
import { buildMyTimelineData } from "@/lib/my-timeline";
import { formatTimestamp } from "@/lib/format-timestamp";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ShareableTimeline } from "@/components/timeline/ShareableTimeline";

interface ShareImageDialogProps {
  players: Player[];
  timeline: TimelineRow[];
  phases: PhaseDivider[];
  assignments: MitigationAssignment[];
  abilitiesByJob: Record<JobAbbreviation, JobAbilityRecord[]>;
  selectedJobs: JobAbbreviation[];
  title: string;
  encounterTier?: string | null;
}

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plan";
}

async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
    )
  );
}

export function ShareImageDialog(props: ShareImageDialogProps) {
  const { players, timeline, phases, assignments, abilitiesByJob, selectedJobs, title, encounterTier } = props;

  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const sortedPhases = useMemo(
    () => [...phases].sort((a, b) => a.timestamp - b.timestamp),
    [phases]
  );

  // All phases selected by default; reset whenever the dialog opens.
  const [selectedPhaseTs, setSelectedPhaseTs] = useState<Set<number>>(
    () => new Set(sortedPhases.map((p) => p.timestamp))
  );

  function handleOpenChange(next: boolean) {
    if (next) setSelectedPhaseTs(new Set(sortedPhases.map((p) => p.timestamp)));
    setOpen(next);
  }

  const isMultiJob = selectedJobs.length > 1;

  const { displayItems, abilityById, sortedSelectedJobs } = useMemo(
    () =>
      buildMyTimelineData({
        players,
        timeline,
        phases,
        assignments,
        abilitiesByJob,
        selectedJobs,
        includePhaseTimestamps: sortedPhases.length > 0 ? selectedPhaseTs : null,
        expandAll: true,
      }),
    [players, timeline, phases, assignments, abilitiesByJob, selectedJobs, sortedPhases, selectedPhaseTs]
  );

  const isEmpty = displayItems.every((i) => i.kind !== "row");

  async function capture(): Promise<Blob | null> {
    const node = cardRef.current;
    if (!node) return null;
    await waitForImages(node);
    return toBlob(node, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
  }

  const clipboardSupported =
    typeof navigator !== "undefined" &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === "function" &&
    typeof ClipboardItem !== "undefined";

  async function handleCopy() {
    if (!clipboardSupported) {
      await handleDownload();
      return;
    }
    setGenerating(true);
    try {
      const blob = await capture();
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy to clipboard failed:", err);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    setGenerating(true);
    try {
      const blob = await capture();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(title)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setGenerating(false);
    }
  }

  function togglePhase(ts: number) {
    setSelectedPhaseTs((prev) => {
      const next = new Set(prev);
      if (next.has(ts)) next.delete(ts);
      else next.add(ts);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Share as image">
          <Share2 size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Share as image</DialogTitle>
          <DialogDescription>
            Generate a PNG of your plan to share — e.g. paste it into Discord.
          </DialogDescription>
        </DialogHeader>

        {sortedPhases.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-border bg-muted/40 p-3">
            <span className="w-full text-xs font-medium text-muted-foreground">Phases to include</span>
            {sortedPhases.map((p) => (
              <label key={p.timestamp} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedPhaseTs.has(p.timestamp)}
                  onCheckedChange={() => togglePhase(p.timestamp)}
                />
                <span>{p.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatTimestamp(p.timestamp)}
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Preview — this is the exact node captured to PNG. */}
        <div className="max-h-[55vh] overflow-auto rounded-md border border-border">
          {isEmpty ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No assignments to show for the selected phases.
            </div>
          ) : (
            <ShareableTimeline
              ref={cardRef}
              title={title}
              encounterTier={encounterTier}
              selectedJobs={sortedSelectedJobs}
              displayItems={displayItems}
              abilityById={abilityById}
              isMultiJob={isMultiJob}
            />
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={generating || isEmpty}>
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Download PNG
          </Button>
          {clipboardSupported && (
            <Button onClick={handleCopy} disabled={generating || isEmpty}>
              {generating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : copied ? (
                <Check size={16} />
              ) : (
                <Copy size={16} />
              )}
              {copied ? "Copied!" : "Copy to clipboard"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
