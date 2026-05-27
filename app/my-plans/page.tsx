"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import {
  getMyPlans,
  removeMyPlan,
  subscribeToMyPlans,
} from "@/lib/my-plans-storage";
import {
  getFavorites,
  removeFavorite,
  subscribeToFavorites,
} from "@/lib/favorites-storage";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MyPlansPage() {
  const plans = useSyncExternalStore(
    subscribeToMyPlans,
    getMyPlans,
    getMyPlans
  );

  const favorites = useSyncExternalStore(
    subscribeToFavorites,
    getFavorites,
    getFavorites
  );

  return (
    <main className="flex-1">
      <div className="max-w-[1180px] mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
        My Plans
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        Plans you have saved. Stored locally — clearing your browser data will
        remove this list.
      </p>

      {favorites.length > 0 && (
        <section className="mb-10">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
            <Heart size={14} className="fill-current text-rose-500" />
            Favorites
          </h2>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            {favorites.map((fav) => (
              <li
                key={fav.viewLinkId}
                className="flex items-center gap-4 px-5 py-4 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {fav.title}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    Favorited {formatDate(fav.savedAt)}
                    {fav.encounterId && (
                      <span className="ml-2 text-zinc-400 dark:text-zinc-600">
                        · {fav.encounterId}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/plan/view/${fav.viewLinkId}`}
                    className="px-3 py-1.5 rounded text-sm font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => removeFavorite(fav.viewLinkId)}
                    className="flex items-center justify-center rounded p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    aria-label="Remove from favorites"
                  >
                    <Heart size={16} className="fill-current" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
          Saved Plans
        </h2>
        {plans.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-zinc-400 dark:text-zinc-600">
            No plans yet. Create or save a plan to see it here.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className="flex items-center gap-4 px-5 py-4 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {plan.title}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    Saved {formatDate(plan.savedAt)}
                    {plan.encounterId && (
                      <span className="ml-2 text-zinc-400 dark:text-zinc-600">
                        · {plan.encounterId}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/plan/${plan.editLinkId}`}
                    className="px-3 py-1.5 rounded text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/plan/view/${plan.viewLinkId}`}
                    className="px-3 py-1.5 rounded text-sm font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => removeMyPlan(plan.id)}
                    className="px-3 py-1.5 rounded text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </main>
  );
}
