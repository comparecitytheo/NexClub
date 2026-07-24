"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { NotificationType, EntityType } from "@prisma/client";
import { NOTIFICATION_LABELS, NOTIFICATION_COLORS, getNotificationHref } from "@/lib/notifications";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  isRead: boolean;
  entityType: EntityType | null;
  entityId: string | null;
  createdAt: string;
  actor: { name: string } | null;
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      /* ignore transient errors */
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(load, 90_000);
    return () => clearInterval(t);
  }, []);

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  }

  async function openNotif(n: Notif) {
    if (!n.isRead) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      });
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    router.push(getNotificationHref(n));
  }

  // The ring + red pulse are driven solely by the unread count: they play while
  // at least one notification is unread and stop reactively the moment it hits 0.
  const pulsing = unread > 0;

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
        className={cn(
          "notif-bell-btn relative flex h-9 w-9 items-center justify-center overflow-visible rounded-md hover:bg-accent",
          pulsing && "is-flashing"
        )}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      >
        {/* Wrapper carries the pop/scale cue; the inner icon keeps its existing
            shake. Two elements so scale (wrapper) and rotate (icon) compose
            without either overriding the other's `transform`. */}
        <span className={cn("notif-bell-pop", pulsing && "is-popping")}>
          <Bell className={cn("h-5 w-5 text-muted-foreground notif-bell-icon", pulsing && "is-ringing")} />
        </span>
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button onClick={markAll} className="text-xs text-primary hover:underline">Mark all read</button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">You are all caught up.</p>
              ) : (
                items.slice(0, 12).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openNotif(n)}
                    aria-label={`${NOTIFICATION_LABELS[n.type]}: ${n.title}${n.isRead ? "" : ", unread"}`}
                    className={cn(
                      "flex w-full gap-2.5 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/50",
                      !n.isRead && "bg-muted/40"
                    )}
                  >
                    {/* Type indicator: a dot in this alert type's semantic color */}
                    <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", NOTIFICATION_COLORS[n.type].dot)} />
                    <div className="min-w-0">
                      <p className={cn("text-sm", n.isRead ? "font-medium" : "font-semibold")}>{n.title}</p>
                      {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-0.5 text-[11px]">
                        {/* Colored type label reinforces the dot's color → type mapping */}
                        <span className={cn("font-medium", NOTIFICATION_COLORS[n.type].label)}>
                          {NOTIFICATION_LABELS[n.type]}
                        </span>
                        <span className="text-muted-foreground"> · {formatRelative(n.createdAt)}</span>
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="border-t px-4 py-2 text-center">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/notifications");
                }}
                className="text-xs text-primary hover:underline"
              >
                View all
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
