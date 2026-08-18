"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { TaskPriority, TaskStatus } from "@prisma/client";
import type { EntityType } from "@prisma/client";
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_BADGE } from "@/lib/labels";
import { formatDateTime, isTaskOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TaskItem = {
  id: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  assigneeName: string;
  assigneeId: string;
  assigneeAvatarUrl: string | null;
  /** Who created/assigned the task. */
  creatorName: string;
  creatorId: string;
  creatorAvatarUrl: string | null;
  creatorName: string;
  entityLabel: string | null;
  entityHref: string | null;
  entityType: EntityType | null;
  description: string | null;
  updatedAt: string | null;
};

type Scope = "mine" | "assigned" | "created" | "all";
type StatusFilter = "open" | "completed" | "all";

// Map an API task into a flat TaskItem.
export function normaliseTask(t: Record<string, unknown>): TaskItem {
  const lead = t.lead as { id: string; contactName: string } | null;
  const contact = t.contact as { id: string; firstName: string; lastName: string } | null;
  const company = t.company as { id: string; name: string } | null;
  const deal = t.deal as { id: string; name: string } | null;
  const assignee = t.assignee as { id?: string; name?: string; avatarUrl?: string | null } | null;
  const creator = t.creator as { id?: string; name?: string; avatarUrl?: string | null } | null;

  let entityLabel: string | null = null;
  let entityHref: string | null = null;
  if (lead) { entityLabel = lead.contactName; entityHref = `/leads/${lead.id}`; }
  else if (contact) { entityLabel = `${contact.firstName} ${contact.lastName}`; entityHref = `/contacts/${contact.id}`; }
  else if (company) { entityLabel = company.name; entityHref = `/companies/${company.id}`; }
  else if (deal) { entityLabel = deal.name; entityHref = `/deals/${deal.id}`; }
  const entityType: EntityType | null = lead ? "LEAD" : contact ? "CONTACT" : company ? "COMPANY" : deal ? "DEAL" : null;

  return {
    id: String(t.id),
    title: String(t.title ?? ""),
    priority: t.priority as TaskPriority,
    status: t.status as TaskStatus,
    dueDate: (t.dueDate as string) ?? null,
    completedAt: (t.completedAt as string) ?? null,
    assigneeName: assignee?.name ?? "",
    assigneeId: assignee?.id ?? "",
    assigneeAvatarUrl: assignee?.avatarUrl ?? null,
    creatorName: creator?.name ?? "",
    creatorId: creator?.id ?? "",
    creatorAvatarUrl: creator?.avatarUrl ?? null,
    entityLabel,
    entityHref,
    entityType,
    description: (t.description as string) ?? null,
    updatedAt: (t.updatedAt as string) ?? null,
  };
}

const SCOPES: { value: Scope; label: string }[] = [
  { value: "mine", label: "Mine" },
  { value: "assigned", label: "Assigned to me" },
  { value: "created", label: "Created by me" },
  { value: "all", label: "All" },
];

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function TaskList({ initialTasks }: { initialTasks: TaskItem[] }) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [scope, setScope] = useState<Scope>("mine");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [loading, setLoading] = useState(false);
  const skip = useRef(true);

  async function reload(nextScope = scope, nextStatus = status) {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?scope=${nextScope}&status=${nextStatus}`);
      const data = await res.json();
      setTasks(((data.items as Record<string, unknown>[]) ?? []).map(normaliseTask));
    } catch {
      toast.error("Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, status]);

  async function complete(id: string) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status: "COMPLETED" } : t)));
    const res = await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
    if (!res.ok) {
      toast.error("Could not complete the task.");
    } else {
      toast.success("Task completed.");
    }
    void reload();
  }

  const today = startOfDay(new Date());

  const groups = useMemo(() => {
    const g: Record<string, TaskItem[]> = { overdue: [], today: [], upcoming: [], none: [] };
    for (const t of tasks) {
      if (!t.dueDate) g.none.push(t);
      else {
        // Overdue is decided on the exact due TIME, so a task due at 9am is
        // overdue by 10am rather than sitting under "Today" all day —
        // contradicting both its own row styling and the reminder email.
        const due = new Date(t.dueDate);
        const day = startOfDay(due);
        if (isTaskOverdue(due)) g.overdue.push(t);
        else if (day === today) g.today.push(t);
        else g.upcoming.push(t);
      }
    }
    return g;
  }, [tasks, today]);

  const grouped = status === "open";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg bg-card p-0.5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              onClick={() => setScope(s.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                scope === s.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg bg-card p-0.5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                status === s.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg bg-card p-10 text-center text-sm text-muted-foreground border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          Nothing here. Create a task to track your follow-ups.
        </div>
      ) : grouped ? (
        <div className="space-y-6">
          <Section title="Overdue" tone="text-rose-600" tasks={groups.overdue} onComplete={complete} today={today} />
          <Section title="Due today" tasks={groups.today} onComplete={complete} today={today} />
          <Section title="Upcoming" tasks={groups.upcoming} onComplete={complete} today={today} />
          <Section title="No due date" tasks={groups.none} onComplete={complete} today={today} />
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          {tasks.map((t) => (
            <Row key={t.id} task={t} onComplete={complete} today={today} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Section({
  title,
  tone,
  tasks,
  onComplete,
  today,
}: {
  title: string;
  tone?: string;
  tasks: TaskItem[];
  onComplete: (id: string) => void;
  today: number;
}) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <h3 className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", tone ?? "text-muted-foreground")}>
        {title} <span className="text-muted-foreground">({tasks.length})</span>
      </h3>
      <ul className="overflow-hidden rounded-lg bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        {tasks.map((t) => (
          <Row key={t.id} task={t} onComplete={onComplete} today={today} />
        ))}
      </ul>
    </div>
  );
}

function Row({ task, onComplete, today }: { task: TaskItem; onComplete: (id: string) => void; today: number }) {
  const done = task.status === "COMPLETED";
  const overdue = isTaskOverdue(task.dueDate, done);
  return (
    <li className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
      <button
        onClick={() => !done && onComplete(task.id)}
        disabled={done}
        aria-label="Complete task"
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 hover:border-primary"
        )}
      >
        {done && <Check className="h-3 w-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <Link
          // Task/reminder click → the associated lead's detail view (matches the
          // notification dropdown, which deep-links via entityType/entityId).
          // Falls back to the task detail only when the task isn't linked to an entity.
          href={task.entityHref ?? `/tasks/${task.id}`}
          className={cn("font-medium hover:text-primary", done && "text-muted-foreground line-through")}
        >
          {task.title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{task.assigneeName}</span>
          {task.entityLabel && task.entityHref && (
            <>
              <span>·</span>
              <Link href={task.entityHref} className="hover:text-primary">{task.entityLabel}</Link>
            </>
          )}
        </div>
      </div>
      <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", TASK_PRIORITY_BADGE[task.priority])}>
        {TASK_PRIORITY_LABELS[task.priority]}
      </span>
      <span className={cn("w-24 text-right text-xs", overdue ? "font-medium text-rose-600" : "text-muted-foreground")}>
        {task.dueDate ? formatDateTime(task.dueDate) : "—"}
      </span>
    </li>
  );
}
