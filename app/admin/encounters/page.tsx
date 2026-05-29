import Link from "next/link";
import EncounterAdmin from "@/app/admin/EncounterAdmin";

export default function EncountersAdminPage() {
  return (
    <main className="flex-1 overflow-x-auto">
      <div className="max-w-[1180px] min-w-[900px] mx-auto px-6 py-10">
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          <Link href="/admin" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            Admin
          </Link>
          <span>/</span>
          <span className="text-zinc-900 dark:text-zinc-100">Encounters</span>
        </div>

        <h1 className="text-2xl font-bold mb-8">Encounters</h1>
        <EncounterAdmin />
      </div>
    </main>
  );
}
