import { useQuery } from "@tanstack/react-query";
import type { EncounterDoc } from "@/types/encounter";

async function fetchEncounters(): Promise<EncounterDoc[]> {
  const res = await fetch("/api/admin/encounters");
  const data = await res.json();
  return data.encounters ?? [];
}

export function useEncounters() {
  return useQuery({
    queryKey: ["encounters"],
    queryFn: fetchEncounters,
  });
}
