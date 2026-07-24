import { describe, it, expect } from "vitest";
import {
  entityHref,
  auditEntityHref,
  NOTIFICATION_LABELS,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_BADGE,
} from "@/lib/notifications";

describe("entityHref", () => {
  it("maps each entity type to its route", () => {
    expect(entityHref("LEAD", "l1")).toBe("/leads/l1");
    expect(entityHref("CONTACT", "c1")).toBe("/contacts/c1");
    expect(entityHref("COMPANY", "co1")).toBe("/companies/co1");
    expect(entityHref("DEAL", "d1")).toBe("/deals/d1");
  });
  it("returns null when the type or id is missing", () => {
    expect(entityHref(null, "x")).toBeNull();
    expect(entityHref("LEAD", null)).toBeNull();
  });
});

describe("auditEntityHref", () => {
  it("maps known model names to routes", () => {
    expect(auditEntityHref("Lead", "l1")).toBe("/leads/l1");
    expect(auditEntityHref("Task", "t1")).toBe("/tasks/t1");
  });
  it("returns null for unknown types or missing id", () => {
    expect(auditEntityHref("User", "u1")).toBeNull();
    expect(auditEntityHref("Lead", null)).toBeNull();
  });
});

describe("label and badge maps", () => {
  it("provides notification and audit labels", () => {
    expect(NOTIFICATION_LABELS.LEAD_ASSIGNED).toBeTruthy();
    expect(AUDIT_ACTION_LABELS.STATUS_CHANGE).toBe("Status change");
    expect(AUDIT_ACTION_BADGE.CREATE).toContain("emerald");
  });
});
