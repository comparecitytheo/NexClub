"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { REFRESH_EVENT } from "@/components/shared/refresh-control";
import { ArrowLeft, Clock, Mail, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  LEAD_STATUS_ORDER,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_BADGE,
  TASK_STATUS_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/components/shared/member-avatar";
import type { LeadStatus, TaskPriority, TaskStatus } from "@prisma/client";

type Member = { id: string; name: string };
type Person = { id: string; name: string; email: string | null; phone: string | null; avatarUrl: string | null };

type Detail = {
  lead: {
    id: string;
    contactName: string;
    company: string | null;
    email: string | null;
    phone: string | null;
    industry: string | null;
    notes: string | null;
    source: string;
    status: LeadStatus;
    statusBeforeDelete: LeadStatus | null;
    deletedOn: string | null;
    archivedAt: string | null;
    valueEstimate: number | null;
    createdAt: string | null;
    dateReceived: string;
    followUpDate: string | null;
    referrer: Person;
    owner: Person;
    canEditRevenue: boolean;
  };
  tasks: { id: string; title: string; status: TaskStatus; priority: TaskPriority; dueDate: string | null; assigneeName: string; creatorName: string }[];
  comments: { id: string; body: string; createdAt: string; authorName: string; authorId: string; authorAvatarUrl: string | null; stage: LeadStatus | null }[];
};

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function fmtDateTime(iso: string | null) {
  if (!iso) return "No due date";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}
function fmtCommentTime(iso: string) {
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );
}

export function ReceivedLeadPanel({
  leadId,
  members,
  currentUserId,
  isAdmin,
  onClose,
  onValue,
  onStatus,
  onDelete,
}: {
  leadId: string;
  members: Member[];
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  /** When supplied, a delete control appears top-right of the Lead Overview card. */
  onDelete?: (id: string) => void;
  onValue: (value: number | null) => void;
  onStatus: (status: LeadStatus) => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  const [savingStatus, setSavingStatus] = useState(false);

  const [revenue, setRevenue] = useState("");
  const [savingRev, setSavingRev] = useState(false);

  const [comment, setComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskAssignee, setTaskAssignee] = useState(currentUserId);
  const [addingTask, setAddingTask] = useState(false);
  const [confirmTaskDel, setConfirmTaskDel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/leads/${leadId}/sent-detail`)
      .then((r) => r.json())
      .then((d: Detail & { error?: string }) => {
        if (cancelled) return;
        if (d.error) {
          toast.error(d.error);
          onClose();
          return;
        }
        setData(d);
        setRevenue(d.lead.valueEstimate != null ? String(d.lead.valueEstimate) : "");
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Could not load the lead.");
          onClose();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const canEditStatus = !!data && (isAdmin || data.lead.owner.id === currentUserId);

  async function changeStatus(next: LeadStatus) {
    if (!data || next === data.lead.status) return;
    const previous = data.lead.status;
    setData((cur) => (cur ? { ...cur, lead: { ...cur.lead, status: next } } : cur));
    setSavingStatus(true);
    const res = await fetch(`/api/leads/${leadId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setSavingStatus(false);
    if (!res.ok) {
      setData((cur) => (cur ? { ...cur, lead: { ...cur.lead, status: previous } } : cur));
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Could not update the stage.");
      return;
    }
    onStatus(next);
    toast.success("Pipeline stage updated.");
  }

  async function saveRevenue() {
    setSavingRev(true);
    const res = await fetch(`/api/leads/${leadId}/revenue`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valueEstimate: revenue === "" ? "" : Number(revenue) }),
    });
    setSavingRev(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Could not save.");
      return;
    }
    const j = await res.json();
    setData((cur) => (cur ? { ...cur, lead: { ...cur.lead, valueEstimate: j.valueEstimate } } : cur));
    onValue(j.valueEstimate);
    toast.success("Deal value updated.");
  }

  // Comments are a conversation, so the panel re-pulls itself whenever the
  // header's refresh fires (its countdown, or the manual button). Only the
  // comment list is replaced — the stage select, revenue field and anything else
  // being edited are left untouched so a refresh never wipes work in progress.
  useEffect(() => {
    const onRefresh = () => {
      fetch(`/api/leads/${leadId}/sent-detail`)
        .then((r) => r.json())
        .then((d: Detail & { error?: string }) => {
          if (d.error) return;
          setData((cur) => (cur ? { ...cur, comments: d.comments } : cur));
        })
        .catch(() => {
          /* keep what is on screen; the next tick retries */
        });
    };
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
  }, [leadId]);

  const [reopening, setReopening] = useState(false);

  // Reopen a deleted lead: the server restores the stage it held before deletion
  // and clears the trail, so the lead leaves the Deleted tab entirely.
  async function reopenLead() {
    if (!data) return;
    if (!confirm(`Reopen ${data.lead.contactName}? It returns to your pipeline.`)) return;
    setReopening(true);
    const res = await fetch(`/api/leads/${leadId}/reopen`, { method: "POST" });
    setReopening(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Could not reopen the lead.");
      return;
    }
    const j = await res.json().catch(() => ({}));
    toast.success("Lead reopened.");
    onStatus?.(j.status as LeadStatus);
    onClose();
  }

  async function addComment() {
    if (!comment.trim()) return;
    setPostingComment(true);
    const res = await fetch(`/api/leads/${leadId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: comment }),
    });
    setPostingComment(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Could not post the comment.");
      return;
    }
    const c = await res.json();
    setData((cur) => (cur ? { ...cur, comments: [...cur.comments, c] } : cur));
    setComment("");
  }

  async function addTask() {
    if (!taskTitle.trim()) {
      toast.error("Add a task title.");
      return;
    }
    setAddingTask(true);
    const res = await fetch(`/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: taskTitle, assigneeId: taskAssignee, dueDate: taskDue || "", entityType: "LEAD", entityId: leadId }),
    });
    setAddingTask(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Could not add the task.");
      return;
    }
    const t = await res.json();
    setData((cur) =>
      cur
        ? {
            ...cur,
            tasks: [
              ...cur.tasks,
              {
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate ?? null,
                assigneeName: t.assignee?.name ?? "",
                // The current member is creating this task, so they are the creator.
                creatorName: t.creator?.name ?? members.find((m) => m.id === currentUserId)?.name ?? "You",
              },
            ],
          }
        : cur
    );
    setTaskTitle("");
    setTaskDue("");
    toast.success("Task added.");
  }

  async function deleteTask(id: string) {
    if (!data) return;
    const snapshot = data.tasks;
    setConfirmTaskDel(null);
    // Optimistic: drop it immediately, restore on failure (matches this panel's pattern).
    setData((cur) => (cur ? { ...cur, tasks: cur.tasks.filter((t) => t.id !== id) } : cur));
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      const e = await res.json().catch(() => ({}));
      setData((cur) => (cur ? { ...cur, tasks: snapshot } : cur));
      toast.error(e.error ?? "Could not delete the task.");
      return;
    }
    toast.success("Task deleted.");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-background border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <button
          onClick={onClose}
          className="inline-flex h-9 items-center gap-1.5 rounded-md pl-2 pr-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="min-w-0 border-l pl-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Lead received</p>
          <h2 className="truncate text-lg font-bold leading-tight">{data?.lead.contactName ?? "Loading…"}</h2>
        </div>
      </header>

        {loading || !data ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left card — Lead Overview */}
              <Card className="flex flex-col">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">Lead Overview</CardTitle>
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(leadId)}
                        aria-label="Delete lead"
                        title="Delete lead"
                        className="-mr-1 -mt-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
            {/* Deleted leads open read-only from the Deleted tab. The banner
                says why the lead looks frozen and offers the way back. */}
            {data.lead.status === "DELETED" && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-900">This lead is deleted</p>
                    <p className="mt-0.5 text-xs text-amber-800">
                      {data.lead.deletedOn ? `Deleted ${fmtDate(data.lead.deletedOn)}. ` : ""}
                      {data.lead.archivedAt
                        ? `Archived ${fmtDate(data.lead.archivedAt)}. `
                        : "It moves to the archive on the 1st. "}
                      {data.lead.statusBeforeDelete
                        ? `Reopening returns it to ${LEAD_STATUS_LABELS[data.lead.statusBeforeDelete]}.`
                        : "Reopening returns it to your pipeline."}
                    </p>
                  </div>
                  <Button size="sm" onClick={reopenLead} disabled={reopening} className="shrink-0">
                    {reopening ? "Reopening…" : "Reopen lead"}
                  </Button>
                </div>
              </div>
            )}

            {/* Both parties on the referral. Showing only the sender left the
                other side of the handover invisible on the lead itself. */}
            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-accent p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
                <div className="flex items-center gap-3">
                  <MemberAvatar userId={data.lead.referrer.id} name={data.lead.referrer.name} avatarUrl={data.lead.referrer.avatarUrl} className="h-10 w-10" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sent from</p>
                    <p className="font-semibold">{data.lead.referrer.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{data.lead.referrer.email ?? data.lead.referrer.phone ?? "Member"}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-violet-50 p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
                <div className="flex items-center gap-3">
                  <MemberAvatar userId={data.lead.owner.id} name={data.lead.owner.name} avatarUrl={data.lead.owner.avatarUrl} className="h-10 w-10" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-violet-700/70">Sent to</p>
                    <p className="font-semibold text-violet-900">{data.lead.owner.name}</p>
                    <p className="truncate text-xs text-violet-700/70">{data.lead.owner.email ?? data.lead.owner.phone ?? "Member"}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
              <h3 className="text-sm font-semibold">Your pipeline stage</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Where this lead sits in your pipeline. Update it here, or by dragging on the board.</p>
              {canEditStatus ? (
                <select
                  className={cn(selectClass, "mt-3")}
                  value={data.lead.status}
                  disabled={savingStatus}
                  onChange={(e) => changeStatus(e.target.value as LeadStatus)}
                >
                  {LEAD_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              ) : (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LEAD_STATUS_COLORS[data.lead.status].bg }} />
                  {LEAD_STATUS_LABELS[data.lead.status]}
                </div>
              )}
            </section>

            {(data.lead.email || data.lead.phone) && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">Reach out to {data.lead.contactName}</h3>
                <div className="flex flex-wrap gap-2">
                  {data.lead.email && (
                    <Button asChild variant="outline" size="sm">
                      <a href={`mailto:${data.lead.email}`}><Mail className="h-4 w-4" /> Email</a>
                    </Button>
                  )}
                  {data.lead.phone && (
                    <Button asChild variant="outline" size="sm">
                      <a href={`tel:${data.lead.phone}`}><Phone className="h-4 w-4" /> Call</a>
                    </Button>
                  )}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold">Lead details</h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Company" value={data.lead.company} />
                <Field label="Industry" value={data.lead.industry} />
                <Field label="Email" value={data.lead.email} />
                <Field label="Mobile" value={data.lead.phone} />
                <Field label="Received" value={fmtDate(data.lead.dateReceived)} />
                <Field label="Follow-up" value={fmtDate(data.lead.followUpDate)} />
                {/* Full date AND time here: the detail view is where someone
                    checks exactly when a lead came in. */}
                <Field label="Created" value={formatDateTime(data.lead.createdAt)} />
              </dl>
              {data.lead.notes && (
                <div className="mt-3 rounded-md bg-muted/40 p-3">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">Note from {data.lead.referrer.name}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{data.lead.notes}</p>
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Tasks</h3>
              {data.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.tasks.map((t) => (
                    <li key={t.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{t.title}</p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", TASK_PRIORITY_BADGE[t.priority])}>
                            {TASK_PRIORITY_LABELS[t.priority]}
                          </span>
                          {confirmTaskDel === t.id ? (
                            <span className="flex items-center gap-1">
                              <Button size="sm" variant="destructive" className="h-6 px-2 text-[11px]" onClick={() => deleteTask(t.id)}>Delete</Button>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setConfirmTaskDel(null)}>Cancel</Button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmTaskDel(t.id)} className="text-muted-foreground hover:text-rose-600" aria-label="Delete task">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDateTime(t.dueDate)}</span>
                        <span>·</span>
                        <span>To {t.assigneeName}</span>
                        <span>·</span>
                        <span>By {t.creatorName}</span>
                        <span>·</span>
                        <span>{TASK_STATUS_LABELS[t.status]}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 space-y-2 rounded-md border border-dashed p-3">
                <Input placeholder="New task…" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="due" className="text-xs">Due date &amp; time</Label>
                    <Input id="due" type="datetime-local" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="asn" className="text-xs">Assignee</Label>
                    <select id="asn" className={selectClass} value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}{m.id === currentUserId ? " (me)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={addTask} disabled={addingTask}>{addingTask ? "Adding…" : "Add task"}</Button>
                </div>
              </div>
            </section>

            <section className="rounded-lg bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
              <h3 className="text-sm font-semibold">Deal value</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Estimated revenue on this lead. It counts toward your revenue once you mark it Closed / Won.</p>
              <div className="mt-3 flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="rev">Estimated revenue on this lead (AUD)</Label>
                  <Input
                    id="rev"
                    type="number"
                    min={0}
                    step="500"
                    value={revenue}
                    disabled={!data.lead.canEditRevenue}
                    onChange={(e) => setRevenue(e.target.value)}
                  />
                </div>
                {data.lead.canEditRevenue && (
                  <Button onClick={saveRevenue} disabled={savingRev}>{savingRev ? "Saving…" : "Save"}</Button>
                )}
              </div>
              {data.lead.valueEstimate != null && (
                <p className="mt-2 text-sm">
                  Current: <span className="font-semibold text-primary">{formatCurrency(data.lead.valueEstimate)}</span>
                </p>
              )}
            </section>

                </CardContent>
              </Card>

              {/* Right card — Comments / Lead Chat */}
              <Card className="flex flex-col">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Comments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
            <section>
              {data.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.comments.map((c) => {
                    const mine = c.authorId === currentUserId;
                    return (
                      <li key={c.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                          {/* A conversation reads better with faces on it. */}
                          <MemberAvatar
                            userId={c.authorId}
                            name={c.authorName}
                            avatarUrl={c.authorAvatarUrl}
                            className="h-5 w-5"
                          />
                          <span className="font-medium text-foreground/80">{mine ? "You" : c.authorName}</span>
                          <span>{fmtCommentTime(c.createdAt)}</span>
                          {c.stage ? (
                            <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px]">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: LEAD_STATUS_COLORS[c.stage].bg }} />
                              {LEAD_STATUS_LABELS[c.stage]}
                            </span>
                          ) : null}
                        </div>
                        <div
                          className={cn(
                            "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                            mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          )}
                        >
                          {c.body}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-3 space-y-2">
                <Textarea
                  rows={2}
                  placeholder="Add a comment…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter sends; Shift+Enter (or Ctrl/Cmd+Enter) still makes a
                    // new line. Bound to the textarea, so it only fires while the
                    // cursor is in this box — typing Enter anywhere else on the
                    // page is unaffected. IME composition is ignored so Enter
                    // confirming a character never posts a half-typed comment.
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.ctrlKey &&
                      !e.metaKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      if (!postingComment && comment.trim()) void addComment();
                    }
                  }}
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={addComment} disabled={postingComment || !comment.trim()}>
                    {postingComment ? "Posting…" : "Comment"}
                  </Button>
                </div>
              </div>
            </section>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
    </div>
  );
}
