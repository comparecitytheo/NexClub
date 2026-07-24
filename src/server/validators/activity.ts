import { z } from "zod";
import { ActivityType, EntityType } from "@prisma/client";
import { optionalText, optionalDate } from "./shared";

export const createActivitySchema = z.object({
  type: z.nativeEnum(ActivityType),
  subject: z.string().min(1, "Required").max(200),
  body: optionalText(4000),
  entityType: z.nativeEnum(EntityType),
  entityId: z.string().min(1),
  occurredAt: optionalDate(),
});

export const listActivitiesSchema = z.object({
  entityType: z.nativeEnum(EntityType).optional(),
  entityId: z.string().optional(),
  scope: z.enum(["mine", "all"]).default("mine"),
});
