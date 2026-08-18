import { ShieldCheck } from "lucide-react";
import { requireSuperAdminPage } from "@/server/admin/guard";
import { AdminTabs } from "@/components/admin/admin-tabs";

// Guards the entire Super Admin section: non-super-admins are redirected before
// any child page renders. Each /api/admin/* route enforces the same rule (403).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdminPage();
  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex items-center gap-2 print:hidden">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Super Admin</h1>
      </div>
        <div className="print:hidden">
          <AdminTabs />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
