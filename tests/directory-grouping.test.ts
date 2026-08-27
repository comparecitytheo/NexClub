import { describe, it, expect } from "vitest";
import { groupBusinesses } from "@/lib/directory";

// Minimal member matching the shape grouping reads.
function member(over: Record<string, any>): any {
  return {
    id: "u",
    name: "Someone",
    role: "SALES_REP",
    businessName: null,
    industry: null,
    services: null,
    phone: null,
    bio: null,
    avatarUrl: null,
    businessContacts: [],
    ...over,
  };
}

describe("member directory grouping", () => {
  it("groups members that share a businessName (case-insensitive) into one business", () => {
    const groups = groupBusinesses([
      member({ id: "1", name: "Ann", businessName: "Acme", industry: "Finance" }),
      member({ id: "2", name: "Ben", businessName: "acme", industry: "Finance" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m: any) => m.name)).toEqual(["Ann", "Ben"]);
  });

  it("shows the business industry from its members, including a brand-new industry, on the card", () => {
    const groups = groupBusinesses([
      member({ id: "1", name: "Cara", businessName: "NovaCo", industry: "Underwater Basket Weaving" }),
    ]);
    expect(groups[0].industry).toBe("Underwater Basket Weaving");
  });

  it("a member invited by a business admin (same businessName) appears under that business", () => {
    const groups = groupBusinesses([
      member({ id: "admin", name: "Boss", role: "ADMIN", businessName: "Admin's Firm", industry: "Legal" }),
      member({ id: "emp", name: "New Hire", role: "SALES_REP", businessName: "Admin's Firm", industry: "Legal" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Admin's Firm");
    expect(groups[0].members.map((m: any) => m.id).sort()).toEqual(["admin", "emp"]);
  });

  it("a member with no businessName stands alone as their own single-person business", () => {
    const groups = groupBusinesses([
      member({ id: "solo", name: "Solo", businessName: null, industry: "Retail" }),
      member({ id: "a", name: "A", businessName: "Acme" }),
    ]);
    const solo = groups.find((g: any) => g.name === "Solo");
    expect(solo).toBeTruthy();
    expect(solo!.members).toHaveLength(1);
  });
});

describe("business logo", () => {
  it("uses the first member that has uploaded a logo to represent the business", () => {
    const groups = groupBusinesses([
      member({ id: "1", name: "Ann", businessName: "Acme", businessLogoUrl: null }),
      member({ id: "2", name: "Ben", businessName: "Acme", businessLogoUrl: "business-logos/2/x.png" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].logoUserId).toBe("2");
  });

  it("leaves the logo unset when nobody in the business has one", () => {
    const groups = groupBusinesses([member({ id: "1", name: "Ann", businessName: "Acme" })]);
    expect(groups[0].logoUserId).toBeNull();
  });

  it("keeps each single-person business with its own logo", () => {
    const groups = groupBusinesses([
      member({ id: "solo", name: "Solo", businessName: null, businessLogoUrl: "business-logos/solo/a.png" }),
      member({ id: "other", name: "Other", businessName: null }),
    ]);
    expect(groups.map((g: any) => g.logoUserId)).toEqual(["solo", null]);
  });
});
