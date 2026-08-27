import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { ownerScope } from "@/server/scope";
import { cn } from "@/lib/utils";
import { DEAL_STAGE_LABELS, DEAL_STAGE_DOT } from "@/lib/labels";
import { formatCurrency, formatDate, formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DealForm } from "@/components/deals/deal-form";
import { LogActivity } from "@/components/activities/log-activity";
import { isAiConfigured } from "@/server/ai";
import { AiPanel } from "@/components/ai/ai-panel";
import { DealInsights } from "@/components/ai/deal-insights";
import { EmailWriter } from "@/components/ai/email-writer";
import { MeetingNotes } from "@/components/ai/meeting-notes";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  const deal = await prisma.deal.findFirst({
    where: { id, ...ownerScope(session.user) },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      owner: { select: { id: true, name: true } },
      activityEntries: { orderBy: { occurredAt: "desc" }, take: 20, include: { user: { select: { name: true } } } },
      taskEntries: {
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: { dueDate: "asc" },
        take: 10,
        include: { assignee: { select: { name: true } } },
      },
    },
  });
  if (!deal) notFound();

  const [companies, contacts] = await Promise.all([
    prisma.company.findMany({ where: ownerScope(session.user), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.contact.findMany({ where: ownerScope(session.user), orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const contactOptions = contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));
  const aiEnabled = isAiConfigured();

  const initial = {
    name: deal.name,
    companyId: deal.companyId ?? "",
    contactId: deal.contactId ?? "",
    value: String(Number(deal.value)),
    stage: deal.stage,
    probability: String(deal.probability),
    expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.toISOString().slice(0, 10) : "",
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/deals" className="text-sm text-muted-foreground hover:text-foreground">← Deals</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{deal.name}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium">
            <span className={cn("h-2 w-2 rounded-full", DEAL_STAGE_DOT[deal.stage])} />
            {DEAL_STAGE_LABELS[deal.stage]}
          </span>
          <span className="text-sm font-semibold text-primary">{formatCurrency(Number(deal.value))}</span>
          {deal.isWon === true && <Badge variant="success">Won</Badge>}
          {deal.isWon === false && <Badge variant="muted">Lost</Badge>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
            <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Overview</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Field label="Company" value={deal.company?.name ?? null} />
              <Field label="Contact" value={deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : null} />
              <Field label="Owner" value={deal.owner?.name ?? null} />
              <Field label="Probability" value={`${deal.probability}%`} />
              <Field label="Expected close" value={deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "—"} />
              <Field label="Created" value={formatDate(deal.createdAt)} />
            </dl>
          </section>

          <section className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">Open tasks</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/tasks/new?entityType=DEAL&entityId=${deal.id}`}>
                  <Plus className="h-4 w-4" /> New task
                </Link>
              </Button>
            </div>
            {deal.taskEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open tasks for this deal.</p>
            ) : (
              <ul className="divide-y">
                {deal.taskEntries.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/tasks/${t.id}`} className="font-medium hover:text-primary">{t.title}</Link>
                    <span className="text-xs text-muted-foreground">
                      {t.assignee.name}{t.dueDate ? ` · ${formatDate(t.dueDate)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
            <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Activity</h2>
            <LogActivity entityType="DEAL" entityId={deal.id} />
            <div className="mt-5 border-t pt-4">
              {deal.activityEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ul className="space-y-3">
                  {deal.activityEntries.map((act) => (
                    <li key={act.id} className="flex gap-3 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      <div>
                        <p>{act.subject}</p>
                        {act.body && <p className="text-xs text-muted-foreground">{act.body}</p>}
                        <p className="text-xs text-muted-foreground">{act.user.name} · {formatRelative(act.occurredAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Edit deal</h2>
          <DealForm companies={companies} contacts={contactOptions} initial={initial} id={deal.id} />
        </aside>
      </div>

      {aiEnabled ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <AiPanel title="Deal insights">
            <DealInsights dealId={deal.id} />
          </AiPanel>
          <AiPanel title="Draft an email">
            <EmailWriter entityType="DEAL" entityId={deal.id} />
          </AiPanel>
          <AiPanel title="Meeting notes">
            <MeetingNotes entityType="DEAL" entityId={deal.id} />
          </AiPanel>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          AI features are off — set ANTHROPIC_API_KEY to enable deal insights, email drafting, and meeting-note summaries.
        </p>
      )}
    </div>
  );
}
