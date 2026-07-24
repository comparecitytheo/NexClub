import { z } from "zod";
import { optionalText, optionalEmail } from "./shared";

export const businessContactSchema = z.object({
  name: z.string().min(1, "Contact name is required").max(120),
  role: optionalText(120),
  phone: optionalText(40),
  email: optionalEmail(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, "Your name is required").max(160).optional(),
  businessName: optionalText(160),
  industry: optionalText(120),
  services: optionalText(2000),
  phone: optionalText(40),
  bio: optionalText(2000),
  emailNotificationsEnabled: z.boolean().optional(),
  businessContacts: z.array(businessContactSchema).max(10).optional(),
});
