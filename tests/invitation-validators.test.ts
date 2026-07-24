import { describe, it, expect } from "vitest";
import { createInvitationSchema, acceptInvitationSchema } from "@/server/validators/invitation";

// These schemas use libphonenumber-js + a free-form industry string + the shared
// password policy — none of which touch the Prisma client — so this suite runs
// as-is in any environment.
const valid = {
  businessName: "Acme Pty Ltd",
  contactPerson: "Dana Reed",
  email: "dana@acme.io",
  mobileNumber: "+61412345678",
  industry: "Finance",
};

describe("createInvitationSchema", () => {
  it("accepts a complete, valid invitation", () => {
    expect(createInvitationSchema.safeParse(valid).success).toBe(true);
  });

  it("requires businessName and contactPerson", () => {
    expect(createInvitationSchema.safeParse({ ...valid, businessName: "" }).success).toBe(false);
    expect(createInvitationSchema.safeParse({ ...valid, contactPerson: "" }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(createInvitationSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a genuinely invalid mobile number", () => {
    expect(createInvitationSchema.safeParse({ ...valid, mobileNumber: "12345" }).success).toBe(false);
    expect(createInvitationSchema.safeParse({ ...valid, mobileNumber: "not a phone" }).success).toBe(false);
  });

  it("accepts an Australian mobile in local or international format", () => {
    // Local AU format (what a Sydney admin will actually type).
    expect(createInvitationSchema.safeParse({ ...valid, mobileNumber: "0412 345 678" }).success).toBe(true);
    expect(createInvitationSchema.safeParse({ ...valid, mobileNumber: "0412345678" }).success).toBe(true);
    // International formats.
    expect(createInvitationSchema.safeParse({ ...valid, mobileNumber: "+61412345678" }).success).toBe(true);
    expect(createInvitationSchema.safeParse({ ...valid, mobileNumber: "+14155552671" }).success).toBe(true);
  });

  it("accepts a brand-new industry name (added via 'Add new industry') and rejects an empty one", () => {
    // Industry is now a free-form name resolved/created server-side against the
    // shared industries table, so any non-empty value validates.
    expect(createInvitationSchema.safeParse({ ...valid, industry: "Underwater Basket Weaving" }).success).toBe(true);
    expect(createInvitationSchema.safeParse({ ...valid, industry: "  " }).success).toBe(false);
    expect(createInvitationSchema.safeParse({ ...valid, industry: "" }).success).toBe(false);
  });
});

describe("acceptInvitationSchema", () => {
  it("accepts a token with a strong password", () => {
    expect(acceptInvitationSchema.safeParse({ token: "abc", password: "Sup3rSecret" }).success).toBe(true);
  });

  it("rejects a weak password", () => {
    expect(acceptInvitationSchema.safeParse({ token: "abc", password: "weak" }).success).toBe(false);
  });

  it("requires a token", () => {
    expect(acceptInvitationSchema.safeParse({ token: "", password: "Sup3rSecret" }).success).toBe(false);
  });
});
