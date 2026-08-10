import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leadAccessWhere } from "@/server/businesses";
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

  // `archivedAt: undefined` at the top level overrides the extension's injected
  // `archivedAt: null`, so an archived lead can still be opened from the Deleted
  // tab. Access is unchanged: the caller must still be a party to the lead, or
  // an admin.
  const lead = await prisma.lead.findFirst({
    where: {
      archivedAt: undefined,
      id,
      organizationId: user.organizationId,
      ...(await leadAccessWhere(user.id, admin)),
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
          creator: { select: { name: true } },
        },
      },
      noteEntries: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: { id: true, body: true, createdAt: true, leadStageAtPost: true, author: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    lead: {
      id: lead.id,
      // Defensive: a lead row should always have createdAt, but an
      // unguarded .toISOString() would take the whole detail view down if
      // one ever did not. The field is optional in the client type.
      createdAt: lead.createdAt ? new Date(lead.createdAt).toISOString() : null,
      contactName: lead.contactName,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      industry: lead.industry,
      notes: lead.notes,
      source: lead.source,
      status: lead.status,
      // Deletion trail, so the panel can show a Deleted banner and offer Reopen.
      statusBeforeDelete: lead.statusBeforeDelete,
      deletedOn: lead.deletedOn?.toISOString() ?? null,
      archivedAt: lead.archivedAt?.toISOString() ?? null,
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
      creatorName: t.creator.name,
    })),
    comments: lead.noteEntries.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      authorName: n.author.name,
      authorAvatarUrl: n.author.avatarUrl,
      authorId: n.author.id,
      stage: n.leadStageAtPost,
    })),
  });
}
