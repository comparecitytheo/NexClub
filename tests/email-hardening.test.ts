import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const EMAIL = readFileSync(join(process.cwd(), "src/lib/email.ts"), "utf8");
const NOTIFY = readFileSync(join(process.cwd(), "src/server/notify.ts"), "utf8");
const VERCEL = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
const REMINDERS = readFileSync(join(process.cwd(), "src/server/tasks/overdue-reminders.ts"), "utf8");
const SETTINGS = readFileSync(join(process.cwd(), "src/components/settings/profile-settings.tsx"), "utf8");
const PROFILE = readFileSync(join(process.cwd(), "src/server/validators/profile.ts"), "utf8");

describe("misconfigured SMTP fails loudly in production", () => {
  it("throws rather than pretending the mail was sent", () => {
    // The old behaviour logged and returned success, so every email silently
    // vanished while all callers reported OK.
    expect(EMAIL).toMatch(/if \(process\.env\.NODE_ENV === "production"\)/);
    expect(EMAIL).toMatch(/refusing to silently drop mail/);
  });

  it("still logs to console in development", () => {
    expect(EMAIL).toMatch(/\[email:dev\]/);
  });
});

describe("transient send failures are retried and surfaced", () => {
  it("retries once before giving up", () => {
    expect(EMAIL).toMatch(/await transport\.sendMail\(message\);[\s\S]*?catch \(first\)/);
    expect(EMAIL).toMatch(/setTimeout\(r, 1000\)/);
  });

  it("logs an error rather than swallowing the failure", () => {
    expect(EMAIL).toMatch(/console\.error\([\s\S]*?failed twice/);
    expect(EMAIL).toMatch(/throw second;/);
  });
});

describe("emails only reach proven addresses", () => {
  it("requires a set password, not the never-written emailVerified", () => {
    // emailVerified is null for every user in this codebase — gating on it
    // would have blocked every email. A set password proves the member opened
    // the tokenised invite sent to that address.
    expect(NOTIFY).toMatch(/user\.hashedPassword !== null/);
    expect(NOTIFY).not.toMatch(/user\.emailVerified/);
  });

  it("still checks active, not-deleted and the member's own preference", () => {
    expect(NOTIFY).toMatch(/user\.isActive/);
    expect(NOTIFY).toMatch(/user\.deletedAt === null/);
    expect(NOTIFY).toMatch(/user\.emailNotificationsEnabled/);
  });
});

describe("members can control notification emails", () => {
  it("the preference is accepted by the profile schema", () => {
    expect(PROFILE).toMatch(/emailNotificationsEnabled: z\.boolean\(\)\.optional\(\)/);
  });

  it("there is a toggle in settings, so it can be turned back ON", () => {
    // Previously it could only be switched off, from an email footer.
    expect(SETTINGS).toMatch(/id="emailNotifs"/);
    expect(SETTINGS).toMatch(/emailNotificationsEnabled: emailNotifs/);
  });
});

describe("TASK_DUE_TODAY is no longer dead", () => {
  it("fires from the daily reminder job", () => {
    expect(REMINDERS).toMatch(/type: "TASK_DUE_TODAY"/);
  });

  it("only chases a task once a day", () => {
    expect(REMINDERS).toMatch(/task\.lastOverdueReminderAt >= startOfToday/);
  });

  it("cannot overlap the overdue pass", () => {
    // dueDate < now vs dueDate >= now — mutually exclusive by construction.
    expect(REMINDERS).toMatch(/dueDate: \{ not: null, lt: now \}/);
    expect(REMINDERS).toMatch(/dueDate: \{ gte: now, lte: endOfToday \}/);
  });
});

describe("reminders run at 9am Sydney", () => {
  it("uses 23:00 UTC, which is 09:00 AEST and 10:00 AEDT", () => {
    // Vercel crons are UTC-only, so a Sydney time cannot be pinned across
    // daylight saving. 9am AEST was chosen because it drifts to 10am in summer
    // rather than 11am. (22:00 UTC, the original, was 08:00 AEST — never 10pm.)
    const crons = JSON.parse(VERCEL).crons as { path: string; schedule: string }[];
    expect(crons.find((c) => c.path.includes("task-reminders"))?.schedule).toBe("0 23 * * *");
  });

  it("keeps the weekly RSVP nudge on a Sydney Sunday", () => {
    // 23:00 UTC is the NEXT day in Sydney, so the job runs Saturday UTC to land
    // on Sunday locally. Leaving it on Sunday UTC would have moved it to Monday.
    const crons = JSON.parse(VERCEL).crons as { path: string; schedule: string }[];
    expect(crons.find((c) => c.path.includes("rsvp-reminders"))?.schedule).toBe("0 23 * * 6");
  });

  it("leaves the monthly archive on its own schedule", () => {
    const crons = JSON.parse(VERCEL).crons as { path: string; schedule: string }[];
    expect(crons.find((c) => c.path.includes("archive-leads"))?.schedule).toBe("0 3 1 * *");
  });
});
