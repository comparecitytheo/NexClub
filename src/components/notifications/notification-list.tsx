import { MemberAvatar } from "@/components/shared/member-avatar";
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NotificationType, EntityType } from "@prisma/client";
import { NOTIFICATION_LABELS, NOTIFICATION_COLORS, getNotificationHref } from "@/lib/notifications";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type NotifItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  isRead: boolean;
  entityType: EntityType | null;
  entityId: string | null;
  createdAt: string;
  actorName: string | null;
  actorId?: string | null;
  actorAvatarUrl?: string | null;
};

export function NotificationList({ initial }: { initial: NotifItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<NotifItem[]>(initial);

  // Re-seed from the server when the header refresh re-renders this page.
  // useState ignores later prop changes, so without this the view kept its
  // first render forever and the refresh button appeared to do nothing.
  useEffect(() => {
    setItems(initial);
  }, [initial]);
  const unread = items.filter((n) => !n.isRead).length;

  async function markAll() {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) {
      toast.error("Could not update notifications.");
      return;
    }
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    router.refresh();
  }

  async function open(n: NotifItem) {
    if (!n.isRead) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      });
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    router.push(getNotificationHref(n));
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg bg-card p-10 text-center text-sm text-muted-foreground border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        No notifications yet. You will hear about leads sent to you and tasks assigned to you here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{unread} unread</span>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAll}>Mark all read</Button>
        )}
      </div>
      <ul className="overflow-hidden rounded-lg bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        {items.map((n) => {
          return (
            <li key={n.id}>
              <button
                onClick={() => open(n)}
                aria-label={`${NOTIFICATION_LABELS[n.type]}: ${n.title}${n.isRead ? "" : ", unread"}`}
                className={cn(
                  "flex w-full gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/50",
                  !n.isRead && "bg-muted/40"
                )}
              >
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", NOTIFICATION_COLORS[n.type].dot)} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", n.isRead ? "font-medium" : "font-semibold")}>{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-0.5 text-xs">
                    <span className={cn("font-medium", NOTIFICATION_COLORS[n.type].label)}>
                      {NOTIFICATION_LABELS[n.type]}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      {n.actorName && (
                        <>
                          {" · "}
                          {/* Who triggered it, with their face. */}
                          <MemberAvatar
                            userId={n.actorId ?? ""}
                            name={n.actorName}
                            avatarUrl={n.actorAvatarUrl ?? null}
                            className="h-4 w-4"
                          />
                          {n.actorName}
                        </>
                      )}
                      {" · "}
                      {formatRelative(n.createdAt)}
                    </span>
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
