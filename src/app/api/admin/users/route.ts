import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireSuperAdmin } from "@/server/api-helpers";
import { canManageRole } from "@/lib/rbac";
import { getClientContext } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { generateToken, hashToken } from "@/lib/tokens";
import { sendMail } from "@/lib/email";
import { getOrgSettings } from "@/server/admin/settings";
import { listMembersSchema, createMemberSchema } from "@/server/validators/admin";

// New-account setup links live longer than a password reset (7 days vs 1 hour).
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;

  const { searchParams } = new URL(req.url);
  const parsed = listMembersSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  const { page, pageSize, q, role, status, joinedFrom, joinedTo } = parsed.data;

  const where: Prisma.UserWhereInput = {
    organizationId: user.organizationId,
    ...(role ? { role } : {}),
    ...(status ? { isActive: status === "active" } : {}),
    ...(joinedFrom || joinedTo
      ? { createdAt: { ...(joinedFrom ? { gte: joinedFrom } : {}), ...(joinedTo ? { lte: joinedTo } : {}) } }
      : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      // hashedPassword is selected only to derive `pendingSetup`; it is never returned.
      select: { id: true, name: true, email: true, role: true, isActive: true, businessName: true, createdAt: true, hashedPassword: true },
    }),
  ]);

  const items = rows.map(({ hashedPassword, createdAt, ...u }) => ({
    ...u,
    createdAt: createdAt.toISOString(),
    pendingSetup: hashedPassword === null, // invited but hasn't set a password yet
  }));

  return NextResponse.json({ items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(req: Request) {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;
  const ctx = getClientContext(req);

  const parsed = createMemberSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { name, role, isActive, businessName } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  // Defence in depth: run the tier check even though the whole route is Super Admin.
  if (!canManageRole(user.role, role)) return NextResponse.json({ error: "You cannot assign that role." }, { status: 403 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

  // Create with NO password; the emailed setup link lets them choose their own.
  const created = await prisma.user.create({
    data: { organizationId: user.organizationId, name, email, role, isActive, businessName: businessName ?? null },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  // The invite token is a hashed, single-use, expiring PasswordResetToken — the
  // same mechanism as a reset, so the existing /reset-password page handles it.
  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: { userId: created.id, tokenHash: hashToken(token), expires: new Date(Date.now() + INVITE_TTL_MS) },
  });

  const settings = await getOrgSettings(user.organizationId);
  const base = env.AUTH_URL ?? "http://localhost:3000";
  const setupUrl = `${base}/reset-password?token=${token}`;
  await sendMail({
    to: email,
    subject: `You've been invited to ${settings.branding.companyName}`,
    html: `<p>Hi ${name},</p><p>An account has been created for you on ${settings.branding.companyName}. <a href="${setupUrl}">Set your password</a> to get started — this link is valid for 7 days.</p>`,
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "CREATE",
    entityType: "User",
    entityId: created.id,
    after: { email, role, isActive },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  // setupUrl is returned so the panel can also offer a copyable link (useful when
  // SMTP isn't configured). The raw token is never stored — only its hash is.
  return NextResponse.json({ ...created, inviteSent: true, setupUrl }, { status: 201 });
}
