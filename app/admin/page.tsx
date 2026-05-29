import Link from "next/link";

const sections = [
  {
    href: "/admin/abilities",
    title: "Abilities",
    description: "Fetch job abilities from XIVAPI and manage mitigation values.",
  },
  {
    href: "/admin/encounters",
    title: "Encounters",
    description: "Create and edit encounter presets for the planner.",
  },
];

export default function AdminPage() {
  return (
    <main className="flex-1">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-1">Admin</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">Select a section to manage.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="block rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <div className="font-semibold mb-1">{s.title}</div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">{s.description}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
