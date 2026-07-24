import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EventsCalendar } from "@/components/events/events-calendar";
import { requireFeature } from "@/server/admin/features";

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Feature flag takes effect: if the events module is disabled, block the page.
  await requireFeature(session.user.organizationId, "events");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">NEX Events</h1>
        <p className="text-sm text-muted-foreground">
          Club events, networking nights, and member meetups.
        </p>
      </div>
      <EventsCalendar />
    </div>
  );
}
