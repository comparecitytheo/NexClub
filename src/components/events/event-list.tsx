"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, MapPin, Users, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { EventPanel } from "./event-panel";
import { EventsCalendar } from "./events-calendar";

export type Person = { id: string; name: string; avatarUrl: string | null };

export type ClubEventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  createdBy: Person;
  goingCount: number;
  myRsvp: "GOING" | "NOT_GOING" | null;
  /** Responder names. Populated for Super Admins only; empty for members. */
  going: Person[];
  notGoing: Person[];
};

function when(startsAt: string, endsAt: string | null) {
  const s = new Date(startsAt);
  const date = s.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = s.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  if (!endsAt) return `${date}, ${time}`;
  const e = new Date(endsAt);
  const endTime = e.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time} – ${endTime}`;
}

export function EventList({
  events,
  canManage,
  currentUserId,
}: {
  events: ClubEventRow[];
  canManage: boolean;
  /** Needed so an optimistic RSVP replaces my own row rather than adding a second. */
  currentUserId: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(events);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function rsvp(id: string, status: "GOING" | "NOT_GOING") {
    setBusy(id);
    const res = await fetch(`/api/events/${id}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not save your RSVP.");
      return;
    }
    const j = await res.json();
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        // Keep the Super Admin name lists in step with my own answer, so the
        // open panel does not contradict the button I just pressed.
        const me = { id: currentUserId, name: "You", avatarUrl: null };
        const going = r.going.filter((p) => p.id !== currentUserId);
        const notGoing = r.notGoing.filter((p) => p.id !== currentUserId);
        return {
          ...r,
          myRsvp: j.status,
          goingCount: j.goingCount,
          going: j.status === "GOING" ? [...going, me] : going,
          notGoing: j.status === "NOT_GOING" ? [...notGoing, me] : notGoing,
        };
      })
    );
    toast.success(status === "GOING" ? "You're going." : "Thanks for letting us know.");
  }

  async function remove(row: ClubEventRow) {
    if (!confirm(`Delete "${row.title}"? Members will no longer see it.`)) return;
    setBusy(row.id);
    const res = await fetch(`/api/events/${row.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      toast.error("Could not delete the event.");
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    toast.success("Event deleted.");
    router.refresh();
  }

  // Note: no early return for an empty list — the calendar still renders, so a
  // club with no events yet sees the month grid rather than a blank page.

  return (
    <div className="space-y-6">
      <EventsCalendar events={rows} onOpen={setOpenId} />

      {/* The detail is a centred dialog over the page, so it renders here rather
          than inside the calendar's right column. */}
      {openId && (() => {
        const ev = rows.find((r) => r.id === openId);
        if (!ev) return null;
        return (
          <EventPanel
            event={ev}
            canManage={canManage}
            busy={busy === ev.id}
            onRsvp={rsvp}
            onClose={() => setOpenId(null)}
          />
        );
      })()}
      <div className="space-y-3">
      {rows.length === 0 && (
        <p className="rounded-xl bg-card p-10 text-center text-sm text-muted-foreground border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          No events yet.
        </p>
      )}
      {rows.map((e) => (
        <article
          key={e.id}
          role="button"
          tabIndex={0}
          onClick={() => setOpenId(e.id)}
          onKeyDown={(ev) => {
            // Keyboard parity: the card is clickable, so it must also be
            // reachable and activatable without a mouse.
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              setOpenId(e.id);
            }
          }}
          className="cursor-pointer rounded-xl bg-card p-4 text-left border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)] transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold">{e.title}</h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {when(e.startsAt, e.endsAt)}
                </span>
                {e.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {e.location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {e.goingCount} going
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MemberAvatar
                    userId={e.createdBy.id}
                    name={e.createdBy.name}
                    avatarUrl={e.createdBy.avatarUrl}
                    className="h-8 w-8"
                  />
                  {e.createdBy.name}
                </span>
              </p>
              {e.description && <p className="mt-2 text-sm">{e.description}</p>}
            </div>

            {canManage && (
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/events/${e.id}/edit`}
                  onClick={(ev) => ev.stopPropagation()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  remove(e);
                }}
                disabled={busy === e.id}
                aria-label={`Delete ${e.title}`}
                title="Delete event"
                className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              </div>
            )}
          </div>

          {/* RSVP — open to every member, not just Super Admins. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Green for yes, red for no — the two answers read at a glance
                without having to notice which one is filled in. */}
            <button
              type="button"
              disabled={busy === e.id}
              onClick={(ev) => {
                ev.stopPropagation();
                rsvp(e.id, "GOING");
              }}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
                e.myRsvp === "GOING"
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-green-600 text-green-700 hover:bg-green-600 hover:text-white"
              )}
            >
              {e.myRsvp === "GOING" ? "You're going" : "I'm going"}
            </button>
            <button
              type="button"
              disabled={busy === e.id}
              onClick={(ev) => {
                ev.stopPropagation();
                rsvp(e.id, "NOT_GOING");
              }}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
                e.myRsvp === "NOT_GOING"
                  ? "border-red-600 bg-red-600 text-white"
                  : "border-red-600 text-red-700 hover:bg-red-600 hover:text-white"
              )}
            >
              Can&apos;t make it
            </button>
            <span className={cn("text-xs text-muted-foreground", !e.myRsvp && "italic")}>
              {e.myRsvp ? "You can change this any time." : "No response yet."}
            </span>
          </div>
        </article>
      ))}
      </div>
    </div>
  );
}
