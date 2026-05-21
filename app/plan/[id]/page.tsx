export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Plan Editor</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Plan ID: <code className="font-mono text-sm">{id}</code>
      </p>
      <div className="mt-8 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-zinc-400 dark:text-zinc-600">
        Vertical timeline — mitigation assignment, cooldown logic, mistake overlays
      </div>
    </main>
  );
}
