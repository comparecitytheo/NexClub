import { describe, it, expect } from "vitest";
import { createLeadSchema } from "@/server/validators/lead";
import { createContactSchema } from "@/server/validators/contact";
import { listTasksSchema } from "@/server/validators/task";

// These schemas reference Prisma enums via z.nativeEnum, so this suite needs
// the generated Prisma client (run `npm run db:generate` first).
describe("createLeadSchema", () => {
  it("requires ownerId and contactName", () => {
    expect(createLeadSchema.safeParse({}).success).toBe(false);
  });
  it("accepts a minimal lead and defaults the source to REFERRAL", () => {
    const r = createLeadSchema.safeParse({ ownerId: "u1", contactName: "Jane", consentConfirmed: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.source).toBe("REFERRAL");
  });
  it("coerces valueEstimate and blanks an empty email", () => {
    const r = createLeadSchema.safeParse({
      ownerId: "u1",
      contactName: "Jane",
      valueEstimate: "5000",
      email: "",
      consentConfirmed: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.valueEstimate).toBe(5000);
      expect(r.data.email).toBeUndefined();
    }
  });
});

describe("createContactSchema", () => {
  it("requires first and last name", () => {
    expect(createContactSchema.safeParse({ firstName: "A" }).success).toBe(false);
  });
  it("defaults status to ACTIVE", () => {
    const r = createContactSchema.safeParse({ firstName: "A", lastName: "B" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("ACTIVE");
  });
});

describe("listTasksSchema", () => {
  it("applies scope and status defaults", () => {
    const r = listTasksSchema.parse({});
    expect(r.scope).toBe("mine");
    expect(r.status).toBe("open");
  });
});
