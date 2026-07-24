import { ShieldCheck } from "lucide-react";
import { requireSuperAdminPage } from "@/server/admin/guard";
import { AdminTabs } from "@/components/admin/admin-tabs";

// Guards the entire Super Admin section: non-super-admins are redirected before
// any child page renders. Each /api/admin/* route enforces the same rule (403).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdminPage();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Super Admin</h1>
      </div>
      <AdminTabs />
      {children}
    </div>
  );
}
