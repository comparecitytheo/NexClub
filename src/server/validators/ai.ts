import { z } from "zod";
import { EntityType } from "@prisma/client";

export const aiEntitySchema = z.object({
  entityType: z.nativeEnum(EntityType),
  entityId: z.string().min(1),
});

export const aiEmailSchema = aiEntitySchema.extend({
  purpose: z.string().min(1, "Describe what the email is for").max(500),
  tone: z.enum(["professional", "friendly", "concise", "persuasive"]).default("professional"),
});

export const aiMeetingNotesSchema = aiEntitySchema.extend({
  notes: z.string().min(1, "Paste your notes").max(8000),
  createTasks: z.boolean().default(false),
});
