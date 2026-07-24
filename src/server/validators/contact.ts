import { z } from "zod";
import { ContactStatus } from "@prisma/client";
import { optionalText, optionalEmail, optionalId, optionalTags } from "./shared";

export const createContactSchema = z.object({
  firstName: z.string().min(1, "Required").max(80),
  lastName: z.string().min(1, "Required").max(80),
  email: optionalEmail(),
  phone: optionalText(40),
  jobTitle: optionalText(120),
  companyId: optionalId(),
  address: optionalText(240),
  website: optionalText(200),
  tags: optionalTags(),
  status: z.nativeEnum(ContactStatus).default(ContactStatus.ACTIVE),
  notes: optionalText(5000),
});

export const updateContactSchema = createContactSchema.partial();

export const listContactsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  status: z.nativeEnum(ContactStatus).optional(),
  companyId: z.string().optional(),
});
