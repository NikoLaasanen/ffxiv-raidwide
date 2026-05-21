export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Plan Comparison</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Plan ID: <code className="font-mono text-sm">{id}</code> — overlay actual FFLogs execution on the planned timeline.
      </p>
      <div className="mt-8 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-zinc-400 dark:text-zinc-600">
        Drift detection, missed cooldowns, early/late usage, per-player summary
      </div>
    </main>
  );
}
