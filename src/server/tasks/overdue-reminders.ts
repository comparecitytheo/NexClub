import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notify";

/**
 * OVERDUE TASK REMINDERS
 *
 * Assignment emails already go out the moment a task is created or reassigned
 * (see the tasks routes). This is the follow-up: while a task stays overdue, its
 * assignee gets a nudge every 2nd day until they complete it or cancel it.
 *
 * The cadence is per task, not per run. `lastOverdueReminderAt` records when a
 * task was last chased, and a task is only picked up again once that stamp is at
 * least 2 days old. That means:
 *   - the job can safely run daily (or be retried) without spamming anyone,
 *   - two tasks overdue on different days are each chased on their own schedule,
 *   - a task overdue for a month gets ~15 reminders, not 30.
 *
 * Only OPEN and IN_PROGRESS tasks are chased. Completed and cancelled tasks are
 * left alone no matter how far past their due date they sit.
 */
export const REMINDER_INTERVAL_DAYS = 2;

/** Statuses still considered outstanding. COMPLETED/CANCELLED are never chased. */
export const OPEN_TASK_STATUSES = ["OPEN", "IN_PROGRESS"] as const;

export type ReminderResult = {
  /** Tasks a reminder was sent for (or, on a dry run, would be sent for). */
  reminded: number;
  /** Overdue tasks skipped because they were chased within the interval. */
  skippedRecentlyReminded: number;
  dryRun: boolean;
};

export async function sendOverdueTaskReminders(
  options: { dryRun?: boolean; now?: Date } = {}
): Promise<ReminderResult> {
  const dryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - REMINDER_INTERVAL_DAYS * 86_400_000);

  const overdue = {
    status: { in: [...OPEN_TASK_STATUSES] },
    dueDate: { not: null, lt: now },
  };

  // Due, still open, and either never reminded or last reminded > 2 days ago.
  const due = await prisma.task.findMany({
    where: {
      ...overdue,
      OR: [{ lastOverdueReminderAt: null }, { lastOverdueReminderAt: { lt: cutoff } }],
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      organizationId: true,
      assigneeId: true,
      entityType: true,
      leadId: true,
      contactId: true,
      companyId: true,
      dealId: true,
    },
  });

  const totalOverdue = await prisma.task.count({ where: overdue });

  if (dryRun) {
    return {
      reminded: due.length,
      skippedRecentlyReminded: totalOverdue - due.length,
      dryRun: true,
    };
  }

  let reminded = 0;
  for (const task of due) {
    const daysOverdue = task.dueDate
      ? Math.max(1, Math.floor((now.getTime() - task.dueDate.getTime()) / 86_400_000))
      : 1;

    // No actorId: this is the system chasing, not a member, so the assignee is
    // never filtered out as "the person who caused it".
    await notify({
      organizationId: task.organizationId,
      recipientIds: [task.assigneeId],
      type: "TASK_OVERDUE",
      title: "Task overdue",
      body: `${task.title} was due ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} ago.`,
      entityType: task.entityType,
      entityId: task.entityType
        ? (task.leadId ?? task.contactId ?? task.companyId ?? task.dealId)
        : null,
      email: { taskTitle: task.title },
    });

    // Stamped after the send so a crash mid-run leaves the task eligible next
    // time rather than silently skipping it for two days.
    await prisma.task.update({
      where: { id: task.id },
      data: { lastOverdueReminderAt: now },
    });
    reminded += 1;
  }

  return {
    reminded,
    skippedRecentlyReminded: totalOverdue - due.length,
    dryRun: false,
  };
}
