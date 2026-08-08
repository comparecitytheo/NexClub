import { prisma } from "@/lib/prisma";
import { readSupportSession } from "@/server/support-session";
import { auth } from "@/lib/auth";
import type { AuditAction, Prisma } from "@prisma/client";

type AuditInput = {
  organizationId: string;
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

// Never throws — a failed audit write must not break the request.
/**
 * Write an audit entry.
 *
 * If the actor is inside a support session, the entry records the SUPER ADMIN as
 * the actor and notes the member they were acting for. The alternative — logging
 * the member — would make the log claim someone did something they did not do.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    // Resolved lazily and failure-tolerant: auditing must never be the reason a
    // request fails, which is why the whole function is already wrapped.
    let actorId = input.actorId ?? null;
    let after = input.after;

    // Read the session from the REAL signed-in identity, not from whatever actor
    // the caller passed — that is the whole point. If a Super Admin is in support
    // mode, they are the actor, and the member they were helping is noted.
    const session = await auth().catch(() => null);
    const realId = session?.user?.id ?? null;
    if (realId) {
      const support = await readSupportSession(realId).catch(() => null);
      if (support) {
        actorId = support.superAdminId;
        after = {
          ...(typeof after === "object" && after !== null ? after : {}),
          supportModeActingFor: support.targetName,
          supportModeTargetUserId: support.targetUserId,
        } as typeof after;
      }
    }
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: input.before,
        after,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

export type TeamActivityItem = {
  id: string;
  createdAt: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
};

// CRM work entities that are safe to surface to every member. The audit log
// also covers User/Organization changes and login/logout, which are NOT in
// this list and so never reach the member feed.
const ACTIVITY_ENTITY_TYPES = ["Lead", "Deal", "Company", "Contact", "Task"];

// Member-safe "who did what" feed for the dashboard. Deliberately narrow: it
// selects ONLY non-sensitive columns (no ipAddress, userAgent, before or after)
// and limits to the CRM entities above, so it can be shown to all members. The
// full forensic log — including IPs, logins and raw payloads — stays admin-only
// at /audit.
export async function getRecentTeamActivity(
  organizationId: string,
  take = 12
): Promise<TeamActivityItem[]> {
  const rows = await prisma.auditLog.findMany({
    where: { organizationId, entityType: { in: ACTIVITY_ENTITY_TYPES } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      createdAt: true,
      action: true,
      entityType: true,
      entityId: true,
      actor: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    actorName: r.actor?.name ?? null,
  }));
}
