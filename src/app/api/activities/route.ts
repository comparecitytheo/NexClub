import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, requireUserForWrite } from "@/server/api-helpers";
import { isAdminOrAbove } from "@/lib/rbac";
import { activityScope } from "@/server/scope";
import { entityExistsInOrg, entityLink, entityFkField } from "@/server/entity";
import { createActivitySchema, listActivitiesSchema } from "@/server/validators/activity";

const ACTIVITY_INCLUDE = {
  user: { select: { id: true, name: true } },
  lead: { select: { id: true, contactName: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  deal: { select: { id: true, name: true } },
} satisfies Prisma.ActivityInclude;

export async function GET(req: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  const { searchParams } = new URL(req.url);
  const parsed = listActivitiesSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  const { entityType, entityId, scope } = parsed.data;

  let where: Prisma.ActivityWhereInput;
  if (entityType && entityId) {
    where = { organizationId: user.organizationId, [entityFkField(entityType)]: entityId };
  } else if (scope === "all" && isAdminOrAbove(user.role)) {
    where = { organizationId: user.organizationId };
  } else {
    where = activityScope(user);
  }

  const items = await prisma.activity.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    take: 50,
    include: ACTIVITY_INCLUDE,
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

  const parsed = createActivitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { type, subject, body, entityType, entityId, occurredAt } = parsed.data;

  const ok = await entityExistsInOrg(entityType, entityId, user.organizationId);
  if (!ok) return NextResponse.json({ error: "Linked record not found" }, { status: 400 });

  const activity = await prisma.activity.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      type,
      subject,
      body: body ?? null,
      occurredAt: occurredAt ?? new Date(),
      entityType,
      ...entityLink(entityType, entityId),
    },
    include: ACTIVITY_INCLUDE,
  });

  // Keep a lead's pipeline timestamp fresh when activity is logged against it.
  if (entityType === "LEAD") {
    await prisma.lead.update({ where: { id: entityId }, data: { lastActivityAt: new Date() } }).catch(() => {});
  }

  return NextResponse.json(activity, { status: 201 });
}
