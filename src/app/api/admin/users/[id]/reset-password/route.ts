import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireSuperAdminForWrite } from "@/server/api-helpers";
import { canManageRole } from "@/lib/rbac";
import { getClientContext } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { generateToken, hashToken } from "@/lib/tokens";
import { sendMail } from "@/lib/email";
import { getOrgSettings } from "@/server/admin/settings";

type Params = { params: Promise<{ id: string }> };

const ONE_HOUR = 60 * 60 * 1000;

// Trigger a password reset for another member: email a reset link AND return a
// copyable one-time link. The raw token is never stored (only its SHA-256 hash),
// the link is single-use + expires in an hour, and the action is audited.
export async function POST(req: Request, { params }: Params) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;
  const ctx = getClientContext(req);

  const target = await prisma.user.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!canManageRole(user.role, target.role)) {
    return NextResponse.json({ error: "You do not have permission to manage this member." }, { status: 403 });
  }

  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: { userId: target.id, tokenHash: hashToken(token), expires: new Date(Date.now() + ONE_HOUR) },
  });

  const settings = await getOrgSettings(user.organizationId);
  const base = env.AUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${base}/reset-password?token=${token}`;
  await sendMail({
    to: target.email,
    subject: `Reset your ${settings.branding.companyName} password`,
    html: `<p>Hi ${target.name},</p><p>A password reset was requested for your account. <a href="${resetUrl}">Reset your password</a> — valid for 1 hour. If you didn't expect this, contact your administrator.</p>`,
  });

  await recordAudit({
    organizationId: user.organizationId, actorId: user.id, action: "UPDATE", entityType: "User", entityId: id,
    after: { passwordResetRequested: true }, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent,
  });

  return NextResponse.json({ ok: true, resetUrl });
}
