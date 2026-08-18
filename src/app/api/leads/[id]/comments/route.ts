import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leadAccessWhere } from "@/server/businesses";
import { requireUserForWrite } from "@/server/api-helpers";
import { isAdminOrAbove, isSuperAdmin } from "@/lib/rbac";
import { leadCommentSchema } from "@/server/validators/lead";
import { notify } from "@/server/notify";

type Params = { params: Promise<{ id: string }> };

// Resolve "@Full Name" mentions against active members of the org. Whole-name
// matching keeps multi-word names working; unmatched tokens are ignored.
async function resolveMentionedUserIds(organizationId: string, body: string): Promise<string[]> {
  if (!body.includes("@")) return [];
  const members = await prisma.user.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, name: true },
  });
  const haystack = body.toLowerCase();
  return members
    .filter((m) => m.name && haystack.includes(`@${m.name.toLowerCase()}`))
    .map((m) => m.id);
}

// Comments on a lead are stored as Notes (entityType LEAD). Either party
// (sender/recipient) or an admin can comment.
export async function POST(req: Request, { params }: Params) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;
  const admin = isAdminOrAbove(user.role);

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: user.organizationId, ...(await leadAccessWhere(user.id, isSuperAdmin(user.role))) },
    select: { id: true, referrerId: true, ownerId: true, contactName: true, status: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = leadCommentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const snippet = parsed.data.body.replace(/\s+/g, " ").trim().slice(0, 140);
  const mentionedIds = await resolveMentionedUserIds(user.organizationId, parsed.data.body);

  const note = await prisma.note.create({
    data: {
      organizationId: user.organizationId,
      authorId: user.id,
      body: parsed.data.body,
      entityType: "LEAD",
      leadId: id,
      leadStageAtPost: lead.status,
      ...(mentionedIds.length ? { mentions: { connect: mentionedIds.map((mid) => ({ id: mid })) } } : {}),
    },
    select: { id: true, body: true, createdAt: true, leadStageAtPost: true, author: { select: { id: true, name: true, avatarUrl: true } } },
  });

  // Both parties on a lead can see its comments, so both are notified. `notify`
  // drops the author and de-dupes, so an admin commenting reaches both sides once.
  const notified = await notify({
    organizationId: user.organizationId,
    recipientIds: [lead.referrerId, lead.ownerId],
    actorId: user.id,
    type: "LEAD_COMMENT",
    title: `${user.name} commented on ${lead.contactName}`,
    body: snippet,
    entityType: "LEAD",
    entityId: id,
    email: { actorName: user.name, leadName: lead.contactName, excerpt: snippet },
  });

  // Anyone @mentioned who was not already told about the comment gets a mention
  // notification instead, so a mentioned party still receives exactly one email.
  await notify({
    organizationId: user.organizationId,
    recipientIds: mentionedIds.filter((mid) => !notified.includes(mid)),
    actorId: user.id,
    type: "MENTIONED_IN_NOTE",
    title: `${user.name} mentioned you on ${lead.contactName}`,
    body: snippet,
    entityType: "LEAD",
    entityId: id,
    email: { actorName: user.name, leadName: lead.contactName, excerpt: snippet },
  });

  return NextResponse.json(
    {
      id: note.id,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      authorName: note.author.name,
      authorAvatarUrl: note.author.avatarUrl,
      authorId: note.author.id,
      stage: note.leadStageAtPost,
    },
    { status: 201 }
  );
}
