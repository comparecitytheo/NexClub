import Link from "next/link";
import { Users, UserCheck, MailWarning, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPage } from "@/server/admin/guard";
import { StatCard } from "@/components/dashboard/stat-card";
import { ROLE_LABELS } from "@/lib/roles";
import { formatDate, formatRelative } from "@/lib/format";

export default async function AdminOverviewPage() {
  const user = await requireSuperAdminPage();
  const orgId = user.organizationId;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers, activeUsers, pendingSetup, newThisWeek, recentSignups, recentAudit] = await prisma.$transaction([
    prisma.user.count({ where: { organizationId: orgId } }),
    prisma.user.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.user.count({ where: { organizationId: orgId, hashedPassword: null } }),
    prisma.user.count({ where: { organizationId: orgId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, entityType: true, entityId: true, createdAt: true, actor: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6 card-heading-accent">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total members" value={String(totalUsers)} icon={Users} />
        <StatCard title="Active" value={String(activeUsers)} hint={`${totalUsers - activeUsers} inactive`} icon={UserCheck} tone="emerald" />
        <StatCard title="Pending setup" value={String(pendingSetup)} hint="invited, no password yet" icon={MailWarning} tone={pendingSetup > 0 ? "rose" : "default"} />
        <StatCard title="New this week" value={String(newThisWeek)} hint="joined in last 7 days" icon={UserPlus} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent signups</h3>
            <Link href="/admin/users" className="text-xs text-muted-foreground hover:text-primary">All members</Link>
          </div>
          {recentSignups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <ul className="divide-y">
              {recentSignups.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-primary">{u.name}</Link>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium">{ROLE_LABELS[u.role]}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent activity</h3>
            <Link href="/admin/audit" className="text-xs text-muted-foreground hover:text-primary">Full audit log</Link>
          </div>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {recentAudit.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{e.actor?.name ?? "System"}</span>
                    <span className="text-muted-foreground"> · {e.action.toLowerCase()} {e.entityType}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
