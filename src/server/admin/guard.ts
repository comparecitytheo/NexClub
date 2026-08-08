import { redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { isSuperAdmin } from "@/lib/rbac";

// Server guard for every Super Admin *page*. Non-super-admins never render the
// panel — they're redirected to their normal dashboard. (The /api/admin/*
// endpoints separately return 403 via requireSuperAdmin; the UI guard is not the
// security boundary, the API check is.) Returns the session user for the page.
export async function requireSuperAdminPage() {
  // Uses the EFFECTIVE identity, so a Super Admin in support mode is held to the
  // member's permissions — a business admin genuinely cannot see this panel. The
  // way out is the support banner, which renders on every dashboard page.
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");
  if (!isSuperAdmin(session.user.role)) redirect("/dashboard");
  return session.user;
}
