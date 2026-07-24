import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { taskScope } from "@/server/scope";
import { recordAudit } from "@/server/audit";

type Params = { params: Promise<{ id: string }> };

function advance(date: Date, freq: string): Date {
  const next = new Date(date);
  if (freq === "DAILY") next.setDate(next.getDate() + 1);
  else if (freq === "WEEKLY") next.setDate(next.getDate() + 7);
  else if (freq === "MONTHLY") next.setMonth(next.getMonth() + 1);
  return next;
}

export async function POST(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const task = await prisma.task.findFirst({ where: { id, ...taskScope(user) } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (task.status === "COMPLETED") return NextResponse.json({ ok: true });

  await prisma.task.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });

  // Spawn the next occurrence for a recurring task.
  let nextTaskId: string | null = null;
  if (task.isRecurring && task.recurrenceRule && task.dueDate) {
    const next = await prisma.task.create({
      data: {
        organizationId: task.organizationId,
        creatorId: task.creatorId,
        assigneeId: task.assigneeId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: advance(task.dueDate, task.recurrenceRule),
        isRecurring: true,
        recurrenceRule: task.recurrenceRule,
        parentTaskId: task.parentTaskId ?? task.id,
        entityType: task.entityType,
        leadId: task.leadId,
        contactId: task.contactId,
        companyId: task.companyId,
        dealId: task.dealId,
      },
    });
    nextTaskId = next.id;
  }

  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "UPDATE", entityType: "Task", entityId: id, after: { status: "COMPLETED" } });
  return NextResponse.json({ ok: true, nextTaskId });
}
