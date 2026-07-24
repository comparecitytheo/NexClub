import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { isAdmin } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// Detail payload for the Sent Leads overview panel. Visible to the sender
// (referrer), the recipient (owner), or an admin.
export async function GET(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;
  const admin = isAdmin(user.role);

  const lead = await prisma.lead.findFirst({
    where: {
      id,
      organizationId: user.organizationId,
      ...(admin ? {} : { OR: [{ referrerId: user.id }, { ownerId: user.id }] }),
    },
    include: {
      owner: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
      referrer: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
      taskEntries: {
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 50,
        select: {
          id: true, title: true, status: true, priority: true, dueDate: true,
          assignee: { select: { name: true } },
        },
      },
      noteEntries: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: { id: true, body: true, createdAt: true, leadStageAtPost: true, author: { select: { id: true, name: true } } },
      },
    },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    lead: {
      id: lead.id,
      contactName: lead.contactName,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      industry: lead.industry,
      notes: lead.notes,
      source: lead.source,
      status: lead.status,
      sentStatus: lead.sentStatus,
      valueEstimate: lead.valueEstimate == null ? null : Number(lead.valueEstimate),
      dateReceived: lead.dateReceived.toISOString(),
      followUpDate: lead.followUpDate ? lead.followUpDate.toISOString() : null,
      referrerName: lead.referrer.name,
      referrer: lead.referrer,
      owner: lead.owner,
      canEditRevenue: admin || lead.referrerId === user.id || lead.ownerId === user.id,
    },
    tasks: lead.taskEntries.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      assigneeName: t.assignee.name,
    })),
    comments: lead.noteEntries.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      authorName: n.author.name,
      authorId: n.author.id,
      stage: n.leadStageAtPost,
    })),
  });
}
