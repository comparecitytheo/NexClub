import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { requireFeature } from "@/server/admin/features";
import { EventList, type ClubEventRow } from "@/components/events/event-list";

export default async function EventsPage() {
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");
  const user = session.user;
  // Feature flag takes effect: if the events module is disabled, block the page.
  await requireFeature(user.organizationId, "events");

  const canManage = isSuperAdmin(user.role);

  const events = await prisma.event.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { startsAt: "asc" },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      rsvps: {
        select: {
          userId: true,
          status: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { user: { name: "asc" } },
      },
    },
  });

  const rows: ClubEventRow[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt?.toISOString() ?? null,
    createdBy: { id: e.createdBy.id, name: e.createdBy.name, avatarUrl: e.createdBy.avatarUrl },
    goingCount: e.rsvps.filter((r) => r.status === "GOING").length,
    myRsvp: (e.rsvps.find((r) => r.userId === user.id)?.status as ClubEventRow["myRsvp"]) ?? null,
    // Who responded. Sent to Super Admins only — ordinary members see the count,
    // not a list of who declined.
    going: canManage
      ? e.rsvps.filter((r) => r.status === "GOING").map((r) => r.user)
      : [],
    notGoing: canManage
      ? e.rsvps.filter((r) => r.status === "NOT_GOING").map((r) => r.user)
      : [],
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">NEX Events</h1>
          <p className="text-sm text-muted-foreground">
            Club events, networking nights, and member meetups.
          </p>
        </div>
        {/* Only Super Admins can add events; the API enforces the same rule. */}
        {canManage && (
          <Button asChild>
            <Link href="/events/new">
              <Plus className="h-4 w-4" /> New event
            </Link>
          </Button>
        )}
      </div>
      {/* One component owns the panel and the RSVP state; the calendar is
          rendered inside it so clicking either surface opens the same detail. */}
      <EventList events={rows} canManage={canManage} currentUserId={user.id} />
    </div>
  );
}
