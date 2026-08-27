import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireSuperAdminForWrite } from "@/server/api-helpers";
import { getClientContext } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { sendMail } from "@/lib/email";
import { getOrgSettings } from "@/server/admin/settings";
import { refreshInvitationToken, mapInvitation } from "@/server/invitations";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const ctx = getClientContext(req);
  const { id } = await params;

  const inv = await prisma.invitation.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true, status: true } });
  if (!inv) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  if (inv.status === "ACCEPTED") return NextResponse.json({ error: "This invitation was already accepted." }, { status: 409 });

  const settings = await getOrgSettings(user.organizationId);
  const base = env.AUTH_URL ?? "http://localhost:3000";
  const { invitation, email } = await refreshInvitationToken(id, base, settings.branding.companyName);

  // The account/token work is already committed; an SMTP failure must not
  // fail the request. Logged so a missing email is traceable.
  await sendMail({ to: invitation.email, subject: email.subject, html: email.html }).catch((e) =>
    console.error("[email] invitation resend send failed:", String(e))
  );
  await recordAudit({
    organizationId: user.organizationId, actorId: user.id, action: "UPDATE", entityType: "Invitation",
    entityId: id, after: { resent: true }, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent,
  });
  return NextResponse.json({ invitation: mapInvitation(invitation), sent: true });
}
