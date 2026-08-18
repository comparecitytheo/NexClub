"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Date (and optionally time) field styled to the CRM.
 *
 * The native <input type="date"> popup is browser chrome — Chrome paints it in
 * its own blue and it cannot be reached by CSS. This replaces it with a popover
 * built from the same pieces the rest of the app uses: the date-range picker's
 * popover shell, the standard field styling, and lucide icons. No new
 * dependency, and the same value format as before (`YYYY-MM-DD` or
 * `YYYY-MM-DDTHH:mm`), so every caller keeps working unchanged.
 */

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Parse the value the form holds. Invalid or empty yields null. */
function parseValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toValue(d: Date, withTime: boolean): string {
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

/** How the field reads when closed — matches the app's en-AU date style. */
function display(d: Date | null, withTime: boolean, placeholder: string): string {
  if (!d) return placeholder;
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
  if (withTime) {
    opts.hour = "numeric";
    opts.minute = "2-digit";
  }
  return new Intl.DateTimeFormat("en-AU", opts).format(d);
}

/** Monday-first grid, padded with the neighbouring months' days. */
function monthGrid(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  // getDay() is Sunday-first; shift so Monday is column 0.
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date, inMonth: date.getMonth() === month };
  });
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DateTimeField({
  id,
  value,
  onChange,
  withTime = false,
  placeholder,
  className,
  ariaLabel,
  max,
}: {
  id?: string;
  /** `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` when withTime. */
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  /** Latest selectable date, `YYYY-MM-DD`. Used by "date received". */
  max?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // Screen coordinates for the popup. It is positioned FIXED rather than
  // absolute because the lead panel nests three scrolling containers, and an
  // absolutely-positioned popup is clipped by the nearest one — the calendar
  // was being cut off halfway down the Tasks box.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const selected = useMemo(() => parseValue(value), [value]);
  const [cursor, setCursor] = useState(() => selected ?? new Date());

  // Reopening on a different value should land on that month, not the last one
  // browsed to.
  useEffect(() => {
    if (open) setCursor(selected ?? new Date());
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;

    function place() {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const W = 280;
      const H = withTime ? 420 : 330;
      // Flip above the field when there is not room below, and keep the popup
      // on screen horizontally.
      const below = window.innerHeight - r.bottom;
      const top = below < H && r.top > H ? r.top - H - 8 : r.bottom + 8;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - W - 8);
      setPos({ top, left });
    }
    place();
    // `true` captures scrolls inside nested containers, not just the window.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);

    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, withTime]);

  const maxDate = useMemo(() => (max ? parseValue(max) : null), [max]);
  const grid = useMemo(
    () => monthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  function pick(day: Date) {
    // Keep whatever time was already chosen; default to 9am rather than
    // midnight, which is almost never what someone means by a due time.
    const base = selected ?? new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0);
    const next = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      withTime ? base.getHours() : 0,
      withTime ? base.getMinutes() : 0
    );
    onChange(toValue(next, withTime));
    if (!withTime) setOpen(false);
  }

  function setTime(hours: number, minutes: number) {
    const base = selected ?? new Date();
    const next = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      hours,
      minutes
    );
    onChange(toValue(next, true));
  }

  const timeValue = selected ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : "";

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        ref={btnRef}
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          // Same shape as the shared Input, so it sits level with its siblings.
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          !selected && "text-muted-foreground"
        )}
      >
        <span className="truncate">
          {display(selected, withTime, placeholder ?? (withTime ? "Pick a date and time" : "Pick a date"))}
        </span>
        <Calendar className="ml-2 h-4 w-4 shrink-0 opacity-60" />
      </button>

      {open && (
        <div
          role="dialog"
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0 }}
          className="fixed z-[100] w-[17.5rem] rounded-xl bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {DAY_LABELS.map((d, i) => (
              <span
                key={i}
                className="flex h-7 items-center justify-center text-[10px] font-semibold uppercase text-muted-foreground"
              >
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {grid.map(({ date, inMonth }, i) => {
              const isSelected = selected ? sameDay(date, selected) : false;
              const isToday = sameDay(date, new Date());
              const disabled = maxDate ? date > maxDate : false;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(date)}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-md text-xs transition-colors",
                    // Selection uses the CRM primary, not the browser's blue.
                    isSelected
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "hover:bg-accent",
                    !inMonth && !isSelected && "text-muted-foreground/50",
                    isToday && !isSelected && "font-semibold text-primary",
                    disabled && "cursor-not-allowed opacity-30 hover:bg-transparent"
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {withTime && (
            <div className="mt-3 border-t pt-3">
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor={`${id ?? "dt"}-time`}>
                Time
              </label>
              {/* A plain time input: the time popup is a simple list rather than
                  the calendar chrome, so it does not clash the way the date one
                  did, and this keeps the keyboard entry people expect. */}
              <input
                id={`${id ?? "dt"}-time`}
                type="time"
                value={timeValue}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number);
                  if (!Number.isNaN(h) && !Number.isNaN(m)) setTime(h, m);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
