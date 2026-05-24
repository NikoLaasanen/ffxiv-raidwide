"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

const navLinks = [
  { href: "/my-plans", label: "My Plans" },
  { href: "/encounters", label: "Encounters" },
  { href: "/library", label: "Library" },
];

export default function Header() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="border-b border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 h-14 flex items-center gap-8">
        <Link
          href="/"
          className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-slate-100"
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
                  ? "bg-zinc-100 dark:bg-slate-800 text-zinc-900 dark:text-slate-100 font-medium"
                  : "text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-100"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          {mounted && (
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="p-2 rounded text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-100 hover:bg-zinc-100 dark:hover:bg-slate-800 transition-colors"
            >
              {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
