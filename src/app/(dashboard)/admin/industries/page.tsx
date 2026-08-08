import { requireSuperAdminPage } from "@/server/admin/guard";
import { listIndustriesWithUsage } from "@/server/industries";
import { IndustryManager } from "@/components/admin/industry-manager";

export default async function AdminIndustriesPage() {
  await requireSuperAdminPage();
  const rows = await listIndustriesWithUsage();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Industries</h2>
        <p className="text-sm text-muted-foreground">
          The list every industry dropdown and the member directory filter reads from.
        </p>
      </div>
      <IndustryManager initial={rows} />
    </div>
  );
}
