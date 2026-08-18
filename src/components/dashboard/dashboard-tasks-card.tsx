"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime, isTaskOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { normaliseTask, type TaskItem } from "@/components/tasks/task-list";

/**
 * Compact Tasks card for the main dashboard.
 *
 * Shared data layer, not a copy: it reads the same GET /api/tasks endpoint the
 * task list uses, maps rows with the shared `normaliseTask` into the shared
 * `TaskItem` type, and completes via the same POST /api/tasks/[id]/complete
 * handler (optimistic flip, revert on failure, then refetch) — no new store,
 * query layer, or endpoint is introduced. The "which tasks to show" logic is a
 * local selector over that shared list (below), not a separate query.
 *
 * The dashboard and the /tasks tab are separate routes and are never mounted at
 * the same time, so there is no in-memory store to subscribe to; cross-surface
 * consistency flows through the shared API/DB instead. To keep it live without a
 * page reload, the card refetches on mount and whenever this tab/window regains
 * focus — so a task created/edited/completed on the Tasks tab shows up here on
 * return, and a completion here is written through the same endpoint so the tab
 * reflects it on its next load.
 */

// How many tasks the compact card surfaces; the rest live behind "View all".
const SHOW_LIMIT = 6;

// Selector over the shared list: soonest-due first, tasks without a due date
// last, capped for the card. Derived client-side — deliberately not a separate
// "top N" endpoint.
function selectDashboardTasks(tasks: TaskItem[]): TaskItem[] {
  return [...tasks]
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, SHOW_LIMIT);
}


export function DashboardTasksCard() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Same endpoint + scope the task list defaults to (my open tasks). In a
  // callback so the focus listener can reuse it.
  const load = useCallback(async () => {
    try {
      setError(false);
      const res = await fetch("/api/tasks?scope=mine&status=open");
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setTasks(((data.items as Record<string, unknown>[]) ?? []).map(normaliseTask));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Revalidate on focus so changes made on the /tasks route (or anywhere)
    // appear here without a full page reload — our stand-in for a live store
    // subscription, since the two views never share a mounted component.
    function revalidate() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", revalidate);
    window.addEventListener("focus", revalidate);
    return () => {
      document.removeEventListener("visibilitychange", revalidate);
      window.removeEventListener("focus", revalidate);
    };
  }, [load]);

  // Identical optimistic-complete flow to the task list's handler: flip locally,
  // POST to the shared complete endpoint, revert on failure, then refetch (which
  // drops the now-completed task from this open-only list).
  async function complete(id: string) {
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status: "COMPLETED" } : t)));
    const res = await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
    if (!res.ok) {
      setTasks(prev);
      toast.error("Could not complete the task.");
      return;
    }
    toast.success("Task completed.");
    void load();
  }

  const rows = useMemo(() => selectDashboardTasks(tasks), [tasks]);
  const openCount = tasks.filter((t) => t.status !== "COMPLETED").length;

  return (
    <section className="rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Tasks{!loading && !error && <span className="text-muted-foreground"> ({openCount})</span>}
        </h3>
        <Link href="/tasks" className="text-xs text-muted-foreground hover:text-primary">View all</Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load tasks.{" "}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="font-medium text-primary hover:underline"
          >
            Retry
          </button>
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open tasks. You are all caught up.</p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {rows.map((t) => {
            const done = t.status === "COMPLETED";
            const overdue = isTaskOverdue(t.dueDate, done);
            return (
              <li key={t.id} className="flex items-center gap-3 py-1.5 text-sm">
                {/* Same checkbox affordance as the task list rows. */}
                <button
                  onClick={() => !done && complete(t.id)}
                  disabled={done}
                  aria-label="Complete task"
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 hover:border-primary"
                  )}
                >
                  {done && <Check className="h-3 w-3" />}
                </button>
                <Link
                  href={t.entityHref ?? `/tasks/${t.id}`}
                  title={t.title}
                  className={cn(
                    "min-w-0 flex-1 truncate font-medium hover:text-primary",
                    done && "text-muted-foreground line-through"
                  )}
                >
                  {t.title}
                </Link>
                <span className={cn("w-20 shrink-0 text-right text-xs", overdue ? "font-medium text-rose-600" : "text-muted-foreground")}>
                  {t.dueDate ? formatDateTime(t.dueDate) : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
