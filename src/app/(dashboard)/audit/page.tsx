import { redirect } from "next/navigation";

// The audit log moved into the Admin tab. Preserve old links/bookmarks by
// redirecting; the /admin layout enforces access (Super Admin).
export default function AuditRedirectPage() {
  redirect("/admin/audit");
}
