import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { isAdmin, isSuperAdmin } from "@/lib/rbac";
import { colleagueIdsFor } from "@/server/businesses";
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
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const admin = isAdmin(user.role);

  // Shared date-range filter (?range=7|30|90 or ?from&to); default 30 days.
  const sp = await searchParams;
  const rangeParams = readRangeParams(sp);
  const { from, to } = resolveDateRange(rangeParams);

  // Which tab to open (?view=received|sent|all), default received. Scoping is
  // per-user for everyone including admins: "all" means this member's own leads
  // in both directions, never the club's. Enforced in the query below, so it
  // cannot be widened by editing the URL.
  const rawView = typeof sp.view === "string" ? sp.view : "received";
  const view: "received" | "sent" | "all" | "deleted" =
    rawView === "sent"
      ? "sent"
      : rawView === "all"
        ? "all"
        : rawView === "deleted"
          ? "deleted"
          : "received";
  // `user` is already the member when a Super Admin is in support mode, so this
  // needs no special case: their role, their business, their leads.
  const superAdmin = isSuperAdmin(user.role);

  // BUSINESS-WIDE VISIBILITY. Everyone at a business sees that business's leads,
  // in both directions, so a lead does not leave when the person who handled it
  // does. A Super Admin sees the whole club; nobody else sees another business.
  const team = superAdmin ? null : await colleagueIdsFor(user.id);
  const mine = team ? { in: team } : undefined;

  const scope =
    view === "sent"
      ? { referrerId: mine }
      : view === "all"
        ? { OR: [{ ownerId: mine }, { referrerId: mine }] }
        : view === "deleted"
          ? // A member sees what their business deleted; a Super Admin, the club's.
            { status: "DELETED" as const, ...(superAdmin ? {} : { deletedById: mine }) }
          : { ownerId: mine };

  const [leads, members] = await Promise.all([
    prisma.lead.findMany({
      // The date range applies to every view; on Deleted it filters by WHEN THE
      // LEAD WAS DELETED rather than when it was created, which is what the
      // dates in that table mean. Leaving it unfiltered made the range control
      // visible but inert.
      where: {
        organizationId: user.organizationId,
        ...scope,
        ...(view === "deleted"
          ? { deletedOn: { gte: from, lte: to } }
          : { createdAt: { gte: from, lte: to } }),
        // Top-level so it overrides the extension's injected `archivedAt: null`
        // and archived leads are included on this tab.
        ...(view === "deleted" ? { archivedAt: undefined } : {}),
      },
      orderBy: [{ boardPosition: "asc" }, { lastActivityAt: "desc" }],
      include: {
        owner: { select: { id: true, name: true, businessName: true, avatarUrl: true } },
        referrer: { select: { id: true, name: true, avatarUrl: true, businessName: true } },
        deletedBy: { select: { name: true } },
      },
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
    createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : "",
    referrerBusinessName: l.referrer.businessName,
    ownerBusinessName: l.owner.businessName,
    ownerAvatarUrl: l.owner.avatarUrl,
    priority: l.priority,
    deletedOn: l.deletedOn?.toISOString() ?? null,
    deletedByName: l.deletedBy?.name ?? null,
    statusBeforeDelete: l.statusBeforeDelete,
    archivedAt: l.archivedAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Leads</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker {...rangeParams} />
          <CsvTools exportHref="/api/leads/export" importEndpoint="/api/leads/import" canExport={isSuperAdmin(user.role)} />
          <Button asChild>
            <Link href="/leads/new">
              <Plus className="h-4 w-4" /> Send a lead
            </Link>
          </Button>
        </div>
      </div>
      <LeadBoard
        initialLeads={initialLeads}
        currentUserId={user.id}
        isAdmin={admin}
        isSuperAdmin={superAdmin}
        defaultView={view}
        members={members}
        rangeFrom={from.toISOString()}
        rangeTo={to.toISOString()}
      />
    </div>
  );
}
