"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/format-timestamp";
import type { TimelineRow, MechanicType } from "@/types/timeline";
import type { PhaseDivider } from "@/types/player";
import type { DamageType } from "@/types/common";
import type { EncounterType, EncounterDoc } from "@/types/encounter";
import { inputCls, selectCls } from "@/app/admin/admin-styles";

type EditorRow = {
  timestamp: number;
  timestampEdit: string;
  bossAbility: string;
  damageType: DamageType | "";
  mechanicType: MechanicType;
  hidden: boolean;
  cleanse: boolean;
  interrupt: boolean;
};

type EditorPhase = {
  timestamp: number;
  timestampEdit: string;
  name: string;
};


function parseTimestampInput(value: string): number {
  const trimmed = value.trim();
  const mmss = /^(\d+):(\d{2})$/.exec(trimmed);
  if (mmss) return (parseInt(mmss[1]) * 60 + parseInt(mmss[2])) * 1000;
  const secs = parseFloat(trimmed);
  return isNaN(secs) ? 0 : Math.round(secs * 1000);
}

function parseFflogsUrl(url: string): { reportCode: string; fightId: number } | null {
  const codeMatch = /fflogs\.com\/reports\/([A-Za-z0-9]+)/.exec(url);
  if (!codeMatch) return null;
  const reportCode = codeMatch[1];
  const fightMatch = /[#&?]fight=(\d+|last)/.exec(url);
  const fightPart = fightMatch?.[1];
  const fightId = !fightPart || fightPart === "last" ? -1 : parseInt(fightPart);
  return { reportCode, fightId };
}

function toEditorRows(timeline: TimelineRow[]): EditorRow[] {
  return timeline.map((r) => ({
    timestamp: r.timestamp,
    timestampEdit: formatTimestamp(r.timestamp),
    bossAbility: r.bossAbility,
    damageType: (r.damageEvent?.type ?? "") as DamageType | "",
    mechanicType: r.mechanicType ?? "unknown",
    hidden: r.hidden,
    cleanse: r.cleanse ?? false,
    interrupt: r.interrupt ?? false,
  }));
}

function toEditorPhases(phases: PhaseDivider[]): EditorPhase[] {
  return phases.map((p) => ({
    timestamp: p.timestamp,
    timestampEdit: formatTimestamp(p.timestamp),
    name: p.name,
  }));
}

function editorRowsToTimeline(rows: EditorRow[]): TimelineRow[] {
  return rows.map((r) => ({
    timestamp: r.timestamp,
    bossAbility: r.bossAbility,
    damageEvent: r.damageType ? { rawDamage: 0, allDamages: [], type: r.damageType } : undefined,
    mechanicType: r.mechanicType,
    hidden: r.hidden,
    cleanse: r.cleanse,
    interrupt: r.interrupt,
    playerMistakes: {},
  }));
}

function editorPhasesToPhases(phases: EditorPhase[]): PhaseDivider[] {
  return phases.map((p) => ({ timestamp: p.timestamp, name: p.name, collapsed: false }));
}

// --- Shared ---

const TYPE_BADGE: Record<string, string> = {
  Ultimate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Savage: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  Criterion: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function TypeBadge({ type }: { type?: string }) {
  if (!type) return <span className="text-zinc-400">—</span>;
  const cls = TYPE_BADGE[type] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{type}</span>;
}

// --- List view ---

type SortField = "name" | "type" | "tier" | "patch" | "events";
type SortDir = "asc" | "desc";

function SortableTh({
  field, label, sortField, sortDir, onSort, className,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = sortField === field;
  return (
    <th
      className={`px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      {label}
      <span className={`ml-1 ${active ? "" : "text-zinc-300 dark:text-zinc-600"}`}>
        {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </th>
  );
}

function EncounterList({
  encounters,
  loading,
  onNew,
  onEdit,
  onDelete,
}: {
  encounters: EncounterDoc[];
  loading: boolean;
  onNew: () => void;
  onEdit: (e: EncounterDoc) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterTier, setFilterTier] = useState("");
  const [filterPatch, setFilterPatch] = useState("");
  const [sortField, setSortField] = useState<SortField>("patch");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const uniqueTiers = useMemo(
    () => [...new Set(encounters.map((e) => e.tier).filter(Boolean))].sort(),
    [encounters]
  );
  const uniquePatches = useMemo(
    () => [...new Set(encounters.map((e) => e.patch).filter(Boolean))].sort(),
    [encounters]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return encounters
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .filter((e) => !filterType || e.type === filterType)
      .filter((e) => !filterTier || e.tier === filterTier)
      .filter((e) => !filterPatch || e.patch === filterPatch)
      .sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        if (sortField === "events") {
          av = a.timeline?.length ?? 0;
          bv = b.timeline?.length ?? 0;
        } else {
          av = (a[sortField] ?? "").toLowerCase();
          bv = (b[sortField] ?? "").toLowerCase();
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [encounters, search, filterType, filterTier, filterPatch, sortField, sortDir]);

  const hasFilters = search || filterType || filterTier || filterPatch;
  const resetFilters = () => { setSearch(""); setFilterType(""); setFilterTier(""); setFilterPatch(""); };

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <Button onClick={onNew}>New Encounter</Button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading encounters…</p>
      ) : encounters.length === 0 ? (
        <p className="text-sm text-zinc-500">No encounters saved yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="search"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputCls + " w-48"}
            />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectCls}>
              <option value="">All types</option>
              <option value="Ultimate">Ultimate</option>
              <option value="Savage">Savage</option>
              <option value="Criterion">Criterion</option>
              <option value="Other">Other</option>
            </select>
            <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className={selectCls}>
              <option value="">All tiers</option>
              {uniqueTiers.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterPatch} onChange={(e) => setFilterPatch(e.target.value)} className={selectCls}>
              <option value="">All patches</option>
              {uniquePatches.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-1"
              >
                Clear filters
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No encounters match your filters.{" "}
              <button type="button" onClick={resetFilters} className="underline hover:text-zinc-900 dark:hover:text-zinc-100">
                Clear filters
              </button>
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <SortableTh field="name" label="Name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh field="type" label="Type" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="w-24" />
                    <SortableTh field="tier" label="Tier" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh field="patch" label="Patch" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh field="events" label="Events" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="w-20" />
                    <th className="px-3 py-2 w-32" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((enc) => (
                    <tr
                      key={enc.id}
                      className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    >
                      <td className="px-3 py-2 font-medium">{enc.name}</td>
                      <td className="px-3 py-2"><TypeBadge type={enc.type} /></td>
                      <td className="px-3 py-2 text-zinc-500">{enc.tier}</td>
                      <td className="px-3 py-2 text-zinc-500">{enc.patch}</td>
                      <td className="px-3 py-2 text-zinc-500">{enc.timeline?.length ?? 0}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => onEdit(enc)}>Edit</Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                            onClick={() => onDelete(enc.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Editor view ---

function EncounterEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: EncounterDoc | null;
  onSave: (enc: EncounterDoc) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<EncounterType>(initial?.type ?? "Savage");
  const [tier, setTier] = useState(initial?.tier ?? "");
  const [patch, setPatch] = useState(initial?.patch ?? "");
  const [imageName, setImageName] = useState(initial?.imageName ?? "");
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [rows, setRows] = useState<EditorRow[]>(toEditorRows(initial?.timeline ?? []));
  const [phases, setPhases] = useState<EditorPhase[]>(toEditorPhases(initial?.phases ?? []));
  const [fflogsUrl, setFflogsUrl] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/encounters/images")
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then((data) => setAvailableImages(data.images ?? []))
      .catch(() => {});
  }, []);

  const handleImport = async () => {
    const parsed = parseFflogsUrl(fflogsUrl);
    if (!parsed) {
      setImportStatus("Invalid FFLogs URL. Expected: fflogs.com/reports/CODE#fight=N");
      return;
    }
    setIsImporting(true);
    setImportStatus("Importing…");
    try {
      const res = await fetch("/api/admin/encounters/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setRows(toEditorRows(data.timeline));
      if (!name && data.fightName) setName(data.fightName);
      setImportStatus(`Imported ${data.timeline.length} events`);
    } catch (e) {
      setImportStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const updateRow = useCallback((index: number, updates: Partial<EditorRow>) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }, []);

  const updateRowAndMatching = useCallback((index: number, updates: Partial<Pick<EditorRow, "damageType" | "mechanicType" | "cleanse" | "interrupt">>) => {
    setRows((prev) => {
      const name = prev[index].bossAbility;
      return prev.map((r, i) =>
        i === index || r.bossAbility === name ? { ...r, ...updates } : r
      );
    });
  }, []);

  const commitTimestamp = (index: number, value: string) => {
    const ms = parseTimestampInput(value);
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], timestamp: ms, timestampEdit: formatTimestamp(ms) };
      return [...next].sort((a, b) => a.timestamp - b.timestamp);
    });
  };

  const addRow = () => {
    const lastTs = rows.length > 0 ? rows[rows.length - 1].timestamp : 0;
    setRows((prev) => [
      ...prev,
      { timestamp: lastTs + 5000, timestampEdit: formatTimestamp(lastTs + 5000), bossAbility: "", damageType: "", mechanicType: "unknown", hidden: false, cleanse: false, interrupt: false },
    ]);
  };

  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const updatePhase = (index: number, updates: Partial<EditorPhase>) =>
    setPhases((prev) => { const next = [...prev]; next[index] = { ...next[index], ...updates }; return next; });

  const commitPhaseTimestamp = (index: number, value: string) => {
    const ms = parseTimestampInput(value);
    setPhases((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], timestamp: ms, timestampEdit: formatTimestamp(ms) };
      return [...next].sort((a, b) => a.timestamp - b.timestamp);
    });
  };

  const addPhase = () => {
    setPhases((prev) => [...prev, { timestamp: 0, timestampEdit: "00:00", name: "Phase" }]);
  };

  const removePhase = (index: number) => setPhases((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const enc: EncounterDoc = {
        id: initial?.id ?? "",
        name: name.trim(),
        type,
        tier: tier.trim(),
        patch: patch.trim(),
        imageName,
        timeline: editorRowsToTimeline(rows),
        phases: editorPhasesToPhases(phases),
        createdAt: initial?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      await onSave(enc);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Metadata */}
      <div className="grid grid-cols-5 gap-4 max-w-4xl">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Name</label>
          <input className={inputCls + " w-full"} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. M4S" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Type</label>
          <select className={selectCls + " w-full"} value={type} onChange={(e) => setType(e.target.value as EncounterType)}>
            <option value="Savage">Savage</option>
            <option value="Ultimate">Ultimate</option>
            <option value="Criterion">Criterion</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Tier</label>
          <input className={inputCls + " w-full"} value={tier} onChange={(e) => setTier(e.target.value)} placeholder="e.g. AAC Light-heavyweight M" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Patch</label>
          <input className={inputCls + " w-full"} value={patch} onChange={(e) => setPatch(e.target.value)} placeholder="e.g. 7.1" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Cover Image</label>
          <select className={selectCls + " w-full"} value={imageName} onChange={(e) => setImageName(e.target.value)}>
            <option value="">No image</option>
            {availableImages.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* FFLogs import */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Import from FFLogs</h2>
        <div className="flex items-center gap-3">
          <input
            className={inputCls + " w-96"}
            placeholder="https://www.fflogs.com/reports/ABC123#fight=5"
            value={fflogsUrl}
            onChange={(e) => setFflogsUrl(e.target.value)}
          />
          <Button onClick={handleImport} disabled={isImporting || !fflogsUrl}>
            {isImporting ? "Importing…" : "Import"}
          </Button>
          {importStatus && <span className="text-sm text-zinc-500">{importStatus}</span>}
        </div>
      </div>

      {/* Timeline rows */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Timeline ({rows.length} events)</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 mb-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 w-20">Time</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Ability</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 w-28">Dmg Type</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 w-32">Mechanic</th>
                <th className="px-3 py-2 text-center font-medium text-zinc-500 dark:text-zinc-400 w-16">Cleanse</th>
                <th className="px-3 py-2 text-center font-medium text-zinc-500 dark:text-zinc-400 w-16">Interrupt</th>
                <th className="px-3 py-2 text-center font-medium text-zinc-500 dark:text-zinc-400 w-16">Hidden</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-zinc-100 dark:border-zinc-800 last:border-0 ${row.hidden ? "opacity-50" : ""}`}
                >
                  <td className="px-3 py-1.5">
                    <input
                      className={inputCls + " w-16"}
                      value={row.timestampEdit}
                      onChange={(e) => updateRow(i, { timestampEdit: e.target.value })}
                      onBlur={(e) => commitTimestamp(i, e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      className={inputCls + " w-full min-w-40"}
                      value={row.bossAbility}
                      onChange={(e) => updateRow(i, { bossAbility: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      className={selectCls}
                      value={row.damageType}
                      onChange={(e) => updateRowAndMatching(i, { damageType: e.target.value as DamageType | "" })}
                    >
                      <option value="">—</option>
                      <option value="magical">Magical</option>
                      <option value="physical">Physical</option>
                      <option value="unique">Unique</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      className={selectCls}
                      value={row.mechanicType}
                      onChange={(e) => updateRowAndMatching(i, { mechanicType: e.target.value as MechanicType })}
                    >
                      <option value="unknown">Unknown</option>
                      <option value="party">Party</option>
                      <option value="tankbuster">Tankbuster</option>
                      <option value="single">Single</option>
                      <option value="enrage">Enrage</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.cleanse}
                      onChange={(e) => updateRowAndMatching(i, { cleanse: e.target.checked })}
                      className="w-4 h-4 accent-zinc-700"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.interrupt}
                      onChange={(e) => updateRowAndMatching(i, { interrupt: e.target.checked })}
                      className="w-4 h-4 accent-zinc-700"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={row.hidden}
                      onChange={(e) => updateRow(i, { hidden: e.target.checked })}
                      className="w-4 h-4 accent-zinc-700"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-zinc-400 hover:text-red-500 text-base leading-none"
                      aria-label="Remove row"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="outline" size="sm" onClick={addRow}>+ Add Row</Button>
      </div>

      {/* Phases */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Phases ({phases.length})</h2>
        {phases.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 mb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 w-20">Time</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {phases.map((phase, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <td className="px-3 py-1.5">
                      <input
                        className={inputCls + " w-16"}
                        value={phase.timestampEdit}
                        onChange={(e) => updatePhase(i, { timestampEdit: e.target.value })}
                        onBlur={(e) => commitPhaseTimestamp(i, e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        className={inputCls + " w-full min-w-40"}
                        value={phase.name}
                        onChange={(e) => updatePhase(i, { name: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => removePhase(i)}
                        className="text-zinc-400 hover:text-red-500 text-base leading-none"
                        aria-label="Remove phase"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={addPhase}>+ Add Phase</Button>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
          {isSaving ? "Saving…" : "Save Encounter"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// --- Root component ---

export default function EncounterAdmin() {
  const [view, setView] = useState<"list" | "editor">("list");
  const [encounters, setEncounters] = useState<EncounterDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EncounterDoc | null>(null);
  const [listStatus, setListStatus] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/admin/encounters")
      .then((r) => r.json())
      .then((data) => { if (!cancelled && data.encounters) setEncounters(data.encounters); })
      .catch(() => { if (!cancelled) setListStatus("Failed to load encounters"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const handleNew = () => { setEditing(null); setView("editor"); };
  const handleEdit = (enc: EncounterDoc) => { setEditing(enc); setView("editor"); };
  const reloadEncounters = () => setReloadKey((k) => k + 1);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this encounter?")) return;
    const res = await fetch(`/api/admin/encounters/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEncounters((prev) => prev.filter((e) => e.id !== id));
    } else {
      setListStatus("Delete failed");
    }
  };

  const handleSave = async (enc: EncounterDoc) => {
    const res = await fetch("/api/admin/encounters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enc),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed");
    reloadEncounters();
    setView("list");
  };

  const handleCancel = () => setView("list");

  if (view === "editor") {
    return (
      <div>
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-4 flex items-center gap-1"
        >
          ← Back to encounters
        </button>
        <h2 className="text-lg font-semibold mb-6">{editing ? `Edit: ${editing.name}` : "New Encounter"}</h2>
        <EncounterEditor initial={editing} onSave={handleSave} onCancel={handleCancel} />
      </div>
    );
  }

  return (
    <div>
      {listStatus && <p className="text-sm text-red-500 mb-3">{listStatus}</p>}
      <EncounterList
        encounters={encounters}
        loading={loading}
        onNew={handleNew}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
