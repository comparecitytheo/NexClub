import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac";

// Server guard for every Super Admin *page*. Non-super-admins never render the
// panel — they're redirected to their normal dashboard. (The /api/admin/*
// endpoints separately return 403 via requireSuperAdmin; the UI guard is not the
// security boundary, the API check is.) Returns the session user for the page.
export async function requireSuperAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isSuperAdmin(session.user.role)) redirect("/dashboard");
  return session.user;
}
