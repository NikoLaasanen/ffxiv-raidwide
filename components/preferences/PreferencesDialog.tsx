"use client";

import { SettingsIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  usePreferencesStore,
  type AbilityTarget,
  type AbilityType,
} from "@/store/preferences-store";
import { ALL_JOBS } from "@/lib/jobs";

const ABILITY_TARGETS: { value: AbilityTarget; label: string }[] = [
  { value: "party", label: "Party" },
  { value: "self", label: "Self" },
  { value: "single", label: "Single target" },
];

const ABILITY_TYPES: { value: AbilityType; label: string }[] = [
  { value: "mitigation", label: "Mitigation" },
  { value: "utility", label: "Utility" },
  { value: "buff", label: "Buff" },
  { value: "interrupt", label: "Interrupt" },
];

export function PreferencesDialog() {
  const {
    showAutoAttacks, setShowAutoAttacks,
    showDamageColumn, setShowDamageColumn,
    showSourceColumn, setShowSourceColumn,
    showMechanicTypeColumn, setShowMechanicTypeColumn,
    showMistakesColumn, setShowMistakesColumn,
    activationBuffer, setActivationBuffer,
    abilityTargetFilter, setAbilityTargetFilter,
    abilityTypeFilter, setAbilityTypeFilter,
    myPlanDefaultJob, setMyPlanDefaultJob,
    myPlanIconsOnly, setMyPlanIconsOnly,
    resetPreferences,
  } = usePreferencesStore();

  function toggleTarget(value: AbilityTarget) {
    setAbilityTargetFilter(
      abilityTargetFilter.includes(value)
        ? abilityTargetFilter.filter((v) => v !== value)
        : [...abilityTargetFilter, value]
    );
  }

  function toggleType(value: AbilityType) {
    setAbilityTypeFilter(
      abilityTypeFilter.includes(value)
        ? abilityTypeFilter.filter((v) => v !== value)
        : [...abilityTypeFilter, value]
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Timeline preferences">
          <SettingsIcon />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Timeline Preferences</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Rows
            </h3>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm">Show auto attacks</span>
              <Switch
                checked={showAutoAttacks}
                onCheckedChange={setShowAutoAttacks}
              />
            </label>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Columns
            </h3>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm">Show damage values</span>
              <Switch
                checked={showDamageColumn}
                onCheckedChange={setShowDamageColumn}
              />
            </label>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Activation Buffer
            </h3>
            <div className="flex items-center gap-3">
              <label htmlFor="activation-buffer" className="text-sm flex-1">
                Buffer (seconds)
              </label>
              <Input
                id="activation-buffer"
                type="number"
                min={0}
                step={0.5}
                value={activationBuffer}
                onChange={(e) => setActivationBuffer(Number(e.target.value))}
                className="w-20 text-right"
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Reduces the effective duration window. At 1s, a 10s ability assigned at 0:10 covers through 0:19, not 0:20.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Show Abilities by Target
            </h3>
            <div className="flex flex-col gap-2">
              {ABILITY_TARGETS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={abilityTargetFilter.includes(value)}
                    onCheckedChange={() => toggleTarget(value)}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Show Abilities by Type
            </h3>
            <div className="flex flex-col gap-2">
              {ABILITY_TYPES.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={abilityTypeFilter.includes(value)}
                    onCheckedChange={() => toggleType(value)}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Additional Columns
            </h3>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm">Show source column</span>
              <Switch checked={showSourceColumn} onCheckedChange={setShowSourceColumn} />
            </label>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm">Show mechanic type column</span>
              <Switch checked={showMechanicTypeColumn} onCheckedChange={setShowMechanicTypeColumn} />
            </label>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm">Show mistakes column</span>
              <Switch checked={showMistakesColumn} onCheckedChange={setShowMistakesColumn} />
            </label>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              My Plan
            </h3>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="default-job" className="text-sm">Default job</label>
              <select
                id="default-job"
                value={myPlanDefaultJob ?? ""}
                onChange={(e) => setMyPlanDefaultJob((e.target.value as (typeof ALL_JOBS)[number]) || null)}
                className="h-8 rounded-md border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-zinc-700 dark:text-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">None</option>
                {ALL_JOBS.map((job) => (
                  <option key={job} value={job}>{job}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm">Show only ability icons</span>
              <Switch checked={myPlanIconsOnly} onCheckedChange={setMyPlanIconsOnly} />
            </label>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={resetPreferences}>
            Reset to defaults
          </Button>
          <DialogClose asChild>
            <Button size="sm">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
