import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { CsvTools } from "@/components/shared/csv-tools";
import { LeadBoard } from "@/components/leads/lead-board";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { readRangeParams, resolveDateRange } from "@/lib/date-range";
import type { BoardLead } from "@/components/leads/lead-card";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const admin = isAdmin(user.role);

  // Shared date-range filter (?range=7|30|90 or ?from&to); default 30 days.
  const rangeParams = readRangeParams(await searchParams);
  const { from, to } = resolveDateRange(rangeParams);

  // Default view is "received": leads assigned to the current member.
  const [leads, members] = await Promise.all([
    prisma.lead.findMany({
      where: { organizationId: user.organizationId, ownerId: user.id, createdAt: { gte: from, lte: to } },
      orderBy: [{ boardPosition: "asc" }, { lastActivityAt: "desc" }],
      include: { owner: { select: { id: true, name: true } }, referrer: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const initialLeads: BoardLead[] = leads.map((l) => ({
    id: l.id,
    contactName: l.contactName,
    company: l.company,
    email: l.email,
    phone: l.phone,
    industry: l.industry,
    valueEstimate: l.valueEstimate == null ? null : Number(l.valueEstimate),
    notes: l.notes,
    status: l.status,
    source: l.source,
    followUpDate: l.followUpDate ? l.followUpDate.toISOString() : null,
    boardPosition: l.boardPosition,
    ownerId: l.ownerId,
    ownerName: l.owner.name,
    referrerId: l.referrerId,
    referrerName: l.referrer.name,
    referrerAvatarUrl: l.referrer.avatarUrl,
    priority: l.priority,
  }));

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Leads</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker {...rangeParams} />
          <CsvTools exportHref="/api/leads/export" importEndpoint="/api/leads/import" />
          <Button asChild>
            <Link href="/leads/new">
              <Plus className="h-4 w-4" /> Send a lead
            </Link>
          </Button>
        </div>
      </div>
      <LeadBoard initialLeads={initialLeads} currentUserId={user.id} isAdmin={admin} defaultView="received" members={members} />
    </div>
  );
}
