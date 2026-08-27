import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyEvents: vi.fn(),
  findManyUsers: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findMany: mocks.findManyEvents },
    user: { findMany: mocks.findManyUsers },
  },
}));
vi.mock("@/server/notify", () => ({ notify: mocks.notify }));

import { sendRsvpReminders, isMonday, REMINDER_HORIZON_DAYS } from "@/server/events/rsvp-reminders";

const NOW = new Date("2026-08-10T08:00:00Z"); // a Monday
const day = 86_400_000;

beforeEach(() => {
  mocks.findManyEvents.mockReset().mockResolvedValue([]);
  mocks.findManyUsers.mockReset().mockResolvedValue([]);
  mocks.notify.mockReset().mockResolvedValue([]);
});

function event(rsvpUserIds: string[] = []) {
  return {
    id: "e1",
    title: "Networking breakfast",
    startsAt: new Date(NOW.getTime() + 7 * day),
    location: "Sydney CBD",
    organizationId: "org1",
    createdById: "admin",
    rsvps: rsvpUserIds.map((userId) => ({ userId })),
  };
}

describe("who gets chased", () => {
  it("only reminds members who have not responded", async () => {
    mocks.findManyEvents.mockResolvedValue([event(["u1"])]);
    mocks.findManyUsers.mockResolvedValue([{ id: "u1" }, { id: "u2" }, { id: "u3" }]);

    const r = await sendRsvpReminders({ now: NOW });

    expect(r.reminded).toBe(2);
    expect(r.alreadyResponded).toBe(1);
    expect(mocks.notify.mock.calls[0][0].recipientIds).toEqual(["u2", "u3"]);
  });

  it("stops chasing once someone answers either way", async () => {
    // A "not going" answer counts as responded — the point is to stop asking.
    mocks.findManyEvents.mockResolvedValue([event(["u1", "u2"])]);
    mocks.findManyUsers.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);

    const r = await sendRsvpReminders({ now: NOW });

    expect(r.reminded).toBe(0);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("sends nothing when everyone has answered", async () => {
    mocks.findManyEvents.mockResolvedValue([event(["u1"])]);
    mocks.findManyUsers.mockResolvedValue([{ id: "u1" }]);
    await sendRsvpReminders({ now: NOW });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});

describe("which events are chased", () => {
  it("looks only at events still to come, within the horizon", async () => {
    await sendRsvpReminders({ now: NOW });
    const where = mocks.findManyEvents.mock.calls[0][0].where;
    expect(where.startsAt.gt).toEqual(NOW);
    expect(where.startsAt.lte.getTime()).toBe(NOW.getTime() + REMINDER_HORIZON_DAYS * day);
  });

  it("never chases about an event that has already happened", async () => {
    const where = (await sendRsvpReminders({ now: NOW }), mocks.findManyEvents.mock.calls[0][0].where);
    expect(where.startsAt.gt).toEqual(NOW);
  });
});

describe("the reminder itself", () => {
  it("has no actor, so nobody is filtered out of their own reminder", async () => {
    mocks.findManyEvents.mockResolvedValue([event()]);
    mocks.findManyUsers.mockResolvedValue([{ id: "u1" }]);

    await sendRsvpReminders({ now: NOW });

    expect(mocks.notify.mock.calls[0][0].actorId).toBeUndefined();
    expect(mocks.notify.mock.calls[0][0].type).toBe("EVENT_RSVP_REMINDER");
  });

  it("reports without sending on a dry run", async () => {
    mocks.findManyEvents.mockResolvedValue([event()]);
    mocks.findManyUsers.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);

    const r = await sendRsvpReminders({ now: NOW, dryRun: true });

    expect(r).toMatchObject({ reminded: 2, dryRun: true });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});

describe("weekly schedule guard", () => {
  it("runs on Monday and not on other days", () => {
    expect(isMonday(new Date("2026-08-10T08:00:00Z"))).toBe(true);  // Monday
    expect(isMonday(new Date("2026-08-11T08:00:00Z"))).toBe(false); // Tuesday
    expect(isMonday(new Date("2026-08-09T08:00:00Z"))).toBe(false); // Sunday
  });
});
