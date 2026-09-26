"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/requirements", label: "Requirements" },
  { href: "/oems", label: "OEMs" },
  { href: "/quotes", label: "Quotes" },
  { href: "/orders", label: "Orders" },
  { href: "/followups", label: "Follow-ups" },
  { href: "/finance", label: "Finance" },
  { href: "/documents", label: "Documents" },
  { href: "/search", label: "Search" },
  { href: "/admin", label: "Admin" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
