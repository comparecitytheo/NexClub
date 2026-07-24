import { z } from "zod";
import { TaskPriority, TaskStatus, EntityType } from "@prisma/client";
import { optionalText, optionalDate } from "./shared";

const recurrence = z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]);

export const createTaskSchema = z.object({
  title: z.string().min(1, "Required").max(200),
  description: optionalText(2000),
  assigneeId: z.string().min(1, "Choose an assignee"),
  dueDate: optionalDate(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  recurrence: recurrence.default("NONE"),
  entityType: z.nativeEnum(EntityType).optional(),
  entityId: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: optionalText(2000),
  assigneeId: z.string().optional(),
  dueDate: optionalDate(),
  priority: z.nativeEnum(TaskPriority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  recurrence: recurrence.optional(),
});

export const listTasksSchema = z.object({
  scope: z.enum(["mine", "assigned", "created", "all"]).default("mine"),
  status: z.enum(["open", "completed", "all"]).default("open"),
  q: z.string().optional(),
  // When both are present, list tasks linked to this specific CRM entity
  // (used by the inline tasks panel on entity overview pages).
  entityType: z.nativeEnum(EntityType).optional(),
  entityId: z.string().optional(),
});
