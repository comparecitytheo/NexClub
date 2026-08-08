import { redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { NotificationList, type NotifItem } from "@/components/notifications/notification-list";

export default async function NotificationsPage() {
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { recipientId: session.user.id, organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
  });

  const initial: NotifItem[] = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    entityType: n.entityType,
    entityId: n.entityId,
    createdAt: n.createdAt.toISOString(),
    actorName: n.actor?.name ?? null,
    actorId: n.actor?.id ?? null,
    actorAvatarUrl: n.actor?.avatarUrl ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-muted-foreground">Leads sent to you, tasks assigned to you, and other updates.</p>
      </div>
      <NotificationList initial={initial} />
    </div>
  );
}
