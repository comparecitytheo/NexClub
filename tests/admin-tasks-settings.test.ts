import { describe, it, expect, vi } from "vitest";

// The Prisma client isn't generated in this sandbox, so the enum *values* used by
// the zod schemas are mocked. On Vercel (where `prisma generate` runs) the real
// enums are identical, so these tests exercise the same validation logic.
vi.mock("@prisma/client", () => ({
  UserRole: { SUPER_ADMIN: "SUPER_ADMIN", ADMIN: "ADMIN", MANAGER: "MANAGER", SALES_REP: "SALES_REP", SUPPORT_AGENT: "SUPPORT_AGENT" },
  TaskPriority: { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" },
  TaskStatus: { OPEN: "OPEN", IN_PROGRESS: "IN_PROGRESS", COMPLETED: "COMPLETED", CANCELLED: "CANCELLED" },
  EntityType: { LEAD: "LEAD", CONTACT: "CONTACT", COMPANY: "COMPANY", DEAL: "DEAL" },
}));

import { taskScope } from "@/server/scope";
import { updateSettingsSchema } from "@/server/validators/admin";
import { createTaskSchema, updateTaskSchema, listTasksSchema } from "@/server/validators/task";

describe("taskScope (task permission gating)", () => {
  const org = "org1";
  it("gives admins the whole organization", () => {
    const where = taskScope({ id: "u1", organizationId: org, role: "ADMIN" });
    expect(where).toEqual({ organizationId: org });
  });
  it("limits members to tasks they're assigned or created", () => {
    const where = taskScope({ id: "u1", organizationId: org, role: "SALES_REP" });
    expect(where).toEqual({ organizationId: org, OR: [{ assigneeId: "u1" }, { creatorId: "u1" }] });
  });
});

const validSettings = {
  branding: { companyName: "NEX Club", supportEmail: "support@nex.club" },
  defaultSignupRole: "SALES_REP",
  security: { passwordMinLength: 10, sessionTimeoutMinutes: 60 },
  email: { from: "no-reply@nex.club" },
  features: { leads: true, deals: true, contacts: true, companies: true, tasks: true, events: false },
};

describe("updateSettingsSchema (settings save + validation)", () => {
  it("accepts a complete, valid settings object", () => {
    expect(updateSettingsSchema.safeParse(validSettings).success).toBe(true);
  });
  it("allows a blank support email but rejects a malformed one", () => {
    expect(updateSettingsSchema.safeParse({ ...validSettings, branding: { companyName: "X", supportEmail: "" } }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ ...validSettings, branding: { companyName: "X", supportEmail: "nope" } }).success).toBe(false);
  });
  it("rejects a password minimum below 8", () => {
    expect(updateSettingsSchema.safeParse({ ...validSettings, security: { passwordMinLength: 4, sessionTimeoutMinutes: 60 } }).success).toBe(false);
  });
  it("requires every feature flag to be present", () => {
    const { events, ...partial } = validSettings.features;
    expect(updateSettingsSchema.safeParse({ ...validSettings, features: partial }).success).toBe(false);
  });
});

describe("createTaskSchema (task create contract)", () => {
  it("accepts a minimal task and applies defaults", () => {
    const r = createTaskSchema.safeParse({ title: "Follow up", assigneeId: "u1" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.priority).toBe("MEDIUM");
      expect(r.data.recurrence).toBe("NONE");
    }
  });
  it("accepts a Related To link (entityType + entityId)", () => {
    const r = createTaskSchema.safeParse({ title: "Call", assigneeId: "u1", entityType: "LEAD", entityId: "lead1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.entityType).toBe("LEAD");
  });
  it("rejects an empty title or missing assignee", () => {
    expect(createTaskSchema.safeParse({ title: "", assigneeId: "u1" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: "X", assigneeId: "" }).success).toBe(false);
  });
});

describe("updateTaskSchema (task update/stage contract)", () => {
  it("accepts a stage-only update", () => {
    expect(updateTaskSchema.safeParse({ status: "IN_PROGRESS" }).success).toBe(true);
  });
  it("rejects an invalid stage", () => {
    expect(updateTaskSchema.safeParse({ status: "BOGUS" }).success).toBe(false);
  });
});

describe("listTasksSchema (entity filter for the overview panel)", () => {
  it("parses an entity filter and applies list defaults", () => {
    const r = listTasksSchema.safeParse({ entityType: "LEAD", entityId: "lead1" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.entityType).toBe("LEAD");
      expect(r.data.entityId).toBe("lead1");
      expect(r.data.scope).toBe("mine");
      expect(r.data.status).toBe("open");
    }
  });
});
