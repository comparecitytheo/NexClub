import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPage } from "@/server/admin/guard";
import { requireFeature } from "@/server/admin/features";
import { EventForm } from "@/components/events/event-form";

// Super Admin only — the guard redirects everyone else, and PATCH /api/events/[id]
// separately returns 403, which is the real boundary.
export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSuperAdminPage();
  await requireFeature(user.organizationId, "events");
  const { id } = await params;

  const event = await prisma.event.findFirst({
    where: { id, organizationId: user.organizationId },
    select: {
      id: true, title: true, description: true, location: true,
      startsAt: true, endsAt: true,
    },
  });
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit event</h1>
        <p className="text-sm text-muted-foreground">
          Update the details. Members already know about this event, so saving
          does not notify them again.
        </p>
      </div>
      <EventForm
        initial={{
          id: event.id,
          title: event.title,
          description: event.description ?? "",
          location: event.location ?? "",
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt?.toISOString() ?? "",
        }}
      />
    </div>
  );
}
