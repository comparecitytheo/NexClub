import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken, tokenHashEquals } from "@/lib/tokens";
import { rateLimit } from "@/lib/rate-limit";
import { getClientContext } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { acceptInvitationSchema } from "@/server/validators/invitation";
import { acceptInvitation } from "@/server/invitations";

// Token lookup for the acceptance landing page (read-only, public).
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ valid: false, reason: "invalid" });

  const inv = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!inv || inv.status === "REVOKED") return NextResponse.json({ valid: false, reason: "invalid" });
  if (inv.status === "ACCEPTED") return NextResponse.json({ valid: false, reason: "accepted" });
  if (inv.status === "EXPIRED" || inv.expiresAt.getTime() < Date.now()) return NextResponse.json({ valid: false, reason: "expired" });

  return NextResponse.json({
    valid: true,
    invitation: { businessName: inv.businessName, contactPerson: inv.contactPerson, email: inv.email, industry: inv.industry },
  });
}

// Complete acceptance: set password, create the member with all five fields.
export async function POST(req: Request) {
  // Rate-limit account creation per client to blunt token brute-forcing.
  const { ipAddress } = getClientContext(req);
  const rl = rateLimit(`accept-invite:${ipAddress ?? "unknown"}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const parsed = acceptInvitationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { token, password } = parsed.data;

  // Tokens are looked up by their stored hash (the raw token is never compared);
  // the constant-time re-check makes hash verification timing-safe at the boundary.
  const inv = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { status: true, role: true, tokenHash: true },
  });
  if (!inv || !tokenHashEquals(inv.tokenHash, hashToken(token)) || inv.status !== "PENDING") {
    return NextResponse.json({ error: "This invitation link is no longer valid." }, { status: 400 });
  }
  // The role was fixed when the invite was sent (business admin or member).
  // Defensive: the Super Admin role is never granted through acceptance.
  const role = inv.role === "SUPER_ADMIN" ? "ADMIN" : inv.role;

  const result = await acceptInvitation({ rawToken: token, password, role });
  if (!result.ok) {
    const msg =
      result.reason === "expired" ? "This invitation has expired."
      : result.reason === "exists" ? "An account with this email already exists."
      : "This invitation link is no longer valid.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await recordAudit({
    organizationId: result.invitation.organizationId, actorId: result.user.id, action: "CREATE",
    entityType: "User", entityId: result.user.id, after: { viaInvitation: result.invitation.id },
  });
  return NextResponse.json({ ok: true, email: result.user.email });
}
