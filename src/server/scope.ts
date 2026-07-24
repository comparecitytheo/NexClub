import type { Prisma, UserRole } from "@prisma/client";
import { isAdmin } from "@/lib/rbac";

type SessionUser = { id: string; organizationId: string; role: UserRole };

// Contacts / Companies / Deals: admins see the whole org, members see only what they own.
export function ownerScope(user: SessionUser) {
  return isAdmin(user.role)
    ? { organizationId: user.organizationId }
    : { organizationId: user.organizationId, ownerId: user.id };
}

// Tasks: admins see the org; members see tasks they're assigned or created.
export function taskScope(user: SessionUser): Prisma.TaskWhereInput {
  return isAdmin(user.role)
    ? { organizationId: user.organizationId }
    : { organizationId: user.organizationId, OR: [{ assigneeId: user.id }, { creatorId: user.id }] };
}

// Activities: admins see the org; members see activity they logged.
export function activityScope(user: SessionUser): Prisma.ActivityWhereInput {
  return isAdmin(user.role)
    ? { organizationId: user.organizationId }
    : { organizationId: user.organizationId, userId: user.id };
}
