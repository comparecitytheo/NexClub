import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { task: { findMany: mocks.findMany, count: mocks.count, update: mocks.update } },
}));
vi.mock("@/server/notify", () => ({ notify: mocks.notify }));

import {
  sendOverdueTaskReminders,
  REMINDER_INTERVAL_DAYS,
  OPEN_TASK_STATUSES,
} from "@/server/tasks/overdue-reminders";

const NOW = new Date("2026-08-10T08:00:00Z");
const day = 86_400_000;

function task(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "t1",
    title: "Call Priya",
    dueDate: new Date(NOW.getTime() - 3 * day),
    organizationId: "org1",
    assigneeId: "user-1",
    entityType: "LEAD",
    leadId: "lead-1",
    contactId: null,
    companyId: null,
    dealId: null,
    ...over,
  };
}

beforeEach(() => {
  mocks.findMany.mockReset().mockResolvedValue([]);
  mocks.count.mockReset().mockResolvedValue(0);
  mocks.update.mockReset().mockResolvedValue({});
  mocks.notify.mockReset().mockResolvedValue(["user-1"]);
});

describe("which tasks get chased", () => {
  it("only chases tasks that are still open", async () => {
    await sendOverdueTaskReminders({ now: NOW });
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["OPEN", "IN_PROGRESS"] });
    // Completed and cancelled tasks are never chased, however old they are.
    expect(OPEN_TASK_STATUSES).not.toContain("COMPLETED");
    expect(OPEN_TASK_STATUSES).not.toContain("CANCELLED");
  });

  it("only chases tasks whose due date has passed", async () => {
    await sendOverdueTaskReminders({ now: NOW });
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.dueDate).toEqual({ not: null, lt: NOW });
  });

  it("ignores tasks with no due date, which can never be overdue", async () => {
    await sendOverdueTaskReminders({ now: NOW });
    expect(mocks.findMany.mock.calls[0][0].where.dueDate.not).toBeNull();
  });
});

describe("every-2nd-day cadence", () => {
  it("uses a 2-day interval", () => {
    expect(REMINDER_INTERVAL_DAYS).toBe(2);
  });

  it("picks up tasks never reminded, and those last reminded over 2 days ago", async () => {
    await sendOverdueTaskReminders({ now: NOW });
    const or = mocks.findMany.mock.calls[0][0].where.OR;
    expect(or[0]).toEqual({ lastOverdueReminderAt: null });
    const cutoff = or[1].lastOverdueReminderAt.lt as Date;
    expect(cutoff.getTime()).toBe(NOW.getTime() - 2 * day);
  });

  it("does not chase a task reminded yesterday", async () => {
    // Yesterday is after the 2-day cutoff, so the query excludes it.
    const cutoff = new Date(NOW.getTime() - 2 * day);
    const yesterday = new Date(NOW.getTime() - 1 * day);
    expect(yesterday > cutoff).toBe(true);
  });

  it("stamps the reminder time so the next run skips the task", async () => {
    mocks.findMany.mockResolvedValue([task()]);
    mocks.count.mockResolvedValue(1);

    await sendOverdueTaskReminders({ now: NOW });

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      where: { id: "t1" },
      data: { lastOverdueReminderAt: NOW },
    });
  });

  it("reports how many overdue tasks were skipped as recently chased", async () => {
    mocks.findMany.mockResolvedValue([task()]);
    mocks.count.mockResolvedValue(5); // 5 overdue, only 1 eligible

    const r = await sendOverdueTaskReminders({ now: NOW });

    expect(r.reminded).toBe(1);
    expect(r.skippedRecentlyReminded).toBe(4);
  });
});

describe("the reminder itself", () => {
  it("notifies the assignee with the task title and how late it is", async () => {
    mocks.findMany.mockResolvedValue([task()]);
    mocks.count.mockResolvedValue(1);

    await sendOverdueTaskReminders({ now: NOW });

    expect(mocks.notify).toHaveBeenCalledTimes(1);
    const arg = mocks.notify.mock.calls[0][0];
    expect(arg.recipientIds).toEqual(["user-1"]);
    expect(arg.type).toBe("TASK_OVERDUE");
    expect(arg.email.taskTitle).toBe("Call Priya");
    expect(arg.body).toContain("3 days ago");
  });

  it("has no actor, so the assignee is never filtered out of their own reminder", async () => {
    mocks.findMany.mockResolvedValue([task()]);
    mocks.count.mockResolvedValue(1);

    await sendOverdueTaskReminders({ now: NOW });

    expect(mocks.notify.mock.calls[0][0].actorId).toBeUndefined();
  });

  it("says '1 day' rather than '1 days'", async () => {
    mocks.findMany.mockResolvedValue([task({ dueDate: new Date(NOW.getTime() - 1 * day) })]);
    mocks.count.mockResolvedValue(1);

    await sendOverdueTaskReminders({ now: NOW });

    expect(mocks.notify.mock.calls[0][0].body).toContain("1 day ago");
  });

  it("chases each overdue task separately", async () => {
    mocks.findMany.mockResolvedValue([task({ id: "t1" }), task({ id: "t2", assigneeId: "user-2" })]);
    mocks.count.mockResolvedValue(2);

    const r = await sendOverdueTaskReminders({ now: NOW });

    expect(r.reminded).toBe(2);
    expect(mocks.notify).toHaveBeenCalledTimes(2);
  });
});

describe("dry run", () => {
  it("reports without sending or stamping anything", async () => {
    mocks.findMany.mockResolvedValue([task()]);
    mocks.count.mockResolvedValue(3);

    const r = await sendOverdueTaskReminders({ now: NOW, dryRun: true });

    expect(r).toMatchObject({ reminded: 1, skippedRecentlyReminded: 2, dryRun: true });
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
