import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { ownerScope } from "@/server/scope";
import { moveDealSchema } from "@/server/validators/deal";
import { closedFields } from "@/server/deal-helpers";
import { recordAudit } from "@/server/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const deal = await prisma.deal.findFirst({ where: { id, ...ownerScope(user) } });
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const parsed = moveDealSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { stage, boardPosition } = parsed.data;

  const updated = await prisma.deal.update({
    where: { id },
    data: { stage, boardPosition, ...closedFields(stage) },
    select: { id: true, stage: true, boardPosition: true },
  });

  if (stage !== deal.stage) {
    await prisma.activity.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        type: "NOTE",
        subject: `Deal moved to ${stage.replaceAll("_", " ").toLowerCase()}`,
        entityType: "DEAL",
        dealId: id,
      },
    });
    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "STATUS_CHANGE",
      entityType: "Deal",
      entityId: id,
      before: { stage: deal.stage },
      after: { stage },
    });
  }

  return NextResponse.json(updated);
}
