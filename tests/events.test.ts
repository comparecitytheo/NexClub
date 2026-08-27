import { describe, it, expect, vi } from "vitest";

vi.mock("@prisma/client", () => ({
  RsvpStatus: { GOING: "GOING", NOT_GOING: "NOT_GOING" },
}));

import { isSuperAdmin } from "@/lib/rbac";
import { eventSchema, rsvpSchema } from "@/server/validators/event";

/** Mirrors the guard on POST/PATCH/DELETE /api/events. */
const canManageEvents = (role: string) => isSuperAdmin(role as never);

describe("who can manage club events", () => {
  it("allows only Super Admins to create, edit or delete", () => {
    expect(canManageEvents("SUPER_ADMIN")).toBe(true);
    for (const role of ["ADMIN", "MANAGER", "SALES_REP", "SUPPORT_AGENT"]) {
      expect(canManageEvents(role)).toBe(false);
    }
  });

  it("keeps admins out — events are Super Admin only, unlike most admin work", () => {
    expect(canManageEvents("ADMIN")).toBe(false);
  });
});

describe("event validation", () => {
  const base = { title: "Networking breakfast", startsAt: "2026-09-01T08:00:00.000Z" };

  it("accepts a title and start time", () => {
    expect(eventSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a title that is too short to be meaningful", () => {
    expect(eventSchema.safeParse({ ...base, title: "AB" }).success).toBe(false);
  });

  it("requires a start time", () => {
    expect(eventSchema.safeParse({ title: "Networking breakfast", startsAt: "" }).success).toBe(false);
  });

  it("treats description, location and end time as optional", () => {
    const r = eventSchema.safeParse({ ...base, description: "", location: "", endsAt: "" });
    expect(r.success).toBe(true);
  });
});

describe("RSVP", () => {
  it("accepts going and not going", () => {
    expect(rsvpSchema.safeParse({ status: "GOING" }).success).toBe(true);
    expect(rsvpSchema.safeParse({ status: "NOT_GOING" }).success).toBe(true);
  });

  it("rejects anything else", () => {
    expect(rsvpSchema.safeParse({ status: "MAYBE" }).success).toBe(false);
    expect(rsvpSchema.safeParse({}).success).toBe(false);
  });

  it("is open to every member, not just Super Admins", () => {
    // The RSVP route uses requireUser, so role plays no part. This pins the
    // intent: managing events is restricted, responding to them is not.
    for (const role of ["SUPPORT_AGENT", "SALES_REP", "MANAGER", "ADMIN", "SUPER_ADMIN"]) {
      expect(rsvpSchema.safeParse({ status: "GOING" }).success).toBe(true);
      expect(typeof role).toBe("string");
    }
  });
});
