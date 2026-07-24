import {
  LayoutDashboard,
  Inbox,
  Send,
  Share2,
  CheckSquare,
  CalendarDays,
  BookUser,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
  superAdminOnly?: boolean;
  secondary?: boolean;
  // When set, the item is hidden if the module's feature flag is off (see settings).
  feature?: "leads" | "deals" | "contacts" | "companies" | "tasks" | "events";
};

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/leads/new", label: "Send a Lead", icon: Send, adminOnly: false, feature: "leads" },
  { href: "/leads", label: "My Leads", icon: Inbox, adminOnly: false, feature: "leads" },
  { href: "/leads/sent", label: "Sent Leads", icon: Share2, adminOnly: false, feature: "leads" },
  // Tasks sits immediately below Sent Leads in the menu.
  { href: "/tasks", label: "Tasks", icon: CheckSquare, adminOnly: false, feature: "tasks" },
  // Secondary nav: rendered beneath a divider, below the baseline items above.
  { href: "/events", label: "NEX Events", icon: CalendarDays, adminOnly: false, secondary: true, feature: "events" },
  { href: "/directory", label: "Member Directory", icon: BookUser, adminOnly: false, secondary: true },
  // Super Admin panel — visible only to SUPER_ADMIN.
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: false, superAdminOnly: true, secondary: true },
];
// Contacts (/contacts) and Companies (/companies) are intentionally NOT in the
// menu — their pages/routes still exist and remain reachable via deep links
// (e.g. lead/task entity chips), they're just hidden from the main nav.

// Longest-prefix match so /leads/new and /leads/sent win over /leads,
// and a lead detail (/leads/<id>) still highlights "My Leads".
export function activeHref(pathname: string): string | undefined {
  return NAV.filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
