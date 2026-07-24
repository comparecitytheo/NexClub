import { describe, it, expect, vi } from "vitest";

// The validators reference Prisma enums via z.nativeEnum, so supply the enum
// objects directly rather than booting the Prisma engine (same approach as
// tests/shared-lead.test.ts).
vi.mock("@prisma/client", () => ({
  LeadStatus: { NEW: "NEW", CONTACTED: "CONTACTED", IN_PROGRESS: "IN_PROGRESS", CLOSED_WON: "CLOSED_WON", CLOSED_LOST: "CLOSED_LOST" },
  SentLeadStatus: { SENT: "SENT", VIEWED: "VIEWED", RESPONDED: "RESPONDED", CONVERTED: "CONVERTED", CLOSED: "CLOSED" },
  LeadSource: { REFERRAL: "REFERRAL", WEBSITE: "WEBSITE", COLD_OUTREACH: "COLD_OUTREACH", EVENT: "EVENT", SOCIAL: "SOCIAL", OTHER: "OTHER" },
  LeadPriority: { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" },
}));

import { createLeadSchema } from "@/server/validators/lead";
import { CONSENT_STATEMENT, CONSENT_STATEMENT_VERSION, CONSENT_HINT } from "@/lib/consent";

// A lead is a third party who never joined the club, so sending their details to
// another member business is a disclosure between separate entities (APP 6).
// These tests pin the gate shut at the validator, which is what the API enforces.

const valid = {
  ownerId: "member-1",
  contactName: "Jordan Reyes",
  consentConfirmed: true as const,
};

describe("lead consent gate", () => {
  it("accepts a lead when consent is confirmed", () => {
    const r = createLeadSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("rejects a lead when the consent field is missing entirely", () => {
    const { consentConfirmed, ...withoutConsent } = valid;
    void consentConfirmed;
    const r = createLeadSchema.safeParse(withoutConsent);
    expect(r.success).toBe(false);
  });

  it("rejects a lead when consent is explicitly false", () => {
    const r = createLeadSchema.safeParse({ ...valid, consentConfirmed: false });
    expect(r.success).toBe(false);
  });

  it("rejects truthy-but-not-true values, so the box cannot be faked", () => {
    for (const sneaky of ["true", 1, "yes", {}]) {
      const r = createLeadSchema.safeParse({ ...valid, consentConfirmed: sneaky });
      expect(r.success).toBe(false);
    }
  });

  it("explains what to do when consent is missing", () => {
    const r = createLeadSchema.safeParse({ ...valid, consentConfirmed: false });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = JSON.stringify(r.error.flatten());
      expect(msg.toLowerCase()).toContain("consent");
    }
  });
});

describe("consent statement", () => {
  it("names both the disclosure and who receives it", () => {
    expect(CONSENT_STATEMENT).toMatch(/consent/i);
    expect(CONSENT_STATEMENT).toMatch(/NEX Club member/i);
  });

  it("is versioned, so historical records show the wording agreed at the time", () => {
    expect(CONSENT_STATEMENT_VERSION).toMatch(/^\d{4}-\d{2}-v\d+$/);
  });

  it("warns against sensitive information, which needs consent of its own", () => {
    expect(CONSENT_HINT.toLowerCase()).toContain("health");
  });
});
