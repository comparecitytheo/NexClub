"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Keeps every page live. Sits in the dashboard header, so one timer and one
// button serve the whole app rather than each page rolling its own.
//
// Two things happen on each refresh:
//   1. router.refresh() re-runs the current route's server components, which is
//      how the server-rendered pages (dashboard, tasks, deals, directory, ...)
//      pick up new data. It updates in place — no remount, no scroll reset.
//   2. A window event fires for client components that fetch their own data
//      (the leads board), so they re-pull on the same tick instead of running a
//      competing timer.

export const AUTO_REFRESH_MS = 30_000;
export const AUTO_REFRESH_SECONDS = AUTO_REFRESH_MS / 1000;

/** Client-side boards listen for this to re-pull their own data. */
export const REFRESH_EVENT = "nexclub:refresh";

// router.refresh() gives us no completion signal, so the guard is released after
// a short settle window. Long enough to stop ticks stacking on a slow response,
// short enough that the next tick is never blocked.
const SETTLE_MS = 800;

export function RefreshControl() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(AUTO_REFRESH_SECONDS);
  const [refreshing, setRefreshing] = useState(false);

  // A ref, not state: the interval must read the live value, and flipping this
  // should never cause a re-render.
  const inFlight = useRef(false);
  // Absolute deadline, so the countdown stays accurate even if a tick is late
  // (background tab, slow device) instead of drifting.
  const nextRunAt = useRef(Date.now() + AUTO_REFRESH_MS);

  const runRefresh = useCallback(
    (manual = false) => {
      // Skip while a refresh is still settling, so slow responses can't queue up.
      // Applies to the countdown and the button alike.
      if (inFlight.current) return;
      inFlight.current = true;
      if (manual) setRefreshing(true);

      nextRunAt.current = Date.now() + AUTO_REFRESH_MS;
      setSecondsLeft(AUTO_REFRESH_SECONDS);

      try {
        router.refresh();
        window.dispatchEvent(new Event(REFRESH_EVENT));
      } catch {
        // Never let a refresh failure break the page — the current data stays on
        // screen and the next tick retries.
      }

      window.setTimeout(() => {
        inFlight.current = false;
        setRefreshing(false);
      }, SETTLE_MS);
    },
    [router]
  );

  // The single timer. One tick a second is enough to drive a whole-second
  // countdown, and because the deadline above is absolute the display stays
  // accurate even if a tick runs late (background tab, slow device). Cleared on
  // unmount, so no timer leaks or stacks across re-renders.
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = nextRunAt.current - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining <= 0) runRefresh();
    }, 1000);
    return () => clearInterval(id);
  }, [runRefresh]);

  return (
    <button
      type="button"
      onClick={() => runRefresh(true)}
      disabled={refreshing}
      aria-label={`Refresh now. Auto-refreshing in ${secondsLeft} seconds.`}
      title="Refresh now"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors",
        "hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-60"
      )}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
      {/* Countdown. aria-hidden because the button's own label already announces
          it — otherwise a screen reader would read a new number every second. */}
      <span aria-hidden="true" className="tabular-nums text-xs">
        {secondsLeft}s
      </span>
    </button>
  );
}
