"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { TaskPriority, TaskStatus, EntityType } from "@prisma/client";
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_ORDER, TASK_STATUS_LABELS, RECURRENCE_OPTIONS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Member = { id: string; name: string };

type Values = {
  title: string;
  description?: string;
  assigneeId: string;
  dueDate?: string;
  priority: TaskPriority;
  recurrence: string;
  status?: TaskStatus;
};

type Props = {
  members: Member[];
  initial?: Partial<Values>;
  id?: string;
  prefillEntity?: { type: EntityType; id: string } | null;
};

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function entityHref(type: EntityType, id: string): string {
  const seg = type === "LEAD" ? "leads" : type === "CONTACT" ? "contacts" : type === "COMPANY" ? "companies" : "deals";
  return `/${seg}/${id}`;
}

export function TaskForm({ members, initial, id, prefillEntity }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ defaultValues: { priority: TaskPriority.MEDIUM, recurrence: "NONE", ...initial } });

  async function onSubmit(values: Values) {
    setLoading(true);
    const payload = {
      ...values,
      ...(prefillEntity ? { entityType: prefillEntity.type, entityId: prefillEntity.id } : {}),
    };
    const res = await fetch(id ? `/api/tasks/${id}` : "/api/tasks", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not save the task.");
      return;
    }
    toast.success(id ? "Task updated." : "Task created.");
    if (!id && prefillEntity) router.push(entityHref(prefillEntity.type, prefillEntity.id));
    else router.push("/tasks");
    router.refresh();
  }

  async function onDelete() {
    if (!id || !confirm("Delete this task?")) return;
    setDeleting(true);
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Could not delete the task.");
      return;
    }
    toast.success("Task deleted.");
    router.push("/tasks");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register("title", { required: "Required" })} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...register("description")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assigneeId">Assignee</Label>
          <select id="assigneeId" className={selectClass} {...register("assigneeId", { required: "Choose an assignee" })}>
            <option value="" disabled>Choose a member…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          {errors.assigneeId && <p className="text-sm text-destructive">{errors.assigneeId.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueDate">Due date</Label>
          <Input id="dueDate" type="date" {...register("dueDate")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <select id="priority" className={selectClass} {...register("priority")}>
            {TASK_PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="recurrence">Repeat</Label>
          <select id="recurrence" className={selectClass} {...register("recurrence")}>
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {id && (
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select id="status" className={selectClass} {...register("status")}>
              {Object.values(TaskStatus).map((s) => (
                <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {prefillEntity && (
        <p className="text-xs text-muted-foreground">This task will be linked to the {prefillEntity.type.toLowerCase()} you came from.</p>
      )}

      <div className="flex items-center justify-between">
        <div>
          {id && (
            <Button type="button" variant="destructive" onClick={onDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/tasks")}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : id ? "Save changes" : "Create task"}
          </Button>
        </div>
      </div>
    </form>
  );
}
