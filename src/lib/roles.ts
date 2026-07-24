import { UserRole } from "@prisma/client";

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SALES_REP: "Sales Rep",
  SUPPORT_AGENT: "Support Agent",
};

export const ROLE_OPTIONS = Object.values(UserRole);
