"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TaskStatus, EntityType } from "@prisma/client";
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_BADGE, TASK_STATUS_LABELS } from "@/lib/labels";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/shared/member-avatar";
import type { TaskItem } from "./task-list";

/**
 * Cross-lead task list for the /tasks dashboard. The server has already filtered
 * the tasks to the selected date range; this component sorts/filters that set on
 * the client (so the date range stays authoritative and no re-fetch is needed)
 * and edits stage / deletes in place. Every mutation goes through the existing
 * /api/tasks endpoints (soft-delete + audit + permission scope), then calls
 * router.refresh() so the Lead overview, counts, and other server-rendered views
 * stay consistent — the same pattern the inline entity tasks panel uses.
 */
type Sort = "newest" | "oldest";
type StatusFilter = "all" | "open" | "completed";

const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest → Oldest" },
  { value: "oldest", label: "Oldest → Newest" },
];
const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
];

const OPEN_STATUSES: TaskStatus[] = ["OPEN", "IN_PROGRESS"];
// Stage options for the action dropdown (reuses the shared status labels).
const STAGE_OPTIONS: TaskStatus[] = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  EVENT: "Event",
  LEAD: "Lead",
  CONTACT: "Contact",
  COMPANY: "Company",
  DEAL: "Deal",
};

// Sort by due date; tasks without a due date always sort to the bottom.
function byDueDate(sort: Sort) {
  return (a: TaskItem, b: TaskItem) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    const da = new Date(a.dueDate).getTime();
    const db = new Date(b.dueDate).getTime();
    return sort === "newest" ? db - da : da - db;
  };
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function AllTasksView({ initialTasks }: { initialTasks: TaskItem[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);

  // Re-sync when the server sends a fresh set (after router.refresh / navigation).
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const [sort, setSort] = useState<Sort>("newest");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const rows = useMemo(() => {
    let list = tasks;
    if (status === "open") list = list.filter((t) => OPEN_STATUSES.includes(t.status));
    else if (status === "completed") list = list.filter((t) => t.status === "COMPLETED");
    return [...list].sort(byDueDate(sort));
  }, [tasks, sort, status]);

  const today = startOfDay(new Date());

  async function setTaskStatus(id: string, next: TaskStatus) {
    const snapshot = tasks;
    // Optimistic: reflect the new stage immediately, reconcile with the server.
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, status: next } : t)));
    setBusy(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) {
          setTasks((cur) => cur.filter((t) => t.id !== id));
          toast.error("That task no longer exists.");
        } else {
          setTasks(snapshot); // rollback
          toast.error(data.error ?? "Could not update the task.");
        }
        return;
      }
      // Propagate to the Lead overview and other server-rendered views.
      router.refresh();
    } catch {
      setTasks(snapshot);
      toast.error("Could not update the task.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    const snapshot = tasks;
    setConfirmDel(null);
    // Optimistic: remove immediately, restore if the delete fails.
    setTasks((cur) => cur.filter((t) => t.id !== id));
    setBusy(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        setTasks(snapshot); // rollback (a 404 means it is already gone — keep it removed)
        toast.error(data.error ?? "Could not delete the task.");
        return;
      }
      toast.success("Task deleted.");
      router.refresh();
    } catch {
      setTasks(snapshot);
      toast.error("Could not delete the task.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort toggle — same button-group pattern as the leads view switcher. */}
        <div className="inline-flex rounded-lg bg-card p-0.5 border border-muted-foreground/80 shadow-[0_6px_20px_rgba(0,0,0,0.16)]" role="group" aria-label="Sort by due date">
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSort(s.value)}
              aria-pressed={sort === s.value}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                sort === s.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg bg-card p-0.5 border border-muted-foreground/80 shadow-[0_6px_20px_rgba(0,0,0,0.16)]" role="group" aria-label="Filter by status">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              aria-pressed={status === s.value}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                status === s.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} task{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg bg-card p-10 text-center text-sm text-muted-foreground border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          No tasks match the selected range and filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          {/* Column header — mirrors the leads list-view header row. */}
          <div className="hidden items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground lg:flex">
            <span className="flex-1">Task</span>
            <span className="w-40 shrink-0">Related to</span>
            <span className="w-28 shrink-0">Assigned to</span>
            <span className="w-28 shrink-0">Assigned by</span>
            <span className="w-36 shrink-0">Stage</span>
            <span className="w-16 shrink-0">Priority</span>
            <span className="w-24 shrink-0">Last updated</span>
            <span className="w-24 shrink-0 text-right">Due date</span>
            <span className="w-8 shrink-0" />
          </div>
          <ul>
            {rows.map((t) => {
              const done = t.status === "COMPLETED";
              const overdue = !done && t.dueDate ? startOfDay(new Date(t.dueDate)) < today : false;
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/tasks/${t.id}`}
                      className={cn("font-medium hover:text-primary", done && "text-muted-foreground line-through")}
                    >
                      {t.title}
                    </Link>
                    {t.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.description}</p>
                    )}
                    {/* On narrow screens the dedicated columns are hidden, so surface related-to, assignee and creator inline. */}
                    <p className="mt-0.5 text-xs text-muted-foreground lg:hidden">
                      {t.entityType && t.entityLabel && t.entityHref ? (
                        <Link href={t.entityHref} className="hover:text-primary">
                          {ENTITY_TYPE_LABELS[t.entityType]}: {t.entityLabel}
                        </Link>
                      ) : (
                        "—"
                      )}{" "}
                      · To {t.assigneeName} · By {t.creatorName}
                    </p>
                  </div>
                  <span className="hidden w-40 shrink-0 truncate text-sm lg:block">
                    {t.entityType && t.entityLabel && t.entityHref ? (
                      <Link href={t.entityHref} className="hover:text-primary">
                        <span className="text-muted-foreground">{ENTITY_TYPE_LABELS[t.entityType]}:</span> {t.entityLabel}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="hidden w-28 shrink-0 items-center gap-1.5 text-sm text-muted-foreground lg:flex">
                    <MemberAvatar userId={t.assigneeId} name={t.assigneeName} avatarUrl={t.assigneeAvatarUrl} className="h-8 w-8 shrink-0" />
                    <span className="truncate">{t.assigneeName}</span>
                  </span>
                  <span className="hidden w-28 shrink-0 items-center gap-1.5 text-sm text-muted-foreground lg:flex">
                    <MemberAvatar userId={t.creatorId} name={t.creatorName} avatarUrl={t.creatorAvatarUrl} className="h-8 w-8 shrink-0" />
                    <span className="truncate">{t.creatorName}</span>
                  </span>
                  {/* Action dropdown — reflects and sets the current stage. */}
                  <select
                    className="h-8 w-36 shrink-0 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={t.status}
                    onChange={(e) => setTaskStatus(t.id, e.target.value as TaskStatus)}
                    disabled={busy === t.id}
                    aria-label="Task stage"
                  >
                    {STAGE_OPTIONS.map((s) => (
                      <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <span className="hidden w-16 shrink-0 lg:block">
                    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", TASK_PRIORITY_BADGE[t.priority])}>
                      {TASK_PRIORITY_LABELS[t.priority]}
                    </span>
                  </span>
                  <span className="hidden w-24 shrink-0 truncate text-xs text-muted-foreground lg:block">
                    {t.updatedAt ? formatRelative(t.updatedAt) : "—"}
                  </span>
                  <span className={cn("w-24 shrink-0 text-right text-xs", overdue ? "font-medium text-rose-600" : "text-muted-foreground")}>
                    {t.dueDate ? formatDate(t.dueDate) : "—"}
                  </span>
                  {confirmDel === t.id ? (
                    <span className="flex shrink-0 gap-1">
                      <Button size="sm" variant="destructive" onClick={() => remove(t.id)} disabled={busy === t.id}>Confirm</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDel(null)}>Cancel</Button>
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-8 shrink-0 px-0 text-rose-600 hover:text-rose-700"
                      onClick={() => setConfirmDel(t.id)}
                      disabled={busy === t.id}
                      aria-label="Delete task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
