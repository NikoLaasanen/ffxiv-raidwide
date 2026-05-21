export default function LibraryPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Ability Library</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        View and toggle mitigation abilities per job.
      </p>
      <div className="mt-8 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-zinc-400 dark:text-zinc-600">
        Ability list per job — enable/disable columns, edit metadata
      </div>
    </main>
  );
}
