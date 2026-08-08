"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { RANGE_DAYS, DEFAULT_RANGE_DAYS, type DateRangeParams } from "@/lib/date-range";

const STORAGE_KEY = "nex-date-range";

/**
 * Date-range control rendered top-right on the Dashboard, My Leads, and Leads
 * Sent pages. The selection is SHARED STATE held in the URL (?range / ?from&to),
 * which each server page reads to filter its data — so all three views stay in
 * sync. It is also mirrored to localStorage so the choice carries across sidebar
 * navigation (which doesn't preserve query params). Default is 30 days.
 *
 * Props are the current params (parsed server-side and passed in) so this
 * component doesn't need useSearchParams (avoids a Suspense boundary).
 */
export function DateRangePicker({ range, from, to }: DateRangeParams) {
  const router = useRouter();
  const pathname = usePathname();

  const isCustom = Boolean(from && to);
  // Active button: custom if explicit dates, else the range param, else default.
  const active = isCustom ? "custom" : range ?? String(DEFAULT_RANGE_DAYS);

  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from ?? "");
  const [draftTo, setDraftTo] = useState(to ?? "");
  const ref = useRef<HTMLDivElement>(null);

  // Write a new selection to the URL (replace = no history spam) and remember it.
  function apply(next: { range?: number; from?: string; to?: string }) {
    // Start from the CURRENT query string, not a blank one. Building fresh threw
    // away every other param — on the Reporting page that silently reset the
    // selected member back to club-wide whenever a date range was chosen.
    const sp = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    sp.delete("range");
    sp.delete("from");
    sp.delete("to");
    if (next.range) sp.set("range", String(next.range));
    if (next.from && next.to) {
      sp.set("from", next.from);
      sp.set("to", next.to);
    }
    const qs = sp.toString();
    try {
      localStorage.setItem(STORAGE_KEY, qs);
    } catch {
      /* private mode / storage disabled — URL still works */
    }
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  // Stickiness: if the URL has no range on first mount, restore the last-used one
  // from localStorage so the selection follows the user across the three views.
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    if (range || (from && to)) return; // URL already carries a range
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved !== `range=${DEFAULT_RANGE_DAYS}`) {
        // Merge the remembered range into the existing query rather than
        // replacing it, so params like ?member survive the restore.
        const sp = new URLSearchParams(window.location.search);
        for (const [k, v] of new URLSearchParams(saved)) sp.set(k, v);
        router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the custom popover on any outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function applyCustom() {
    if (!draftFrom || !draftTo) return;
    apply({ from: draftFrom, to: draftTo });
    setOpen(false); // close once the range is confirmed
  }

  return (
    <div className="relative" ref={ref}>
      <div className="inline-flex items-center rounded-lg bg-card p-0.5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        {RANGE_DAYS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => {
              apply({ range: days });
              setOpen(false);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active === String(days)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {days} Days
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active === "custom"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          Custom Range
        </button>
      </div>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <p className="mb-3 text-sm font-semibold">Custom range</p>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Start date</span>
              <input
                type="date"
                value={draftFrom}
                max={draftTo || undefined}
                onChange={(e) => setDraftFrom(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">End date</span>
              <input
                type="date"
                value={draftTo}
                min={draftFrom || undefined}
                onChange={(e) => setDraftTo(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyCustom}
              disabled={!draftFrom || !draftTo}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
