"use client";

import { useState, useRef, useEffect } from "react";
import { Check, Pause, Pencil, Play, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Scrolling announcement bar that replaces the header's flex spacer (the area
 * left of the header controls). The marquee is CSS-driven (see the `.announce*`
 * rules in globals.css); the component only duplicates the message enough times
 * to fill the bar so the seamless loop never reveals a gap (even for short text).
 *
 * Role-based access control:
 *  - `canEdit` is computed on the server from the session role (isSuperAdmin).
 *    It only decides whether the edit affordance is *shown* — it is NOT the
 *    security boundary.
 *  - The real authorization lives in PUT /api/announcement, which calls
 *    `requireSuperAdmin()` and rejects anyone below SUPER_ADMIN with 403. So
 *    even if a non-super-admin forged a request, the server refuses it.
 */
export function AnnouncementBar({ text, canEdit }: { text: string; canEdit: boolean }) {
  const [current, setCurrent] = useState(text); // what is displayed/scrolled
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);

  // Marquee tiling: duplicate the message enough times to always overflow the
  // bar, split into two identical halves. The CSS -50% translate (globals.css)
  // then loops the first half onto the second for a seamless, gap-free stream —
  // works for any length, including text shorter than the bar.
  const trackRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(2);
  // WCAG 2.2.2: readers must be able to stop motion that starts on its own.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    const bar = track?.parentElement; // .announce
    const unit = track?.querySelector<HTMLElement>(".announce-text");
    if (!track || !bar || !unit) return;
    const recompute = () => {
      const unitW = unit.offsetWidth; // one copy (text + its gap)
      const barW = bar.offsetWidth;
      if (unitW > 0 && barW > 0) {
        const perHalf = Math.max(1, Math.ceil(barW / unitW));
        setCopies(perHalf * 2); // two identical halves for the -50% loop
      }
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(bar);
    ro.observe(unit);
    return () => ro.disconnect();
  }, [current]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/announcement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcement: draft }),
      });
      if (res.status === 403) {
        toast.error("Only super admins can edit the announcement.");
        return;
      }
      if (!res.ok) {
        toast.error("Could not save the announcement.");
        return;
      }
      const data = (await res.json()) as { announcement: string };
      setCurrent(data.announcement);
      setEditing(false);
      toast.success("Announcement updated.");
    } catch {
      toast.error("Could not save the announcement.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(current);
    setEditing(false);
  }

  // --- Edit mode (super admin only) -----------------------------------------
  if (editing) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            else if (e.key === "Escape") cancel();
          }}
          maxLength={280}
          placeholder="Announcement shown to everyone in your organization…"
          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <button
          type="button"
          onClick={cancel}
          aria-label="Cancel"
          title="Cancel"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          aria-label="Confirm change"
          title="Confirm change"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // --- No announcement set ---------------------------------------------------
  if (!current) {
    // Super admins get a prompt to add one; everyone else just sees the
    // original empty spacer, so the layout is unchanged for them.
    if (canEdit) {
      return (
        <div className="flex flex-1 items-center">
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setEditing(true);
            }}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            + Add announcement
          </button>
        </div>
      );
    }
    return <div className="flex-1" />; // unchanged spacer / layout preserved
  }

  // --- Display mode: the scrolling marquee (+ edit pencil for super admins) --
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {/* Fluro-orange scrolling bar. The message is duplicated enough times to
          overflow the bar, in two identical halves; the -50% translate loops the
          first half onto the second for a seamless, gap-free stream at any
          length. Pauses on hover; respects reduced-motion. */}
      <div className="announce" data-paused={paused ? "true" : undefined}>
        {/* Duration scales with the copy count (perHalf * 24s) so the pixels-
            per-second stay constant regardless of how many copies are tiled —
            i.e. the same scroll speed as the original two-copy bar. */}
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          aria-label={paused ? "Resume scrolling announcement" : "Pause scrolling announcement"}
          title={paused ? "Resume" : "Pause"}
          className="ml-1 mr-0.5 shrink-0 rounded p-1 text-white/90 hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        </button>
        <div
          className="announce-track"
          ref={trackRef}
          style={{ animationDuration: `${(copies / 2) * 24}s` }}
        >
          {Array.from({ length: copies }).map((_, i) => (
            <span key={i} className="announce-text" aria-hidden={i === 0 ? undefined : "true"}>
              {current}
            </span>
          ))}
        </div>
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={() => {
            setDraft(current);
            setEditing(true);
          }}
          aria-label="Edit announcement"
          title="Edit announcement"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
