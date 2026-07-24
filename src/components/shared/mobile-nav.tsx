"use client";
import { useState, useEffect } from "react";
import { Logo } from "./logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV, activeHref, type NavItem } from "./nav";

export function MobileNav({ isAdmin, isSuperAdmin, features }: { isAdmin: boolean; isSuperAdmin: boolean; features: string[] }) {
  const pathname = usePathname();
  const active = activeHref(pathname);
  const [open, setOpen] = useState(false);

  const visible = NAV.filter(
    (i) =>
      (!i.adminOnly || isAdmin) &&
      (!i.superAdminOnly || isSuperAdmin) &&
      (!i.feature || features.includes(i.feature))
  );
  const primary = visible.filter((i) => !i.secondary);
  const secondary = visible.filter((i) => i.secondary);

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const renderLink = ({ href, label, icon: Icon }: NavItem) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        href === active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-64 max-w-[80%] flex-col border-r bg-card shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-5">
              <Logo size="h-6" />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 overflow-y-auto p-3">
              {primary.map(renderLink)}
              {secondary.length > 0 && (
                <div className="mt-2 space-y-1 border-t pt-2">
                  {secondary.map(renderLink)}
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
