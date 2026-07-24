"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TaskStatus, EntityType } from "@prisma/client";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
const STATUSES: TaskStatus[] = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

type Member = { id: string; name: string };
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  updatedAt: string | null;
  assignee: { id: string; name: string };
};

// datetime-local value ("YYYY-MM-DDTHH:mm", user's local tz) -> ISO with offset,
// so the instant is stored correctly regardless of server timezone.
function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Inline tasks panel for any CRM entity overview (lead, contact, company, deal).
 * Self-contained: fetches this entity's tasks and the member roster, and creates,
 * re-stages, and deletes tasks in place (no page reload). Every mutation goes
 * through the existing /api/tasks endpoints, which set the Related To association
 * from entityType+entityId, enforce permissions, and write the audit log.
 */
export function EntityTasksPanel({
  entityType,
  entityId,
  currentUserId,
}: {
  entityType: EntityType;
  entityId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const [due, setDue] = useState("");
  const [desc, setDesc] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/tasks?entityType=${entityType}&entityId=${entityId}&status=all`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTasks(data.items ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/members");
        const d = await r.json();
        setMembers((d.items ?? []).map((m: Member) => ({ id: m.id, name: m.name })));
      } catch {
        /* roster is best-effort; the assignee select just stays minimal */
      }
    })();
  }, []);

  async function create() {
    if (!title.trim()) {
      toast.error("Add a task title.");
      return;
    }
    setBusy("create");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: desc || undefined, assigneeId, dueDate: toIso(due), entityType, entityId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Could not create the task.");
      toast.success("Task created.");
      setTitle("");
      setDesc("");
      setDue("");
      setAssigneeId(currentUserId);
      setShowForm(false);
      load();
      // Invalidate server-rendered views (the Tasks page, counts, activity) so
      // the new task shows there too, without a manual refresh.
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(id: string, status: TaskStatus) {
    const snapshot = tasks;
    // Optimistic: reflect the new status immediately, reconcile with the server.
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, status } : t)));
    setBusy(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) {
          // Deleted from another view while open here: drop it instead of rolling back.
          setTasks((cur) => cur.filter((t) => t.id !== id));
          toast.error("That task no longer exists.");
        } else {
          setTasks(snapshot); // rollback
          toast.error(data.error ?? "Could not update the task.");
        }
        return;
      }
      // Propagate to the Tasks page and other server-rendered views.
      router.refresh();
    } catch {
      setTasks(snapshot); // rollback on network failure
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
      // Propagate the deletion to the Tasks page and other server-rendered views.
      router.refresh();
    } catch {
      setTasks(snapshot); // rollback on network failure
      toast.error("Could not delete the task.");
    } finally {
      setBusy(null);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <section className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Tasks{tasks.length ? ` (${tasks.length})` : ""}</h2>
        <Button size="sm" variant="secondary" onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-4 w-4" /> Add task
        </Button>
      </div>

      {showForm && (
        <div className="mb-4 space-y-2 rounded-lg bg-muted/30 p-3 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={selectClass} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} aria-label="Assignee">
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date and time" />
          </div>
          <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" />
          <div className="flex gap-2">
            <Button size="sm" onClick={create} disabled={busy === "create"}>{busy === "create" ? "Saving…" : "Save task"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load tasks. <button onClick={load} className="font-medium text-primary hover:underline">Retry</button>
        </p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks yet. Add one to track follow-ups on this record.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const done = t.status === "COMPLETED";
            const overdue = !done && t.dueDate ? new Date(t.dueDate) < today : false;
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg p-3 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>{t.title}</p>
                  {t.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t.assignee.name}
                    {t.dueDate ? (
                      <>
                        {" · "}
                        <span className={overdue ? "text-rose-600" : ""}>{formatDate(t.dueDate)}</span>
                      </>
                    ) : null}
                    {t.updatedAt ? <> · updated {formatRelative(t.updatedAt)}</> : null}
                  </p>
                </div>
                <select
                  className={`${selectClass} h-8`}
                  value={t.status}
                  onChange={(e) => setStatus(t.id, e.target.value as TaskStatus)}
                  disabled={busy === t.id}
                  aria-label="Task stage"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
                {confirmDel === t.id ? (
                  <span className="flex gap-1">
                    <Button size="sm" variant="destructive" onClick={() => remove(t.id)} disabled={busy === t.id}>Confirm</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDel(null)}>Cancel</Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => setConfirmDel(t.id)} aria-label="Delete task">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
