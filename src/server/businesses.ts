import { prisma } from "@/lib/prisma";

/**
 * BUSINESS MEMBERSHIP
 *
 * `User.businessId` is the authority on which business someone belongs to.
 * `User.businessName` is a display mirror so the many screens that show a
 * business name keep working; it is written only here, alongside the id, so the
 * two cannot drift.
 *
 * Membership is deliberately NOT settable by the member. It used to be a plain
 * text field on the profile form, which meant anyone could type another
 * business's name and be treated as part of it — and a business admin could then
 * invite staff into a business they had no claim to. Membership now changes only
 * through an invitation or a Super Admin.
 */

/** Find a business by name, case-insensitively, or create it. */
export async function resolveBusiness(
  organizationId: string,
  rawName: string
): Promise<{ id: string; name: string } | null> {
  const name = rawName.trim();
  if (!name) return null;

  const existing = await prisma.business.findFirst({
    where: { organizationId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  return prisma.business.create({
    data: { organizationId, name },
    select: { id: true, name: true },
  });
}

/**
 * Move a user into a business, writing the id and the display mirror together.
 * Every path that changes membership must go through here.
 */
export async function setUserBusiness(
  userId: string,
  business: { id: string; name: string } | null
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      businessId: business?.id ?? null,
      businessName: business?.name ?? null,
    },
  });
}

/**
 * The business a user actually belongs to, read from the relation rather than
 * the mirror. Use this for any scoping or permission decision.
 */
export async function businessOf(
  userId: string
): Promise<{ id: string; name: string } | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { business: { select: { id: true, name: true } } },
  });
  return u?.business ?? null;
}


/**
 * The business a user acts within, as a list.
 *
 * Returns at most one id — a person belongs to exactly one business. It stays a
 * list so callers filter with `in`, which means widening this later would not
 * touch every call site.
 */
export async function businessIdsFor(userId: string): Promise<string[]> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessId: true },
  });
  return u?.businessId ? [u.businessId] : [];
}

/**
 * Every user who shares a business with this one — the people whose leads they
 * may see. Always includes the user themselves, so somebody with no business
 * still sees their own leads rather than nothing.
 */
export async function colleagueIdsFor(userId: string): Promise<string[]> {
  const businessIds = await businessIdsFor(userId);
  if (businessIds.length === 0) return [userId];

  const colleagues = await prisma.user.findMany({
    // Deactivated members stay INCLUDED on purpose: their leads belong to the
    // business, and dropping them would hide a departed colleague's history from
    // the people who now have to service it — the exact continuity problem
    // business-wide visibility exists to solve. Deactivated accounts cannot sign
    // in, so this widens what the business sees, never who can see it.
    where: { businessId: { in: businessIds } },
    select: { id: true },
  });

  const ids = new Set<string>(colleagues.map((c) => c.id));
  ids.add(userId);
  return [...ids];
}


/**
 * Would removing this person's admin rights leave their business with nobody who
 * can manage it?
 *
 * ONE check, called by every route that can cause it: delete, deactivate, and
 * demote. Putting this logic in a single route handler is how the first version
 * shipped with two open doors to the same lockout.
 *
 * Returns the blocking reason, or null when the action is safe.
 */
export async function lastAdminBlocker(targetUserId: string): Promise<string | null> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      name: true,
      role: true,
      isActive: true,
      businessId: true,
      business: { select: { name: true } },
    },
  });

  // Only an ACTIVE admin attached to a business can be the last one.
  if (!target || target.role !== "ADMIN" || !target.businessId || !target.isActive) return null;

  const otherAdmins = await prisma.user.count({
    where: {
      businessId: target.businessId,
      role: "ADMIN",
      isActive: true,
      id: { not: targetUserId },
    },
  });
  if (otherAdmins > 0) return null;

  return `${target.name} is the only admin at ${target.business?.name ?? "their business"}. Promote another member there first, or that business will have nobody who can manage it.`;
}


/**
 * The `where` fragment restricting a single lead to what this user may open.
 *
 * Must agree with the LIST scoping, or a member sees a colleague's lead on the
 * board and gets "not found" when they click it. Shared by every route that
 * opens one lead, so the two cannot drift apart again.
 *
 * Super Admins pass `isSuperAdmin: true` and get the club.
 */
export async function leadAccessWhere(
  userId: string,
  /**
   * Whether CLUB-WIDE scope has been granted for this request. The caller must
   * have already checked that the user is a Super Admin AND asked for it —
   * passing a role alone is what previously made the club-wide path automatic.
   */
  clubWide: boolean,
  /**
   * Which side of the referral must be your business.
   *
   * "either" is right for READING — everyone at a business sees its leads in
   * both directions. Writes are usually DIRECTIONAL: the receiving business owns
   * the pipeline stage, the sending business owns the sent status. Widening
   * those to "either" would let the sender move the receiver's lead through
   * their own pipeline.
   */
  side: "either" | "owner" | "referrer" = "either"
): Promise<Record<string, unknown>> {
  // Club-wide access is OPT-IN and Super Admin only. It used to be granted
  // automatically to anyone passing isSuperAdmin, which meant a Super Admin was
  // never scoped to their own business even with the club-wide view off.
  //
  // `{}` here is an EMPTY where fragment — no restriction at all — so this
  // branch must only ever be reached for a caller that has both the role and
  // the explicit request.
  if (clubWide) return {};

  const team = await colleagueIdsFor(userId);
  if (side === "owner") return { ownerId: { in: team } };
  if (side === "referrer") return { referrerId: { in: team } };
  return { OR: [{ referrerId: { in: team } }, { ownerId: { in: team } }] };
}

/**
 * The business someone has just left, if nobody is left in it.
 *
 * Call AFTER the member has been removed. Returns null when the business still
 * has members, when they belonged to no business, or when the business has
 * already gone.
 *
 * The count runs through the soft-delete filter, so members removed earlier do
 * not keep a business looking occupied. Deactivated members DO still count:
 * they are members, just not currently active, and deleting the business out
 * from under them would clear their business on the way back.
 */
export async function businessIfNowEmpty(
  businessId: string | null | undefined
): Promise<{ id: string; name: string } | null> {
  if (!businessId) return null;
  const remaining = await prisma.user.count({ where: { businessId } });
  if (remaining > 0) return null;
  return prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });
}
