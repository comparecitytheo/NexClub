import { z } from "zod";
import { UserRole } from "@prisma/client";

export const updateUserSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  businessName: z.string().max(120).nullable().optional(),
  industry: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
});

// Super Admin renaming a member (typo at signup, legal name change, account set
// up on someone's behalf). PATCH /api/admin/users/[id] referenced this schema but
// it was never defined — added here rather than inline so it sits with its peers.
export const renameUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
