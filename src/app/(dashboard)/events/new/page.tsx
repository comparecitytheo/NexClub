import { requireSuperAdminPage } from "@/server/admin/guard";
import { requireFeature } from "@/server/admin/features";
import { EventForm } from "@/components/events/event-form";

// Super Admin only — requireSuperAdminPage redirects everyone else, and
// POST /api/events separately returns 403, which is the real boundary.
export default async function NewEventPage() {
  const user = await requireSuperAdminPage();
  await requireFeature(user.organizationId, "events");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New event</h1>
        <p className="text-sm text-muted-foreground">
          Add a club event. Every member is notified when you publish.
        </p>
      </div>
      <EventForm />
    </div>
  );
}
