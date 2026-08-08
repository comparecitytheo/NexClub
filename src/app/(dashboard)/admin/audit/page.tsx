import { prisma } from "@/lib/prisma";
import { requireSuperAdminPage } from "@/server/admin/guard";
import { AuditTable, type AuditRow } from "@/components/audit/audit-table";

const PAGE_SIZE = 25;

// Same data + component as the previous standalone /audit page, now mounted as
// the Audit sub-section of the Admin tab. Functionality, filters, pagination and
// the /api/audit calls are unchanged — only the entry point moved.
export default async function AdminAuditPage() {
  const user = await requireSuperAdminPage();

  const [total, items] = await prisma.$transaction([
    prisma.auditLog.count({ where: { organizationId: user.organizationId } }),
    prisma.auditLog.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
    }),
  ]);

  const initial: AuditRow[] = items.map((a) => ({
    id: a.id,
    createdAt: a.createdAt.toISOString(),
    actorName: a.actor?.name ?? null,
    actorId: a.actor?.id ?? null,
    actorAvatarUrl: a.actor?.avatarUrl ?? null,
    ipAddress: a.ipAddress,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    before: a.before,
    after: a.after,
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Every create, update, status change, and assignment across the club.</p>
      <AuditTable initial={initial} initialTotal={total} initialTotalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} />
    </div>
  );
}
