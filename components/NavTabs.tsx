"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-4">
      {tabs.map((t) => {
        const active = t.href === "/" ? path === "/" : path === t.href || path.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href}
            className={`whitespace-nowrap border-b-[3px] px-3 py-2 text-sm ${active ? "border-brand font-semibold text-ink" : "border-transparent text-muted hover:border-line hover:text-ink"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
