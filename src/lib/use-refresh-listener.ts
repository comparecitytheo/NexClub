"use client";
import { useEffect, useRef } from "react";
import { REFRESH_EVENT } from "@/components/shared/refresh-control";

/**
 * Re-run a loader whenever the header's refresh fires — its countdown or the
 * manual button.
 *
 * The header calls `router.refresh()`, which re-renders SERVER components. Any
 * view that fetches its own data on the client is invisible to that, so it went
 * stale while the rest of the page updated. This is the one line those views
 * need to join in.
 *
 * Deliberately NOT for forms: re-loading under someone mid-edit would throw away
 * what they had typed.
 */
export function useRefreshListener(load: () => void) {
  // Held in a ref so a caller passing an inline function does not re-subscribe
  // on every render.
  const ref = useRef(load);
  ref.current = load;

  useEffect(() => {
    const onRefresh = () => ref.current();
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
  }, []);
}
