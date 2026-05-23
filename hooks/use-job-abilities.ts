"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getJobAbilities } from "@/lib/job-ability-service";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { JobAbilityRecord } from "@/types/job-ability";

export function useJobAbilities(jobs: JobAbbreviation[]) {
  const results = useQueries({
    queries: jobs.map((job) => ({
      queryKey: ["job-abilities", job],
      queryFn: () =>
        getJobAbilities(job).then((list) => list.filter((a) => a.enabled)),
      staleTime: 10 * 60 * 1000,
    })),
  });

  const dataFingerprint = results.map((r) => r.dataUpdatedAt).join(",");
  const abilitiesByJob = useMemo(
    () =>
      Object.fromEntries(
        jobs.map((job, i) => [job, results[i].data ?? []])
      ) as Record<JobAbbreviation, JobAbilityRecord[]>,
    // results is intentionally replaced by dataFingerprint for a stable reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataFingerprint, jobs]
  );

  const isLoading = results.some((r) => r.isLoading);

  return { abilitiesByJob, isLoading };
}
