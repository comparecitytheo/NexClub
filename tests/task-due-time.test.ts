import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { isTaskOverdue, formatDateTime } from "@/lib/format";

const FORM = readFileSync(join(process.cwd(), "src/components/tasks/task-form.tsx"), "utf8");
const LIST = readFileSync(join(process.cwd(), "src/components/tasks/task-list.tsx"), "utf8");
const SERVER = readFileSync(join(process.cwd(), "src/server/tasks/overdue-reminders.ts"), "utf8");

afterEach(() => vi.useRealTimers());

/**
 * A task's due TIME has to survive the round trip and be respected everywhere.
 *
 * The column was always a full timestamp, but the form used a date-only input,
 * so every task landed at midnight. Three of four screens then compared whole
 * days while a fourth compared exact times — so a task due at 9am read as
 * overdue in one place, on-time in another, and the reminder email disagreed
 * with both.
 */
describe("a due time survives the round trip", () => {
  it("the form captures a time, not just a date", () => {
    // Now the CRM-themed picker rather than a native input: the browser's own
    // calendar popup is chrome and cannot be styled, so it was replaced.
    expect(FORM).toMatch(/<DateTimeField[\s\S]{0,200}withTime/);
    expect(FORM).not.toMatch(/id="dueDate" type="date"/);
    expect(FORM).not.toMatch(/type="datetime-local"/);
  });

  it("a datetime-local value keeps its time through Date and back out", () => {
    // What the input yields -> what the API stores -> what the UI renders.
    const fromInput = "2026-06-02T14:30";
    const stored = new Date(fromInput);
    expect(stored.getHours()).toBe(14);
    expect(stored.getMinutes()).toBe(30);
    expect(formatDateTime(stored.toISOString())).toMatch(/2:30/);
  });

  it("renders midnight as a real time rather than dropping it", () => {
    const out = formatDateTime(new Date("2026-06-02T00:00").toISOString());
    expect(out).toMatch(/12:00/);
  });
});

describe("overdue respects the time of day", () => {
  it("a task due earlier today IS overdue", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-06-02T17:00"));
    // The bug: whole-day comparison left this sitting under "Today".
    expect(isTaskOverdue(new Date("2026-06-02T09:00"))).toBe(true);
  });

  it("a task due later today is NOT overdue", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-06-02T09:00"));
    expect(isTaskOverdue(new Date("2026-06-02T17:00"))).toBe(false);
  });

  it("a completed task is never overdue", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-06-02T17:00"));
    expect(isTaskOverdue(new Date("2026-06-01T09:00"), true)).toBe(false);
  });

  it("a task with no due date is never overdue", () => {
    expect(isTaskOverdue(null)).toBe(false);
    expect(isTaskOverdue(undefined)).toBe(false);
  });

  it("an unparseable date is never overdue", () => {
    expect(isTaskOverdue("not-a-date")).toBe(false);
  });
});

describe("one definition of overdue, shared", () => {
  it("every screen uses the helper rather than its own comparison", () => {
    for (const f of [
      "src/components/tasks/task-list.tsx",
      "src/components/tasks/all-tasks-view.tsx",
      "src/components/tasks/entity-tasks-panel.tsx",
      "src/components/dashboard/dashboard-tasks-card.tsx",
    ]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src).toMatch(/isTaskOverdue\(/);
      // The old day-level comparisons must be gone.
      expect(src).not.toMatch(/startOfDay\(new Date\(t?a?s?k?\.?dueDate\)\) < today/);
    }
  });

  it("the Overdue group matches the row styling", () => {
    expect(LIST).toMatch(/if \(isTaskOverdue\(due\)\) g\.overdue\.push\(t\)/);
  });

  it("and matches the server job that sends the reminders", () => {
    // Server: dueDate < now. The helper must agree, or the email contradicts
    // what the screen shows.
    expect(SERVER).toMatch(/dueDate: \{ not: null, lt: now \}/);
  });
});
