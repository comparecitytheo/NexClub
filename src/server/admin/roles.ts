import type { UserRole } from "@prisma/client";

// Pure guard (unit-tested): true when a role change would leave the org with
// zero Super Admins. This blocks demoting the LAST Super Admin — which includes
// a Super Admin demoting themselves when they are the only one, exactly the
// case the spec calls out. `superAdminCount` is the count of active, non-deleted
// SUPER_ADMINs in the org, including the target.
export function wouldRemoveLastSuperAdmin(input: {
  targetCurrentRole: UserRole;
  newRole: UserRole;
  superAdminCount: number;
}): boolean {
  const demotingASuperAdmin = input.targetCurrentRole === "SUPER_ADMIN" && input.newRole !== "SUPER_ADMIN";
  return demotingASuperAdmin && input.superAdminCount <= 1;
}
