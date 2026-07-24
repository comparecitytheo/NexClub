"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Dependency-free top progress bar. It starts the instant an internal link is
// clicked (so there's immediate feedback even when the destination renders in
// ~300ms) and finishes when the route actually changes. Covers all <Link>
// navigation — sidebar tabs, cards, list rows — since next/link renders an <a>.
export function TopLoader() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);   // 0 = hidden
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (trickle.current) { clearInterval(trickle.current); trickle.current = null; }
    if (safety.current) { clearTimeout(safety.current); safety.current = null; }
  };

  const start = () => {
    if (trickle.current) return; // already running
    if (hide.current) { clearTimeout(hide.current); hide.current = null; }
    setWidth(8);
    // Ease toward 90% while we wait for the new route.
    trickle.current = setInterval(() => setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w)), 180);
    // Safety net: never trickle forever (e.g. a same-path or aborted nav).
    safety.current = setTimeout(finish, 8000);
  };

  const finish = () => {
    clearTimers();
    setWidth(100);
    hide.current = setTimeout(() => setWidth(0), 250); // let it reach 100%, then fade
  };

  // Start on any qualifying internal-link click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      const target = a.getAttribute("target");
      if (!href || href.startsWith("#") || target === "_blank" || a.hasAttribute("download")) return;
      let url: URL;
      try { url = new URL(href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;               // external
      if (url.pathname === window.location.pathname) return;           // same page
      start();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // The route changed → the new page is in. Finish the bar.
  useEffect(() => { finish(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pathname]);

  // Cleanup on unmount.
  useEffect(() => () => { clearTimers(); if (hide.current) clearTimeout(hide.current); }, []);

  if (width === 0) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px]">
      <div
        className="h-full bg-primary"
        style={{
          width: `${width}%`,
          transition: "width 180ms ease",
          boxShadow: "0 0 8px hsl(var(--primary) / 0.7), 0 0 4px hsl(var(--primary) / 0.5)",
        }}
      />
    </div>
  );
}
