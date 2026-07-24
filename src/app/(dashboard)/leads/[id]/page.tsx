import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_SOURCE_LABELS } from "@/lib/labels";
import { formatCurrency, formatDate, formatRelative } from "@/lib/format";
import { LeadActions, type LeadActionData } from "@/components/leads/lead-actions";
import { isAiConfigured } from "@/server/ai";
import { AiPanel } from "@/components/ai/ai-panel";
import { EmailWriter } from "@/components/ai/email-writer";
import { SummaryBox } from "@/components/ai/summary-box";
import { EntityTasksPanel } from "@/components/tasks/entity-tasks-panel";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const admin = isAdmin(user.role);

  const lead = await prisma.lead.findFirst({
    where: {
      id,
      organizationId: user.organizationId,
      ...(admin ? {} : { OR: [{ ownerId: user.id }, { referrerId: user.id }] }),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      referrer: { select: { id: true, name: true, email: true } },
      activityEntries: {
        orderBy: { occurredAt: "desc" },
        take: 25,
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!lead) notFound();

  const members = await prisma.user.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const isOwner = lead.ownerId === user.id;
  const isReferrer = lead.referrerId === user.id;
  const canEdit = admin || isOwner;
  const canReassign = admin || isReferrer;
  const canDelete = admin || isReferrer;
  const aiEnabled = isAiConfigured();

  const actionData: LeadActionData = {
    id: lead.id,
    contactName: lead.contactName,
    company: lead.company,
    phone: lead.phone,
    email: lead.email,
    industry: lead.industry,
    valueEstimate: lead.valueEstimate == null ? null : Number(lead.valueEstimate),
    source: lead.source,
    status: lead.status,
    followUpDate: lead.followUpDate ? lead.followUpDate.toISOString() : null,
    notes: lead.notes,
    converted: Boolean(lead.convertedAt),
    ownerId: lead.ownerId,
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="text-sm text-muted-foreground hover:text-foreground">← Leads</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{lead.contactName}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LEAD_STATUS_COLORS[lead.status].bg }} />
            {LEAD_STATUS_LABELS[lead.status]}
          </span>
          {lead.valueEstimate != null && (
            <span className="text-sm font-semibold text-primary">{formatCurrency(Number(lead.valueEstimate))}</span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
            <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Overview</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Field label="Company" value={lead.company} />
              <Field label="Industry" value={lead.industry} />
              <Field label="Email" value={lead.email} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Source" value={LEAD_SOURCE_LABELS[lead.source]} />
              <Field label="Sent by" value={lead.referrer.name} />
              <Field label="Assigned to" value={lead.owner.name} />
              <Field label="Received" value={formatDate(lead.dateReceived)} />
              <Field label="Follow-up" value={lead.followUpDate ? formatDate(lead.followUpDate) : "—"} />
            </dl>
            {lead.notes && (
              <div className="mt-4 border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{lead.notes}</p>
              </div>
            )}
          </section>

          <section className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
            <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Activity</h2>
            {lead.activityEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {lead.activityEntries.map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <div>
                      <p>{a.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.user.name} · {formatRelative(a.occurredAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <EntityTasksPanel entityType="LEAD" entityId={lead.id} currentUserId={user.id} />
        </div>

        <aside className="h-fit rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Manage</h2>
          <LeadActions
            lead={actionData}
            members={members}
            canEdit={canEdit}
            canReassign={canReassign}
            canDelete={canDelete}
          />
        </aside>
      </div>

      {aiEnabled ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <AiPanel title="Draft an email">
            <EmailWriter entityType="LEAD" entityId={lead.id} />
          </AiPanel>
          <AiPanel title="Quick summary">
            <SummaryBox entityType="LEAD" entityId={lead.id} />
          </AiPanel>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          AI features are off — set ANTHROPIC_API_KEY to enable lead scoring, email drafting, and summaries.
        </p>
      )}
    </div>
  );
}
