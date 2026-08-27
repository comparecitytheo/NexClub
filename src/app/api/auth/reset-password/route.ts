import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getClientContext } from "@/server/request";
import { resetPasswordSchema } from "@/server/validators/auth";
import { hashToken } from "@/lib/tokens";
import { recordAudit } from "@/server/audit";
import { getOrgSettings } from "@/server/admin/settings";

export async function POST(req: Request) {
  // Rate-limited like forgot-password: without it the token lookup is an
  // unbounded guessing oracle, and a leaked link can be replayed at speed.
  const { ipAddress } = getClientContext(req);
  const rl = rateLimit(`reset-password:${ipAddress ?? "unknown"}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expires < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  // Enforce the org's configured minimum password length (in addition to the
  // base strong-password schema), so the security setting takes effect.
  const settings = await getOrgSettings(record.user.organizationId);
  if (password.length < settings.security.passwordMinLength) {
    return NextResponse.json({ error: `Password must be at least ${settings.security.passwordMinLength} characters.` }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { hashedPassword } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  await recordAudit({
    organizationId: record.user.organizationId,
    actorId: record.userId,
    action: "UPDATE",
    entityType: "User",
    entityId: record.userId,
  });

  return NextResponse.json({ ok: true });
}
