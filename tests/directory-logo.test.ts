import { describe, it, expect } from "vitest";
import { groupBusinesses } from "@/lib/directory";

const base = {
  role: "SALES_REP" as const,
  industry: null,
  services: null,
  phone: null,
  bio: null,
  avatarUrl: null,
  businessContacts: [] as never[],
};

describe("which logo a business shows", () => {
  it("uses the one the BUSINESS names, not whichever member has one", () => {
    // The old behaviour took the first member with a logo, so two colleagues
    // uploading different logos produced an arbitrary winner.
    const [g] = groupBusinesses([
      { ...base, id: "u1", name: "Amelia", businessId: "b1", businessName: "Webb Financial",
        businessLogoUrl: "amelia.png", businessLogoUserId: "u2" },
      { ...base, id: "u2", name: "Ryan", businessId: "b1", businessName: "Webb Financial",
        businessLogoUrl: "ryan.png", businessLogoUserId: "u2" },
    ] as never);
    expect(g.logoUserId).toBe("u2");
  });

  it("shows no logo when a business has not chosen one", () => {
    // Even though a member holds a logo file, the business has not adopted it.
    const [g] = groupBusinesses([
      { ...base, id: "u1", name: "Amelia", businessId: "b1", businessName: "Webb Financial",
        businessLogoUrl: "amelia.png", businessLogoUserId: null },
    ] as never);
    expect(g.logoUserId).toBeNull();
  });

  it("still shows a lone member's own logo", () => {
    // No business row means a group of one — their logo cannot belong to anyone
    // else, so using it is not an arbitrary pick.
    const [g] = groupBusinesses([
      { ...base, id: "u1", name: "Sole Trader", businessId: null, businessName: null,
        businessLogoUrl: "sole.png", businessLogoUserId: null },
    ] as never);
    expect(g.logoUserId).toBe("u1");
  });

  it("groups colleagues onto one card by business id", () => {
    const groups = groupBusinesses([
      { ...base, id: "u1", name: "Amelia", businessId: "b1", businessName: "Webb Financial",
        businessLogoUrl: null, businessLogoUserId: null },
      { ...base, id: "u2", name: "Ryan", businessId: "b1", businessName: "webb financial",
        businessLogoUrl: null, businessLogoUserId: null },
    ] as never);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
  });
});
