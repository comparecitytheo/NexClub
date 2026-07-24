"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Toggle control for collapsing/expanding the desktop sidebar.
// State is mirrored on <html> via the `sidebar-collapsed` class and persisted
// to localStorage. The class is what the CSS (globals.css) reacts to, and the
// root layout's pre-paint script applies it before hydration to avoid a flash.
// This mirrors the collapse-state pattern (a class on documentElement +
// localStorage), so no new state-management dependency is introduced.
export function SidebarToggle() {
  const [collapsed, setCollapsed] = useState(false);

  // After mount, sync the button's icon to the persisted state. The layout
  // itself is already correct from the pre-paint script; this only resolves the
  // chevron direction (avoids a hydration mismatch by starting from `false`).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
    } catch {
      /* localStorage unavailable — keep default */
    }
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.classList.toggle("sidebar-collapsed", next);
    try {
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
    } catch {
      /* ignore persistence failures */
    }
  }

  const Icon = collapsed ? ChevronRight : ChevronLeft;
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      // CHANGED: now a round chip on the divider. Position (fixed, vertically
      // centered, left tracks the rail width) is set by `.sidebar-toggle` in
      // globals.css; the border + card bg make it read cleanly on the line.
      className="sidebar-toggle flex h-7 w-7 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
