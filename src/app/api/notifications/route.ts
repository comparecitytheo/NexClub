import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireUserForWrite } from "@/server/api-helpers";

export async function GET() {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: user.id, organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    prisma.notification.count({ where: { recipientId: user.id, organizationId: user.organizationId, isRead: false } }),
  ]);

  return NextResponse.json({ items, unreadCount });
}

export async function PATCH(req: Request) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; all?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  const all = body.all === true;
  if (!all && ids.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  await prisma.notification.updateMany({
    where: { recipientId: user.id, isRead: false, ...(all ? {} : { id: { in: ids } }) },
    data: { isRead: true, readAt: new Date() },
  });

  const unreadCount = await prisma.notification.count({ where: { recipientId: user.id, organizationId: user.organizationId, isRead: false } });
  return NextResponse.json({ ok: true, unreadCount });
}
