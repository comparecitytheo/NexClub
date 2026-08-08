import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readSupportSession } from "@/server/support-session";
import { effectiveSession } from "@/server/session";
import { isAdmin, isSuperAdmin } from "@/lib/rbac";

// Each guard returns either { user } or { error: NextResponse }. Routes do:
//   const a = await requireAdmin();
//   if ("error" in a) return a.error;
//   const { user } = a;
export async function requireUser() {
  // Effective identity: the member being helped when a Super Admin is in support
  // mode, otherwise the signed-in user. READS only — mutating routes must use
  // requireUserForWrite(), which adds the support-mode write block.
  const session = await effectiveSession();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  return { user: session.user } as const;
}

export async function requireAdmin() {
  const result = await requireUser();
  if ("error" in result) return result;
  if (!isAdmin(result.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return result;
}

// Only SUPER_ADMIN passes. Used to protect announcement editing server-side.
export async function requireSuperAdmin() {
  const result = await requireUser();
  if ("error" in result) return result;
  if (!isSuperAdmin(result.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return result;
}


/**
 * Guard for routes that CHANGE something, when a Super Admin may be in support
 * mode.
 *
 * Support mode is deliberately read-only. A Super Admin already has full
 * club-wide powers as themselves, so they never need to act AS a member to fix
 * something — they only need to SEE what the member sees. Allowing writes would
 * buy nothing and cost the one thing the audit log must be able to answer: did
 * the member do this, or did the operator?
 *
 * Routes that mutate call this after their normal guard:
 *
 *   const s = await blockWhileSupporting();
 *   if (s) return s;
 */
export async function blockWhileSupporting(): Promise<NextResponse | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const support = await readSupportSession(id);
  if (!support) return null;

  return NextResponse.json(
    {
      error: `You are viewing the CRM as ${support.targetName}. Support mode is read-only — leave it to make changes as yourself.`,
    },
    { status: 403 }
  );
}

/**
 * Who the current request should be rendered FOR: normally the signed-in user,
 * or the member a Super Admin is currently viewing as.
 */
export async function viewingContext(): Promise<{
  realUserId: string | null;
  viewAsUserId: string | null;
  viewAsName: string | null;
}> {
  const session = await auth();
  const realUserId = session?.user?.id ?? null;
  if (!realUserId) return { realUserId: null, viewAsUserId: null, viewAsName: null };

  const support = await readSupportSession(realUserId);
  return {
    realUserId,
    viewAsUserId: support?.targetUserId ?? null,
    viewAsName: support?.targetName ?? null,
  };
}


/**
 * Identity guard for routes that CHANGE something.
 *
 * SUPPORT MODE IS READ-ONLY. An earlier version defined blockWhileSupporting()
 * and relied on each mutating route calling it — none did, so a Super Admin
 * viewing as a member could write rows AUTHORED BY THAT MEMBER while the banner
 * claimed changes were recorded against the operator. Pairing the identity check
 * and the write block in one call means a route cannot get only half of it.
 *
 *   const a = await requireUserForWrite();
 *   if ("error" in a) return a.error;
 */
export async function requireUserForWrite() {
  const result = await requireUser();
  if ("error" in result) return result;
  const blocked = await blockWhileSupporting();
  if (blocked) return { error: blocked } as const;
  return result;
}

/** requireAdmin + the support-mode write block. */
export async function requireAdminForWrite() {
  const result = await requireAdmin();
  if ("error" in result) return result;
  const blocked = await blockWhileSupporting();
  if (blocked) return { error: blocked } as const;
  return result;
}

/** requireSuperAdmin + the support-mode write block. */
export async function requireSuperAdminForWrite() {
  const result = await requireSuperAdmin();
  if ("error" in result) return result;
  const blocked = await blockWhileSupporting();
  if (blocked) return { error: blocked } as const;
  return result;
}
