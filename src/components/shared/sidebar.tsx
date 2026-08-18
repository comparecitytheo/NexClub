"use client";
import Link from "next/link";
import { Logo } from "./logo";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV, activeHref, type NavItem } from "./nav";
import { SidebarToggle } from "./sidebar-toggle"; // collapse/expand control
import { SidebarClock } from "./sidebar-clock"; // live local date/time at the bottom

export function Sidebar({ isAdmin, isSuperAdmin, features }: { isAdmin: boolean; isSuperAdmin: boolean; features: string[] }) {
  const pathname = usePathname();
  const active = activeHref(pathname);
  const visible = NAV.filter(
    (i) =>
      (!i.adminOnly || isAdmin) &&
      (!i.superAdminOnly || isSuperAdmin) &&
      (!i.feature || features.includes(i.feature))
  );
  const primary = visible.filter((i) => !i.secondary);
  const secondary = visible.filter((i) => i.secondary);

  const renderLink = ({ href, label, icon: Icon }: NavItem) => (
    <Link
      key={href}
      href={href}
      title={label} // native tooltip surfaces the label in icon-only mode
      className={cn(
        // `nav-link` lets CSS center the icon and drop the label when collapsed
        "nav-link flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
        href === active
          ? "bg-white text-primary"
          // Follows the theme rather than being fixed white, so a light menu
          // colour does not leave the nav unreadable.
          : "text-sidebar-foreground hover:bg-sidebar-foreground hover:text-sidebar"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {/* `nav-label` is the text hidden by CSS when collapsed */}
      <span className="nav-label">{label}</span>
    </Link>
  );

  return (
    // `app-sidebar` is the styling hook globals.css uses to collapse this to a
    // 64px icon-only rail when <html> has `sidebar-collapsed`.
      <aside className="app-sidebar hidden w-60 shrink-0 flex-col gap-2.5 bg-transparent p-2.5 lg:flex">
        <div className="sidebar-head flex h-14 shrink-0 items-center rounded-full bg-card px-6 shadow-[0_4px_14px_rgba(0,0,0,0.07)]">
        {/* `brand-full` wordmark is hidden by CSS when collapsed */}
        <Logo swap />
      </div>
      {/* CHANGED: the toggle moved out of the header. It now floats vertically
          centered on the divider (the aside's right border) — see the
          `.sidebar-toggle` rule in globals.css. Kept inside the aside so it
          inherits the aside's `hidden lg:flex` (desktop-only), exactly as before. */}
      <SidebarToggle />
        {/* The menu pill: carries the colour, rounding and shadow. */}
        <div className="sidebar-pill flex min-h-0 flex-1 flex-col rounded-[28px] bg-sidebar shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
      <nav className="space-y-1 p-3">
        {primary.map(renderLink)}
        {/* Secondary nav (NEX Events, Member Directory) sits beneath the
            baseline items, separated by a divider. */}
        {secondary.length > 0 && (
          <div className="nav-secondary mt-2 space-y-1 border-t border-white/15 pt-2">
            {secondary.map(renderLink)}
          </div>
        )}
      </nav>
      <SidebarClock />
        </div>
    </aside>
  );
}
