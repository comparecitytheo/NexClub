import Link from "next/link";
import { Send, Inbox } from "lucide-react";
import { getMemberMetrics } from "@/server/metrics";
import { prisma } from "@/lib/prisma";
import { formatRelative } from "@/lib/format";
import { ACTIVITY_TYPE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/labels";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { StatCard } from "./stat-card";
import { BarCard } from "./bar-card";
import { TeamActivity } from "./team-activity";

type Linked = {
  lead: { id: string; contactName: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  company: { id: string; name: string } | null;
  deal: { id: string; name: string } | null;
};

function chip(a: Linked): { label: string; href: string } | null {
  if (a.lead) return { label: a.lead.contactName, href: `/leads/${a.lead.id}` };
  if (a.contact) return { label: `${a.contact.firstName} ${a.contact.lastName}`, href: `/contacts/${a.contact.id}` };
  if (a.company) return { label: a.company.name, href: `/companies/${a.company.id}` };
  if (a.deal) return { label: a.deal.name, href: `/deals/${a.deal.id}` };
  return null;
}

export async function MemberDashboard({ userId, organizationId }: { userId: string; organizationId: string }) {
  // Independent queries — run them in parallel rather than sequentially.
  const [m, myLeads] = await Promise.all([
    getMemberMetrics(userId, organizationId),
    prisma.lead.findMany({
      where: {
        organizationId,
        ownerId: userId,
        referrerId: { not: userId },
        status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
      },
      orderBy: { dateReceived: "desc" },
      take: 6,
      select: {
        id: true, contactName: true, company: true, status: true,
        referrer: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="Leads received" value={String(m.leadsReceived)} hint={`${m.leadsActive} still active`} icon={Send} />
        <StatCard title="Active leads" value={String(m.leadsActive)} hint={`${m.leadsWon} closed / won`} icon={Inbox} />
      </div>

      <div className="grid gap-4">
        <BarCard title="My lead pipeline" data={m.leadStatusData} format="number" />
      </div>

      <section className="rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">My Leads</h3>
          <Link href="/leads" className="text-xs text-muted-foreground hover:text-primary">Open board</Link>
        </div>
        {myLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leads have been sent to you yet.</p>
        ) : (
          <ul className="divide-y">
            {myLeads.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5 text-sm">
                <MemberAvatar userId={l.referrer.id} name={l.referrer.name} avatarUrl={l.referrer.avatarUrl} className="h-7 w-7" />
                <div className="min-w-0 flex-1">
                  <Link href={`/leads/${l.id}`} className="font-medium hover:text-primary">{l.contactName}</Link>
                  <p className="truncate text-xs text-muted-foreground">
                    from {l.referrer.name}{l.company ? ` · ${l.company}` : ""}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LEAD_STATUS_COLORS[l.status].bg }} />
                  {LEAD_STATUS_LABELS[l.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent activity</h3>
          <Link href="/activity" className="text-xs text-muted-foreground hover:text-primary">View all</Link>
        </div>
        {m.recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {m.recentActivity.map((a) => {
              const c = chip(a);
              return (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded bg-muted px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {ACTIVITY_TYPE_LABELS[a.type]}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate">{a.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelative(a.occurredAt)}
                      {c && (
                        <>
                          {" · "}
                          <Link href={c.href} className="hover:text-primary">{c.label}</Link>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <TeamActivity organizationId={organizationId} isAdmin={false} />
    </div>
  );
}
