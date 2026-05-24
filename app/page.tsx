"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFflogsImport, parseFflogsUrl } from "@/hooks/use-fflogs-import";
import { usePlanStore } from "@/store/plan-store";
import { formatTimestamp } from "@/lib/format-timestamp";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const { mutate, isPending, error } = useFflogsImport();
  const router = useRouter();
  const setPendingImport = usePlanStore((s) => s.setPendingImport);
  const pendingImport = usePlanStore((s) => s.pendingImport);
  const hasHydrated = usePlanStore((s) => s._hasHydrated);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    if (value && !parseFflogsUrl(value)) {
      setUrlError("Must be a valid FFLogs report URL with a fight parameter");
    } else {
      setUrlError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parseFflogsUrl(url)) return;
    mutate(
      { reportUrl: url },
      {
        onSuccess: (result) => {
          setPendingImport(result);
          router.push("/plan/new");
        },
      }
    );
  };

  const isDisabled = isPending || !url || !!urlError || !parseFflogsUrl(url);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">FFXIV Raidwide Planner</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Import a fight from FFLogs, browse encounter presets, or create a new mitigation plan.
      </p>

      {hasHydrated && pendingImport && (
        <Card className="mt-6 max-w-xl border-zinc-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Unsaved plan in progress</CardTitle>
            <CardDescription>
              {pendingImport.fight.name} &middot; {formatTimestamp(pendingImport.fight.endTime - pendingImport.fight.startTime)} &middot; {pendingImport.players.length} players
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button size="sm" onClick={() => router.push("/plan/new")}>
              Continue
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPendingImport(null)}>
              Discard
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6 max-w-xl">
        <CardHeader>
          <CardTitle>Import from FFLogs</CardTitle>
          <CardDescription>Paste a FFLogs report URL to import fight data</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Input
                type="url"
                placeholder="https://www.fflogs.com/reports/<report_id>?fight=<fight_id>"
                value={url}
                onChange={handleUrlChange}
                aria-invalid={!!urlError}
                disabled={isPending}
              />
              {urlError && <p className="text-sm text-destructive">{urlError}</p>}
            </div>
            <Button type="submit" disabled={isDisabled} className="self-start">
              {isPending ? "Importing…" : "Import Fight"}
            </Button>
            {error && <p className="text-sm text-destructive">{error.message}</p>}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
