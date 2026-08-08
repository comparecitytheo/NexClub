import Link from "next/link";
import { redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import { activityScope } from "@/server/scope";
import { ACTIVITY_TYPE_LABELS } from "@/lib/labels";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

function entityChip(a: {
  lead: { id: string; contactName: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  company: { id: string; name: string } | null;
  deal: { id: string; name: string } | null;
}): { label: string; href: string } | null {
  if (a.lead) return { label: a.lead.contactName, href: `/leads/${a.lead.id}` };
  if (a.contact) return { label: `${a.contact.firstName} ${a.contact.lastName}`, href: `/contacts/${a.contact.id}` };
  if (a.company) return { label: a.company.name, href: `/companies/${a.company.id}` };
  if (a.deal) return { label: a.deal.name, href: `/deals/${a.deal.id}` };
  return null;
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const admin = isAdmin(user.role);
  const sp = await searchParams;
  const scope = sp.scope === "all" && admin ? "all" : "mine";

  const activities = await prisma.activity.findMany({
    where: scope === "all" ? { organizationId: user.organizationId } : activityScope(user),
    orderBy: { occurredAt: "desc" },
    take: 50,
    include: {
      user: { select: { name: true } },
      lead: { select: { id: true, contactName: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      deal: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Activity</h1>
          <p className="text-sm text-muted-foreground">Recent calls, emails, meetings, and notes.</p>
        </div>
        {admin && (
          <div className="inline-flex rounded-lg bg-card p-0.5 text-sm border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
            <Link
              href="/activity"
              className={cn("rounded-md px-3 py-1.5 font-medium", scope === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Mine
            </Link>
            <Link
              href="/activity?scope=all"
              className={cn("rounded-md px-3 py-1.5 font-medium", scope === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Whole club
            </Link>
          </div>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="rounded-lg bg-card p-10 text-center text-sm text-muted-foreground border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          No activity yet. Log a call, email, or meeting from any record.
        </div>
      ) : (
        <ul className="space-y-3">
          {activities.map((a) => {
            const chip = entityChip(a);
            return (
              <li key={a.id} className="flex gap-3 rounded-lg bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
                <span className="mt-1 inline-flex h-7 shrink-0 items-center rounded-md bg-muted px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {ACTIVITY_TYPE_LABELS[a.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.subject}</p>
                  {a.body && <p className="mt-0.5 text-sm text-muted-foreground">{a.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.user.name} · {formatRelative(a.occurredAt)}
                    {chip && (
                      <>
                        {" · "}
                        <Link href={chip.href} className="hover:text-primary">{chip.label}</Link>
                      </>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
