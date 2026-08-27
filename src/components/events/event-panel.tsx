"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Ban, CalendarDays, Check, MapPin, Pencil, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/components/shared/member-avatar";
import type { ClubEventRow } from "./event-list";

function when(startsAt: string, endsAt: string | null) {
  const s = new Date(startsAt);
  const date = s.toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const time = s.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  if (!endsAt) return `${date} at ${time}`;
  const e = new Date(endsAt);
  const endTime = e.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time} – ${endTime}`;
}

/**
 * Full event detail, slid in from the right. Carries the same RSVP controls as
 * the list so a member never has to close it to respond, and — for Super Admins
 * only — the names behind the counts.
 */
export function EventPanel({
  event,
  canManage,
  busy,
  onRsvp,
  onClose,
}: {
  event: ClubEventRow;
  canManage: boolean;
  busy: boolean;
  onRsvp: (id: string, status: "GOING" | "NOT_GOING") => void;
  onClose: () => void;
}) {
  // Escape closes, and the page behind must not scroll while the panel is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // No body-scroll lock: this is an inline card now, not a modal. Locking the
    // page was correct for an overlay and freezes the whole screen here.
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    // Sits in the right-hand column beside the calendar. It used to be a
    // full-screen overlay with a dark backdrop, which hid the calendar and the
    // rest of the page behind it.
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Blurred backdrop — the page stays visible behind it, unlike the old
            opaque slide-over. Clicking it closes, same as Escape. */}
        <button
          type="button"
          aria-label="Close event"
          onClick={onClose}
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        />
        <section
          role="dialog"
          aria-modal="true"
          aria-label={event.title}
          // Sized to its content up to 85vh, then the body scrolls. No longer
          // tied to the calendar's height, which is what made this awkward
          // as an in-column card.
          className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
        >
      <div>
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Club event</p>
            <h2 className="text-xl font-bold">{event.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {/* Super Admins only — the edit page and the API enforce the same. */}
            {canManage && (
              <Link
                href={`/events/${event.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <section className="space-y-2 rounded-xl bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
            <p className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              {when(event.startsAt, event.endsAt)}
            </p>
            {event.location && (
              <p className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                {event.location}
              </p>
            )}
            <p className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
              {event.goingCount} going
            </p>
            <p className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <MemberAvatar
                userId={event.createdBy.id}
                name={event.createdBy.name}
                avatarUrl={event.createdBy.avatarUrl}
                className="h-8 w-8"
              />
              Added by {event.createdBy.name}
            </p>
          </section>

            {/* `.trim()` guards a whitespace-only description, which rendered the
                heading over an empty gap. */}
            {event.description?.trim() && (
              <section className="flex min-h-0 flex-col">
                <h3 className="mb-1.5 shrink-0 text-sm font-semibold">About this event</h3>
                {/* Its own scroll, so a long description cannot push the RSVP
                    buttons out of reach. */}
                <div className="max-h-28 min-h-0 overflow-y-auto pr-1.5">
                  <p className="whitespace-pre-wrap text-sm">{event.description}</p>
                </div>
              </section>
            )}

          <section>
            <h3 className="mb-2 text-sm font-semibold">Are you coming?</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onRsvp(event.id, "GOING")}
                className={cn(
                  "rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
                  event.myRsvp === "GOING"
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-green-600 text-green-700 hover:bg-green-600 hover:text-white"
                )}
              >
                {event.myRsvp === "GOING" ? "You're going" : "I'm going"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRsvp(event.id, "NOT_GOING")}
                className={cn(
                  "rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
                  event.myRsvp === "NOT_GOING"
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-red-600 text-red-700 hover:bg-red-600 hover:text-white"
                )}
              >
                Can&apos;t make it
              </button>
            </div>
          </section>

          {/* Super Admins see who responded; members see only the count, so a
              declined invitation is not on show to the whole club. */}
          {canManage && (
            <section className="flex min-h-0 flex-col">
                {/* No scroll wrapper here. One clipped the inner boxes at the
                    edge, which is what looked cut off. Each list scrolls on its
                    own below, so the block still cannot stretch the card. */}
                <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/40 p-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                  <Check className="h-4 w-4" /> Going ({event.going.length})
                </h3>
                {event.going.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No one yet.</p>
                ) : (
                  <ul className="mt-2 max-h-44 space-y-1.5 overflow-y-auto pr-1.5 text-sm">
                    {event.going.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <MemberAvatar userId={p.id} name={p.name} avatarUrl={p.avatarUrl} className="h-8 w-8" />
                        <span className="truncate">{p.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
                  <Ban className="h-4 w-4" /> Can&apos;t make it ({event.notGoing.length})
                </h3>
                {event.notGoing.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No one yet.</p>
                ) : (
                  <ul className="mt-2 max-h-44 space-y-1.5 overflow-y-auto pr-1.5 text-sm">
                    {event.notGoing.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <MemberAvatar userId={p.id} name={p.name} avatarUrl={p.avatarUrl} className="h-8 w-8" />
                        <span className="truncate">{p.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              </div>
            </section>
          )}
        </div>
      </div>
        </section>
      </div>
  );
}
