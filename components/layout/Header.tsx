"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/my-plans", label: "My Plans" },
  { href: "/encounters", label: "Encounters" },
  { href: "/library", label: "Library" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-6 h-14 flex items-center gap-8">
        <Link
          href="/"
          className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          FFXIV Raidwide
        </Link>
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                pathname === href
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
