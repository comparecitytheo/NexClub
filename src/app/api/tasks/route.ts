import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notify";
import { requireUser, requireUserForWrite } from "@/server/api-helpers";
import { isAdmin } from "@/lib/rbac";
import { entityExistsInOrg, entityLink, entityFkField } from "@/server/entity";
import { TASK_INCLUDE } from "@/server/includes";
import { createTaskSchema, listTasksSchema } from "@/server/validators/task";
import { recordAudit } from "@/server/audit";


export async function GET(req: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const admin = isAdmin(user.role);

  const { searchParams } = new URL(req.url);
  const parsed = listTasksSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  const { scope, status, q, entityType, entityId } = parsed.data;

  const and: Prisma.TaskWhereInput[] = [{ organizationId: user.organizationId }];

  if (scope === "assigned") and.push({ assigneeId: user.id });
  else if (scope === "created") and.push({ creatorId: user.id });
  else if (scope === "mine") and.push({ OR: [{ assigneeId: user.id }, { creatorId: user.id }] });
  else if (!admin) and.push({ OR: [{ assigneeId: user.id }, { creatorId: user.id }] }); // "all" is org-wide only for admins

  if (status === "open") and.push({ status: { in: ["OPEN", "IN_PROGRESS"] } });
  else if (status === "completed") and.push({ status: "COMPLETED" });

  if (q) and.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] });

  // Filter to a specific linked entity (inline panel on an overview page).
  if (entityType && entityId) and.push({ [entityFkField(entityType)]: entityId });

  const items = await prisma.task.findMany({
    where: { AND: and },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: TASK_INCLUDE,
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

  const parsed = createTaskSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { assigneeId, recurrence, entityType, entityId, dueDate, ...rest } = parsed.data;

  const assignee = await prisma.user.findFirst({
    where: { id: assigneeId, organizationId: user.organizationId, isActive: true },
    select: { id: true, name: true },
  });
  if (!assignee) return NextResponse.json({ error: "Assignee is not an active member." }, { status: 400 });

  let link: Record<string, string> = {};
  if (entityType && entityId) {
    const ok = await entityExistsInOrg(entityType, entityId, user.organizationId);
    if (!ok) return NextResponse.json({ error: "Linked record not found" }, { status: 400 });
    link = { entityType, ...entityLink(entityType, entityId) };
  }

  const isRecurring = recurrence !== "NONE";
  const task = await prisma.task.create({
    data: {
      ...rest,
      organizationId: user.organizationId,
      creatorId: user.id,
      assigneeId,
      dueDate: dueDate ?? null,
      isRecurring,
      recurrenceRule: isRecurring ? recurrence : null,
      ...link,
    },
    include: TASK_INCLUDE,
  });

  if (assignee.id !== user.id) {
    await notify({
      organizationId: user.organizationId,
      recipientIds: [assignee.id],
      actorId: user.id,
      type: "TASK_ASSIGNED",
      title: "New task assigned",
      body: `${user.name} assigned you: ${task.title}`,
      entityType: entityType ?? null,
      entityId: entityType ? entityId : null,
      email: { actorName: user.name, taskTitle: task.title },
    });
  }
  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "CREATE", entityType: "Task", entityId: task.id });
  return NextResponse.json(task, { status: 201 });
}
