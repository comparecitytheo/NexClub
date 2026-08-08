import { auth } from "@/lib/auth";
import { readSupportSession } from "@/server/support-session";

/**
 * WHO THE APP SHOULD RENDER FOR.
 *
 * Normally the signed-in user. When a Super Admin is in support mode, this
 * returns the MEMBER they are helping — so every page, query and role check
 * behaves exactly as it does for that member, including which business they
 * belong to and what their nav looks like.
 *
 * The real identity is never lost: it stays in the session, and both
 * `blockWhileSupporting()` and `recordAudit()` read it directly from `auth()`.
 * So the operator sees the member's CRM while the audit log still says the
 * operator was here.
 *
 * TWO THINGS THAT MUST STAY TRUE, or a Super Admin can strand themselves:
 *
 *   1. Leaving support mode must not require any role. The endpoint that ends a
 *      session uses `requireUser`, which passes for whoever is signed in, and it
 *      clears the cookie before checking anything.
 *   2. Starting a session requires Super Admin, which correctly fails while
 *      already supporting — you cannot hop from one member to another without
 *      returning to yourself first.
 */
export type EffectiveUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
};

export async function effectiveSession(): Promise<{ user: EffectiveUser } | null> {
  const session = await auth();
  const real = session?.user;
  if (!real) return null;

  const support = await readSupportSession(real.id).catch(() => null);
  if (!support) return { user: real as EffectiveUser };

  // Load the member being helped and answer as them.
  const { prisma } = await import("@/lib/prisma");
  const target = await prisma.user.findUnique({
    where: { id: support.targetUserId },
    select: { id: true, name: true, email: true, role: true, organizationId: true },
  });

  // If the member has gone since the session started, fall back to the real
  // user rather than failing the request — the banner will disappear on the
  // next read because readSupportSession also stops returning them.
  if (!target) return { user: real as EffectiveUser };

  return { user: target as EffectiveUser };
}
