"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/settings", label: "Settings" },
  // Members, Businesses and Chapters are the three membership-structure
  // sections and read as siblings, so they sit adjacent. Settings and the
  // reference lists follow.
  { href: "/admin/users", label: "Members" },
  { href: "/admin/businesses", label: "Businesses" },
  { href: "/admin/industries", label: "Industries" },
  { href: "/admin/chapters", label: "Chapters" },
  { href: "/admin/reports", label: "Reporting" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminTabs() {
  const pathname = usePathname();
  const active = TABS.filter((t) => pathname === t.href || pathname.startsWith(t.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <div className="flex flex-wrap gap-1 border-b">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            t.href === active
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
