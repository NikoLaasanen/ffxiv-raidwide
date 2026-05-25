import { useMutation } from "@tanstack/react-query";
import type { FflogsImportResult } from "@/types/fflogs";

export type { FflogsImportResult };

const FFLOGS_URL_REGEX = /fflogs\.com\/reports\/([^/?#]+).*?[?&]fight=(last|\d+)/;

export function parseFflogsUrl(url: string): { reportCode: string; fightId: number } | null {
  const match = FFLOGS_URL_REGEX.exec(url);
  if (!match) return null;
  const fightId = match[2] === "last" ? -1 : parseInt(match[2], 10);
  return { reportCode: match[1], fightId };
}

export function useFflogsImport() {
  return useMutation<FflogsImportResult, Error, { reportUrl: string }>({
    mutationFn: async ({ reportUrl }) => {
      const parsed = parseFflogsUrl(reportUrl);
      if (!parsed) throw new Error("Invalid FFLogs URL");

      const res = await fetch("/api/fflogs/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      return res.json() as Promise<FflogsImportResult>;
    },
  });
}
