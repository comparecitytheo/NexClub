import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notify";
import { requireUser } from "@/server/api-helpers";
import { taskScope } from "@/server/scope";
import { updateTaskSchema } from "@/server/validators/task";
import { recordAudit } from "@/server/audit";
import { TASK_INCLUDE } from "@/server/includes";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { id } = await params;

  const task = await prisma.task.findFirst({ where: { id, ...taskScope(a.user) }, include: TASK_INCLUDE });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const existing = await prisma.task.findFirst({ where: { id, ...taskScope(user) } });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const parsed = updateTaskSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { assigneeId, recurrence, dueDate, status, ...rest } = parsed.data;

  const data: Prisma.TaskUpdateInput = { ...rest };

  if (dueDate !== undefined) data.dueDate = dueDate ?? null;

  if (recurrence !== undefined) {
    const isRecurring = recurrence !== "NONE";
    data.isRecurring = isRecurring;
    data.recurrenceRule = isRecurring ? recurrence : null;
  }

  if (status !== undefined) {
    data.status = status;
    data.completedAt = status === "COMPLETED" ? new Date() : null;
  }

  let reassigned = false;
  if (assigneeId !== undefined && assigneeId !== existing.assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assigneeId, organizationId: user.organizationId, isActive: true },
      select: { id: true, name: true },
    });
    if (!assignee) return NextResponse.json({ error: "Assignee is not an active member." }, { status: 400 });
    data.assignee = { connect: { id: assigneeId } };
    reassigned = true;
  }

  const task = await prisma.task.update({ where: { id }, data, include: TASK_INCLUDE });

  if (reassigned && assigneeId && assigneeId !== user.id) {
    await notify({
      organizationId: user.organizationId,
      recipientIds: [assigneeId],
      actorId: user.id,
      type: "TASK_ASSIGNED",
      title: "Task assigned to you",
      body: `${user.name} assigned you: ${task.title}`,
      entityType: existing.entityType,
      entityId: existing.entityType ? (existing.leadId ?? existing.contactId ?? existing.companyId ?? existing.dealId) : null,
      email: { actorName: user.name, taskTitle: task.title },
    });
  }

  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "UPDATE", entityType: "Task", entityId: id });
  return NextResponse.json(task);
}

export async function DELETE(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const existing = await prisma.task.findFirst({ where: { id, ...taskScope(user) } });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  await prisma.task.softDelete({ id });
  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "DELETE", entityType: "Task", entityId: id });
  return NextResponse.json({ ok: true });
}
