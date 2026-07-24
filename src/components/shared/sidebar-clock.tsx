"use client";
import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

// Live date + time pinned to the bottom of the menu bar. It reads the browser's
// own locale and timezone automatically: Intl.DateTimeFormat with an `undefined`
// locale and no `timeZone` option formats in whatever timezone the logged-in
// user's device is set to, so it follows them without any hardcoding. We render
// nothing until mounted (the server has no user timezone, so formatting on the
// server would hydrate-mismatch); once mounted it ticks every second.
export function SidebarClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const date = now
    ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(now)
    : "";
  const time = now
    ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(now)
    : "";

  return (
    <div className="sidebar-clock mt-auto border-t border-white/15 p-3">
      <div
        className="flex items-center gap-3 rounded-md px-3 py-2 text-white/80"
        title={now ? now.toString() : ""}
      >
        <Clock className="h-4 w-4 shrink-0" />
        {/* `nav-label` is hidden by the collapse CSS, exactly like the nav links,
            so the rail shows just the clock icon when collapsed. */}
        <span className="nav-label leading-tight tabular-nums">
          <span className="block text-[11px] text-white/60">{date || "\u00a0"}</span>
          <span className="block text-sm font-semibold">{time || "\u00a0"}</span>
        </span>
      </div>
    </div>
  );
}
