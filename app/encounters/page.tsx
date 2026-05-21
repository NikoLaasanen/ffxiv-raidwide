export default function EncountersPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Encounters</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Browse saved encounter presets grouped by raid tier.
      </p>
      <div className="mt-8 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-zinc-400 dark:text-zinc-600">
        Encounter list — search, filter by tier, quick-navigate to plans
      </div>
    </main>
  );
}
