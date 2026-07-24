import { AdminUsers } from "@/components/admin/admin-users";

// Data is fetched client-side from /api/admin/users (all Super-Admin-guarded);
// the /admin layout already blocks non-super-admins from rendering this.
export default function AdminUsersPage() {
  return <AdminUsers />;
}
