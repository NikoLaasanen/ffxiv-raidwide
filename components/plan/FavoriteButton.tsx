"use client";

import { useSyncExternalStore } from "react";
import { Heart } from "lucide-react";
import {
  getFavorites,
  subscribeToFavorites,
  isFavorite,
  addFavorite,
  removeFavorite,
} from "@/lib/favorites-storage";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  viewLinkId: string;
  title: string;
  encounterId: string | null;
}

export function FavoriteButton({ viewLinkId, title, encounterId }: FavoriteButtonProps) {
  useSyncExternalStore(subscribeToFavorites, getFavorites, getFavorites);

  const favorited = isFavorite(viewLinkId);

  function toggle() {
    if (favorited) {
      removeFavorite(viewLinkId);
    } else {
      addFavorite({ viewLinkId, title, encounterId, savedAt: Date.now() });
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "flex items-center justify-center rounded p-1.5 cursor-pointer transition-colors",
        favorited
          ? "text-rose-500 hover:text-rose-600"
          : "text-zinc-400 hover:text-rose-400"
      )}
    >
      <Heart
        size={18}
        className={cn(favorited && "fill-current")}
      />
    </button>
  );
}
