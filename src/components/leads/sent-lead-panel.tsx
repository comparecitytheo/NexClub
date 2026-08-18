"use client";
import { useEffect, useState } from "react";
import { DateTimeField } from "@/components/shared/date-time-field";
import { toast } from "sonner";
import { ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_BADGE,
  TASK_STATUS_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/components/shared/member-avatar";
import type { SentLeadStatus, LeadStatus, TaskPriority, TaskStatus } from "@prisma/client";

type Member = { id: string; name: string };

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
    sentStatus: SentLeadStatus;
    valueEstimate: number | null;
    dateReceived: string;
    followUpDate: string | null;
    referrerName: string;
    owner: { id: string; name: string; email: string | null; phone: string | null; avatarUrl: string | null };
    canEditRevenue: boolean;
  };
  tasks: { id: string; title: string; status: TaskStatus; priority: TaskPriority; dueDate: string | null; assigneeName: string }[];
  comments: { id: string; body: string; createdAt: string; authorName: string; authorId: string; stage: LeadStatus | null }[];
};

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function fmtDateTime(iso: string | null) {
  if (!iso) return "No due date";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
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

export function SentLeadPanel({
  leadId,
  members,
  currentUserId,
  onClose,
  onBump,
  onValue,
}: {
  leadId: string;
  members: Member[];
  currentUserId: string;
  onClose: () => void;
  onBump: (field: "task" | "comment") => void;
  onValue: (value: number | null) => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  const [revenue, setRevenue] = useState("");
  const [savingRev, setSavingRev] = useState(false);

  const [comment, setComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskAssignee, setTaskAssignee] = useState(currentUserId);
  const [addingTask, setAddingTask] = useState(false);

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
    toast.success("Revenue updated.");
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
    onBump("comment");
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
              },
            ],
          }
        : cur
    );
    setTaskTitle("");
    setTaskDue("");
    onBump("task");
    toast.success("Task added.");
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">Lead sent</p>
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
                  <CardTitle className="text-lg">Lead Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LEAD_STATUS_COLORS[data.lead.status].bg }} />
                {LEAD_STATUS_LABELS[data.lead.status]}
              </span>
              <span className="text-xs text-muted-foreground">Recipient&apos;s pipeline stage</span>
            </div>

            <section className="rounded-lg bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
              <div className="flex items-center gap-3">
                <MemberAvatar userId={data.lead.owner.id} name={data.lead.owner.name} avatarUrl={data.lead.owner.avatarUrl} className="h-10 w-10" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sent to</p>
                  <p className="font-semibold">{data.lead.owner.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{data.lead.owner.email ?? data.lead.owner.phone ?? ""}</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Lead details</h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Company" value={data.lead.company} />
                <Field label="Industry" value={data.lead.industry} />
                <Field label="Email" value={data.lead.email} />
                <Field label="Mobile" value={data.lead.phone} />
                <Field label="Sent by" value={data.lead.referrerName} />
                <Field label="Sent on" value={fmtDateTime(data.lead.dateReceived)} />
              </dl>
              {data.lead.notes && (
                <div className="mt-3 rounded-md bg-muted/40 p-3">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">Note sent with lead</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{data.lead.notes}</p>
                </div>
              )}
            </section>

            <section className="rounded-lg bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
              <h3 className="text-sm font-semibold">Revenue</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Counts toward revenue once the recipient marks this Closed / Won. Does not affect any pipeline value.
              </p>
              <div className="mt-3 flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="rev">Lead value (AUD)</Label>
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
                        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", TASK_PRIORITY_BADGE[t.priority])}>
                          {TASK_PRIORITY_LABELS[t.priority]}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDateTime(t.dueDate)}</span>
                        <span>·</span>
                        <span>{t.assigneeName}</span>
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
                    <DateTimeField id="due" withTime value={taskDue} onChange={setTaskDue} placeholder="Due date & time" />
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
                <Textarea rows={2} placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
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
