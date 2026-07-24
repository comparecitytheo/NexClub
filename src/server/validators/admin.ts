import { z } from "zod";
import { UserRole } from "@prisma/client";

// Create a member from the panel. A Super Admin may assign any role; the route
// still runs canManageRole for defence in depth.
export const createMemberSchema = z.object({
  name: z.string().min(2, "Name is too short").max(100),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  isActive: z.boolean().default(true),
  businessName: z.string().max(120).optional(),
});

// Role changes are destructive -> require explicit client re-confirmation.
export const changeRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
  confirm: z.literal(true),
});

export const changeStatusSchema = z.object({
  isActive: z.boolean(),
});

export const listMembersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  joinedFrom: z.coerce.date().optional(),
  joinedTo: z.coerce.date().optional(),
});

export const updateSettingsSchema = z.object({
  branding: z.object({
    companyName: z.string().max(120),
    supportEmail: z.string().email().or(z.literal("")),
  }),
  defaultSignupRole: z.enum(["MANAGER", "SALES_REP", "SUPPORT_AGENT"]),
  security: z.object({
    passwordMinLength: z.coerce.number().int().min(8).max(128),
    sessionTimeoutMinutes: z.coerce.number().int().min(5).max(60 * 24 * 90),
  }),
  email: z.object({
    from: z.string().max(200),
  }),
  features: z.object({
    leads: z.boolean(),
    deals: z.boolean(),
    contacts: z.boolean(),
    companies: z.boolean(),
    tasks: z.boolean(),
    events: z.boolean(),
  }),
});
