import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireAdminForWrite, requireSuperAdmin } from "@/server/api-helpers";
import { resolveInviteScope } from "@/lib/rbac";
import { getClientContext } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { sendMail } from "@/lib/email";
import { getOrgSettings } from "@/server/admin/settings";
import { createInvitationSchema } from "@/server/validators/invitation";
import { createInvitation, mapInvitation } from "@/server/invitations";

// List (Super Admin only — used by the admin Members surface).
export async function GET() {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const items = await prisma.invitation.findMany({
    where: { organizationId: a.user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ items: items.map(mapInvitation) });
}

// Send an invitation. Open to Admins and above; the invited role + target
// business are decided server-side from the CALLER:
//   - Super Admin  -> invites a business Admin for the business they name.
//   - business Admin -> invites a standard member to THEIR OWN business only.
// The Super Admin role is never assignable through this path.
export async function POST(req: Request) {
  const a = await requireAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const ctx = getClientContext(req);

  const parsed = createInvitationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;
  const email = data.email.toLowerCase();

  // Read the caller's business from the RELATION, not the display mirror. This
  // is the line that stops an admin inviting into someone else's business: the
  // name they submit is ignored unless they are a Super Admin.
  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { business: { select: { id: true, name: true } } },
  });
  const { role, businessName } = resolveInviteScope({
    callerRole: user.role,
    callerBusinessName: me?.business?.name ?? null,
    submittedBusinessName: data.businessName,
  });
  if (!businessName) {
    return NextResponse.json(
      { error: "A business name is required.", fieldErrors: { businessName: ["A business name is required."] } },
      { status: 400 }
    );
  }

  // Unique per pending invite.
  const dupe = await prisma.invitation.findFirst({
    where: { organizationId: user.organizationId, email, status: "PENDING" },
    select: { id: true },
  });
  if (dupe) {
    return NextResponse.json(
      { error: "A pending invitation already exists for this email.", fieldErrors: { email: ["A pending invitation already exists for this email."] } },
      { status: 409 }
    );
  }
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    return NextResponse.json(
      { error: "A member with this email already exists.", fieldErrors: { email: ["A member with this email already exists."] } },
      { status: 409 }
    );
  }

  const settings = await getOrgSettings(user.organizationId);
  const base = env.AUTH_URL ?? "http://localhost:3000";
  const { invitation, email: mail } = await createInvitation({
    ...data,
    businessName, // scoped: for a business admin this is their own business
    role, // ADMIN (business admin) or SALES_REP (member) — never SUPER_ADMIN
    organizationId: user.organizationId,
    invitedById: user.id,
    base,
    companyName: settings.branding.companyName,
  });

  // The account/token work is already committed; an SMTP failure must not
  // fail the request. Logged so a missing email is traceable.
  await sendMail({ to: invitation.email, subject: mail.subject, html: mail.html }).catch((e) =>
    console.error("[email] invitation send failed:", String(e))
  );
  await recordAudit({
    organizationId: user.organizationId, actorId: user.id, action: "CREATE", entityType: "Invitation",
    entityId: invitation.id, after: mapInvitation(invitation), ipAddress: ctx.ipAddress, userAgent: ctx.userAgent,
  });

  return NextResponse.json({ invitation: mapInvitation(invitation), sent: true }, { status: 201 });
}
