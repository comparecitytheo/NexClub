import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SentLeadBoard } from "@/components/leads/sent-lead-board";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { readRangeParams, resolveDateRange } from "@/lib/date-range";
import type { SentBoardLead } from "@/components/leads/sent-lead-card";

export default async function LeadsSentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Shared date-range filter (?range=7|30|90 or ?from&to); default 30 days.
  const rangeParams = readRangeParams(await searchParams);
  const { from, to } = resolveDateRange(rangeParams);

  const [rows, members] = await Promise.all([
    prisma.lead.findMany({
      where: { organizationId: session.user.organizationId, referrerId: session.user.id, createdAt: { gte: from, lte: to } },
      orderBy: { dateReceived: "desc" },
      select: {
        id: true, contactName: true, company: true, email: true, phone: true, valueEstimate: true, notes: true, status: true, priority: true, followUpDate: true, createdAt: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { taskEntries: true, noteEntries: true } },
      },
    }),
    prisma.user.findMany({
      where: { organizationId: session.user.organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const leads: SentBoardLead[] = rows.map((l) => ({
    id: l.id,
    contactName: l.contactName,
    company: l.company,
    email: l.email,
    phone: l.phone,
    valueEstimate: l.valueEstimate == null ? null : Number(l.valueEstimate),
    notes: l.notes,
    status: l.status,
    priority: l.priority,
    followUpDate: l.followUpDate ? l.followUpDate.toISOString() : null,
    createdAt: l.createdAt.toISOString(),
    ownerId: l.owner.id,
    ownerName: l.owner.name,
    ownerAvatarUrl: l.owner.avatarUrl,
    taskCount: l._count.taskEntries,
    commentCount: l._count.noteEntries,
  }));

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sent Leads</h1>
        </div>
        <DateRangePicker {...rangeParams} />
      </div>

      <SentLeadBoard initialLeads={leads} members={members} currentUserId={session.user.id} />
    </div>
  );
}
