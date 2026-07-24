import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, formatRelative, initials } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats whole AUD amounts with grouping", () => {
    expect(formatCurrency(1500)).toContain("1,500");
  });
  it("accepts numeric strings", () => {
    expect(formatCurrency("2500")).toContain("2,500");
  });
  it("accepts Decimal-like objects via toString", () => {
    expect(formatCurrency({ toString: () => "1234.4" })).toContain("1,234");
  });
  it("returns an em dash for null, empty, or non-numeric", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency("")).toBe("—");
    expect(formatCurrency("abc")).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats month and year", () => {
    expect(formatDate(new Date("2026-03-09T12:00:00Z"))).toContain("Mar 2026");
  });
  it("returns an em dash for null", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("formatRelative", () => {
  it("returns Today for now", () => {
    expect(formatRelative(new Date())).toBe("Today");
  });
  it("returns Yesterday for ~26 hours ago", () => {
    expect(formatRelative(new Date(Date.now() - 26 * 3600 * 1000))).toBe("Yesterday");
  });
  it("returns N days ago within a week", () => {
    expect(formatRelative(new Date(Date.now() - 3 * 86400 * 1000))).toBe("3 days ago");
  });
});

describe("initials", () => {
  it("takes the first two name parts", () => {
    expect(initials("Marcus Chen")).toBe("MC");
  });
  it("handles a single name", () => {
    expect(initials("Priya")).toBe("P");
  });
  it("falls back to a question mark", () => {
    expect(initials("")).toBe("?");
    expect(initials(null)).toBe("?");
  });
});
