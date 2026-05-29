"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { FileText, Heart, Swords } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { usePlanStore } from "@/store/plan-store";
import { useEncounters } from "@/hooks/use-encounters";
import { buildPlanFromEncounter } from "@/lib/create-plan-from-encounter";
import { getMyPlans, getMyPlansServerSnapshot, subscribeToMyPlans } from "@/lib/my-plans-storage";
import { getFavorites, getFavoritesServerSnapshot, subscribeToFavorites } from "@/lib/favorites-storage";
import type { EncounterDoc } from "@/types/encounter";

const RECENT_LIMIT = 7;
const FAVORITES_LIMIT = 5;
const ENCOUNTER_LIMIT = 8;

export default function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const setPlan = usePlanStore((s) => s.setPlan);
  const [query, setQuery] = useState("");

  const plans = useSyncExternalStore(subscribeToMyPlans, getMyPlans, getMyPlansServerSnapshot);
  const favorites = useSyncExternalStore(
    subscribeToFavorites,
    getFavorites,
    getFavoritesServerSnapshot
  );
  const { data: encounters = [] } = useEncounters();

  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery("");
    onOpenChange(next);
  };

  const navigate = (href: string) => {
    handleOpenChange(false);
    router.push(href);
  };

  const createFromEncounter = (encounter: EncounterDoc) => {
    const plan = buildPlanFromEncounter(encounter);
    setPlan(plan);
    navigate(`/plan/${plan.editLinkId}`);
  };

  const q = query.trim().toLowerCase();

  const planMatches = q
    ? plans.filter((p) => p.title.toLowerCase().includes(q))
    : plans.slice(0, RECENT_LIMIT);
  const favoriteMatches = q
    ? favorites.filter((f) => f.title.toLowerCase().includes(q))
    : favorites.slice(0, FAVORITES_LIMIT);
  const encounterMatches = q
    ? encounters
        .filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            (e.tier ?? "").toLowerCase().includes(q) ||
            (e.type ?? "").toLowerCase().includes(q)
        )
        .slice(0, ENCOUNTER_LIMIT)
    : [];

  const hasResults =
    planMatches.length > 0 ||
    favoriteMatches.length > 0 ||
    encounterMatches.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      shouldFilter={false}
      title="Search"
      description="Search your plans and encounters"
    >
      <CommandInput
        placeholder="Search plans and encounters…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!hasResults && (
          <CommandEmpty>
            {q ? "No matches." : "Save or favorite a plan to see it here."}
          </CommandEmpty>
        )}

        {favoriteMatches.length > 0 && (
          <CommandGroup heading="Favorites">
            {favoriteMatches.map((fav) => (
              <CommandItem
                key={`fav:${fav.viewLinkId}`}
                value={`fav:${fav.viewLinkId}`}
                onSelect={() => navigate(`/plan/view/${fav.viewLinkId}`)}
              >
                <Heart className="fill-current text-rose-500" />
                <span className="truncate">{fav.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {planMatches.length > 0 && (
          <CommandGroup heading={q ? "My Plans" : "Recent Plans"}>
            {planMatches.map((plan) => (
              <CommandItem
                key={`plan:${plan.id}`}
                value={`plan:${plan.id}`}
                onSelect={() => navigate(`/plan/${plan.editLinkId}`)}
              >
                <FileText />
                <span className="truncate">{plan.title}</span>
                {plan.encounterId && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {plan.encounterId}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {encounterMatches.length > 0 && (
          <CommandGroup heading="Encounters">
            {encounterMatches.map((enc) => (
              <CommandItem
                key={`enc:${enc.id}`}
                value={`enc:${enc.id}`}
                onSelect={() => createFromEncounter(enc)}
              >
                <Swords />
                <span className="truncate">{enc.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {[enc.tier, enc.patch].filter(Boolean).join(" · ")}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
