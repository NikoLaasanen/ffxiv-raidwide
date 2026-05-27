"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Plus } from "lucide-react";

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
    <header className="border-b border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
      <div className="mx-auto max-w-[1280px] px-6 h-[60px] flex items-center gap-5">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/raidwide-logo-animated.svg" width={28} height={28} alt="" aria-hidden="true" className="block shrink-0" />
          <span className="text-[14.5px] font-semibold tracking-tight text-zinc-900 dark:text-slate-100 leading-none">
            FFXIV Raidwide
          </span>
        </Link>

        {/* Divider */}
        <span className="w-px h-[18px] bg-zinc-200 dark:bg-slate-800 shrink-0" />

        {/* Nav */}
        <nav className="flex items-center gap-0.5">
          {navLinks.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-[13.5px] transition-colors ${
                  active
                    ? "bg-zinc-100 dark:bg-slate-800 text-zinc-900 dark:text-slate-100 font-medium"
                    : "text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-100"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* ⌘K search shortcut — visual only */}
        <button
          type="button"
          aria-label="Search plans and encounters (coming soon)"
          disabled
          className="hidden md:inline-flex items-center gap-2 h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-zinc-400 dark:text-slate-500 text-[12.5px] min-w-[200px] cursor-not-allowed select-none"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/>
          </svg>
          <span className="flex-1 text-left">Search plans, encounters…</span>
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-slate-800 text-zinc-400 dark:text-slate-500 font-mono text-[10.5px] font-medium">
            ⌘K
          </span>
        </button>

        {/* + New plan */}
        <Link
          href="/encounters"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:opacity-90 transition-opacity no-underline"
        >
          <Plus size={14} />
          New plan
        </Link>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-zinc-500 dark:text-slate-400 inline-flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-slate-800 transition-colors"
          >
            {resolvedTheme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        )}
      </div>
    </header>
  );
}
