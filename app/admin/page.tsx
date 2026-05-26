"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { JOB_GROUPS, JOB_NAMES, ALL_JOBS } from "@/lib/jobs";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { XivApiAction, JobAbilityRecord } from "@/types/job-ability";
import EncounterAdmin from "./EncounterAdmin";

type AbilityTarget = "self" | "party" | "single";
type AbilityType = "mitigation" | "utility" | "buff" | "interrupt" | "cleanse";

interface SavedAbility {
  xivapiId: number;
  duration: number;
  mitigationPhysical: number;
  mitigationMagical: number;
  target: AbilityTarget;
  abilityType: AbilityType;
}

interface EditRow extends XivApiAction {
  checked: boolean;
  cooldownEdit: string;
  durationEdit: string;
  mitigationPhysical: string;
  mitigationMagical: string;
  target: AbilityTarget;
  abilityType: AbilityType;
  existsInDb: boolean;
}

function toEditRow(action: XivApiAction, saved?: SavedAbility): EditRow {
  return {
    ...action,
    checked: false,
    cooldownEdit: String(action.cooldown),
    durationEdit: saved ? String(saved.duration) : "0",
    mitigationPhysical: saved ? String(saved.mitigationPhysical) : "0",
    mitigationMagical: saved ? String(saved.mitigationMagical) : "0",
    target: saved?.target ?? "party",
    abilityType: saved?.abilityType ?? "mitigation",
    existsInDb: !!saved,
  };
}

function toAbilityRecord(
  row: EditRow,
  selectedJob: JobAbbreviation
): Omit<JobAbilityRecord, "createdAt" | "updatedAt"> {
  const derivedJobs = row.isRoleAction
    ? ALL_JOBS.filter((j) => !!row.classJobCategory[j])
    : [selectedJob];

  return {
    id: row.isRoleAction ? `ROLE_${row.xivapiId}` : `${selectedJob}_${row.xivapiId}`,
    xivapiId: row.xivapiId,
    jobs: derivedJobs.length > 0 ? derivedJobs : [selectedJob],
    name: row.name,
    iconPath: row.iconPath,
    cooldown: parseFloat(row.cooldownEdit) || 0,
    duration: parseFloat(row.durationEdit) || 0,
    mitigationPhysical: parseFloat(row.mitigationPhysical) || 0,
    mitigationMagical: parseFloat(row.mitigationMagical) || 0,
    target: row.target,
    abilityType: row.abilityType,
    isRoleAction: row.isRoleAction,
    enabled: true,
  };
}

const inputCls =
  "w-16 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400";
const selectCls =
  "px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400";

const VALID_TABS = ["abilities", "encounters"] as const;
type AdminTab = (typeof VALID_TABS)[number];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("abilities");
  const [selectedJob, setSelectedJob] = useState<JobAbbreviation>("PLD");
  const [rows, setRows] = useState<EditRow[]>([]);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.slice(1) as AdminTab;
    if (VALID_TABS.includes(hash)) setActiveTab(hash);
  }, []);

  const handleTabChange = (value: string) => {
    const tab = value as AdminTab;
    setActiveTab(tab);
    window.location.hash = tab;
  };

  const handleLoad = async () => {
    setIsLoading(true);
    setStatus("Loading from XIVAPI…");
    try {
      const [xivapiRes, dbRes] = await Promise.all([
        fetch(`/api/xivapi/actions?job=${selectedJob}`),
        fetch(`/api/admin/abilities?job=${selectedJob}`),
      ]);
      const [xivapiData, dbData] = await Promise.all([xivapiRes.json(), dbRes.json()]);
      if (!xivapiRes.ok) throw new Error(xivapiData.error ?? "XIVAPI request failed");

      const savedMap = new Map<number, SavedAbility>(
        dbRes.ok ? dbData.abilities.map((s: SavedAbility) => [s.xivapiId, s]) : []
      );
      const actions = xivapiData.actions as XivApiAction[];
      setRows(actions.map((a) => toEditRow(a, savedMap.get(a.xivapiId))));
      setStatus(`Loaded ${actions.length} abilities for ${JOB_NAMES[selectedJob]}`);
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    const selected = rows.filter((r) => r.checked);
    if (!selected.length) return;
    setIsSaving(true);
    try {
      const records = selected.map((r) => toAbilityRecord(r, selectedJob));
      const res = await fetch("/api/admin/abilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(records),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const savedIds = new Set(selected.map((r) => r.xivapiId));
      setRows((prev) =>
        prev.map((r) =>
          savedIds.has(r.xivapiId) ? { ...r, checked: false, existsInDb: true } : r
        )
      );
      setStatus(`Saved ${data.saved} abilities`);
    } catch (e) {
      setStatus(`Save error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateRow = useCallback((index: number, updates: Partial<EditRow>) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }, []);

  const toggleAll = (checked: boolean) =>
    setRows((prev) => prev.map((r) => ({ ...r, checked })));

  const selectedCount = rows.filter((r) => r.checked).length;

  const selectJob = (job: JobAbbreviation) => {
    setSelectedJob(job);
    setRows([]);
    setStatus("");
  };

  return (
    <main className="p-8 max-w-[1400px] min-w-[900px] mx-auto">
      <h1 className="text-2xl font-bold mb-1">Admin</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
        <TabsList className="mb-8">
          <TabsTrigger value="abilities">Abilities</TabsTrigger>
          <TabsTrigger value="encounters">Encounters</TabsTrigger>
        </TabsList>

        <TabsContent value="encounters">
          <EncounterAdmin />
        </TabsContent>

        <TabsContent value="abilities">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
            Fetch job abilities from XIVAPI, fill in mitigation values, and save to database.
          </p>

      <Tabs
        defaultValue="Tank"
        onValueChange={(value) => {
          const group = JOB_GROUPS.find((g) => g.label === value);
          if (group) selectJob(group.jobs[0]);
        }}
        className="mb-6"
      >
        <TabsList>
          {JOB_GROUPS.map((g) => (
            <TabsTrigger key={g.label} value={g.label}>
              {g.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {JOB_GROUPS.map((g) => (
          <TabsContent key={g.label} value={g.label}>
            <div className="flex gap-2 mt-3">
              {g.jobs.map((job) => (
                <button
                  key={job}
                  type="button"
                  onClick={() => selectJob(job)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    selectedJob === job
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {job}
                </button>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex items-center gap-4 mb-4">
        <Button onClick={handleLoad} disabled={isLoading}>
          {isLoading ? "Loading…" : "Load from XIVAPI"}
        </Button>
        {rows.length > 0 && (
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isSaving || selectedCount === 0}
          >
            {isSaving ? "Saving…" : `Save Selected (${selectedCount})`}
          </Button>
        )}
        {status && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{status}</span>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                <th className="px-3 py-2 w-10">
                  <Checkbox
                    checked={selectedCount === rows.length && rows.length > 0}
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                </th>
                <th className="px-3 py-2 w-10" />
                <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Name
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 w-20">
                  CD (s)
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 w-20">
                  Dur (s)
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 w-20">
                  Phys%
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 w-20">
                  Mag%
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 w-28">
                  Target
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 w-32">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.xivapiId}
                  className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-3 py-1.5">
                    <Checkbox
                      checked={row.checked}
                      onCheckedChange={(v) => updateRow(i, { checked: !!v })}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    {row.iconPath && (
                      <Image
                        src={row.iconPath}
                        alt=""
                        width={24}
                        height={24}
                        className="rounded"
                        unoptimized
                      />
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="font-medium">{row.name}</span>
                    {row.isRoleAction && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded">
                        Role
                      </span>
                    )}
                    {row.existsInDb && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded">
                        Saved
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      value={row.cooldownEdit}
                      onChange={(e) => updateRow(i, { cooldownEdit: e.target.value })}
                      className={inputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      value={row.durationEdit}
                      onChange={(e) => updateRow(i, { durationEdit: e.target.value })}
                      className={inputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      value={row.mitigationPhysical}
                      onChange={(e) => updateRow(i, { mitigationPhysical: e.target.value })}
                      className={inputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      value={row.mitigationMagical}
                      onChange={(e) => updateRow(i, { mitigationMagical: e.target.value })}
                      className={inputCls}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={row.target}
                      onChange={(e) => updateRow(i, { target: e.target.value as AbilityTarget })}
                      className={selectCls}
                    >
                      <option value="party">Party</option>
                      <option value="self">Self</option>
                      <option value="single">Single</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={row.abilityType}
                      onChange={(e) => updateRow(i, { abilityType: e.target.value as AbilityType })}
                      className={selectCls}
                    >
                      <option value="mitigation">Mitigation</option>
                      <option value="utility">Utility</option>
                      <option value="buff">Buff</option>
                      <option value="interrupt">Interrupt</option>
                      <option value="cleanse">Cleanse</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
