import type { UserRole } from "@prisma/client";

// Higher number = more authority. Keyed by string literals so this module pulls
// in NO @prisma/client runtime (the import above is type-only) and stays a pure,
// unit-testable function library.
const RANK: Record<UserRole, number> = {
  SUPPORT_AGENT: 1,
  SALES_REP: 2,
  MANAGER: 3,
  ADMIN: 4,
  SUPER_ADMIN: 5,
};

export function atLeast(role: UserRole, minimum: UserRole): boolean {
  return RANK[role] >= RANK[minimum];
}

export function isAdmin(role: UserRole): boolean {
  return atLeast(role, "ADMIN");
}

// Super admin is the top of the hierarchy (controls the whole CRM, every
// business). Gates super-admin-only actions such as editing the announcement
// banner and granting the Admin tier.
export function isSuperAdmin(role: UserRole): boolean {
  return atLeast(role, "SUPER_ADMIN");
}

export function isManager(role: UserRole): boolean {
  return atLeast(role, "MANAGER");
}

// ---------------------------------------------------------------------------
// Three-tier model: Super Admin / Admin / Employee.
// The UserRole enum keeps its five values for backwards compatibility with
// existing accounts; they collapse onto three tiers — MANAGER / SALES_REP /
// SUPPORT_AGENT are all "Employee". New tier assignments write one canonical
// role per tier (TIER_ROLE), so the management UI only ever offers three
// choices while legacy roles keep working.
// ---------------------------------------------------------------------------
export type Tier = "SUPER_ADMIN" | "ADMIN" | "EMPLOYEE";

export function tierOf(role: UserRole): Tier {
  if (role === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (role === "ADMIN") return "ADMIN";
  return "EMPLOYEE";
}

export const TIER_LABELS: Record<Tier, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  EMPLOYEE: "Employee",
};

// Canonical enum role written when a tier is assigned from the 3-tier UI.
export const TIER_ROLE: Record<Tier, UserRole> = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  EMPLOYEE: "SALES_REP",
};

// Which tiers an actor may create/assign/manage — also the order shown in the UI.
//   Super Admin: every tier, including granting Admin (and other Super Admins).
//   Admin:       Admin + Employee, within their own business only (the caller
//                must still enforce the same-org/business scope). Never Super Admin.
//   Employee:    none.
export function assignableTiers(actor: UserRole): Tier[] {
  const t = tierOf(actor);
  if (t === "SUPER_ADMIN") return ["SUPER_ADMIN", "ADMIN", "EMPLOYEE"];
  if (t === "ADMIN") return ["ADMIN", "EMPLOYEE"];
  return [];
}

// Can `actor` create/assign a role of `targetRole`, or edit/deactivate/remove a
// user who currently holds it? An Admin therefore cannot touch a Super Admin and
// can never escalate anyone (themselves included) to Super Admin; an Employee
// can manage no one.
export function canManageRole(actor: UserRole, targetRole: UserRole): boolean {
  return assignableTiers(actor).includes(tierOf(targetRole));
}

// Role-management surfaces (the Members page + /api/users) require Admin or
// above. Everyday member actions — create leads, create tasks, move leads
// between stages, message other businesses through a lead — are open to every
// signed-in user and are deliberately NOT gated here.
export function canManageMembers(role: UserRole): boolean {
  return isAdmin(role);
}

// ---------------------------------------------------------------------------
// Invite role + scope. Enforced at the API for every invite path.
//
// The Super Admin role is NEVER assignable through an invite: a Super Admin who
// invites is setting up a business *Admin*; a business Admin who invites is
// adding a standard *member* (Employee) to their own business. Anyone below
// Admin cannot invite at all.
export function invitedRoleFor(callerRole: UserRole): UserRole {
  if (isSuperAdmin(callerRole)) return TIER_ROLE.ADMIN; // -> "ADMIN" (business admin)
  if (isAdmin(callerRole)) return TIER_ROLE.EMPLOYEE; // -> "SALES_REP" (member)
  return TIER_ROLE.EMPLOYEE;
}

// Resolve the role + business an invite should carry, given who is sending it.
// - Super Admin: sets up a business Admin for a (possibly new) business they name.
// - business Admin: adds a member to THEIR OWN business only; the submitted
//   business name is ignored in favour of the admin's own.
// The returned role is never SUPER_ADMIN.
export function resolveInviteScope(input: {
  callerRole: UserRole;
  callerBusinessName: string | null;
  submittedBusinessName: string;
}): { role: UserRole; businessName: string } {
  const role = invitedRoleFor(input.callerRole);
  const businessName = isSuperAdmin(input.callerRole)
    ? input.submittedBusinessName.trim()
    : (input.callerBusinessName ?? "").trim();
  return { role: role === "SUPER_ADMIN" ? TIER_ROLE.ADMIN : role, businessName };
}
