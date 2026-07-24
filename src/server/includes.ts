import type { Prisma } from "@prisma/client";

// Shared relation selection for task list/detail responses.
export const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
  lead: { select: { id: true, contactName: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  deal: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;
