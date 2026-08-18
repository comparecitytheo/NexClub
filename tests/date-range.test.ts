import { describe, it, expect } from "vitest";
import { resolveDateRange } from "@/lib/date-range";

/**
 * A preset must span exactly the number of days it names.
 *
 * The bug: subtracting the full N from today and starting at midnight gave
 * N + 1 calendar days — "7 Days" showed eight, "90 Days" ninety-one. Every
 * figure on the dashboard was drawn from a window wider than its own label.
 */
function calendarDays(r: { from: Date; to: Date }) {
  const end = new Date(r.to);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - r.from.getTime()) / 86_400_000) + 1;
}

describe("preset ranges span exactly what they say", () => {
  for (const days of [7, 30, 90]) {
    it(`"${days} Days" covers ${days} calendar days`, () => {
      expect(calendarDays(resolveDateRange({ range: String(days) }))).toBe(days);
    });
  }

  it("ends at the end of today, so a lead created this afternoon still counts", () => {
    const { to } = resolveDateRange({ range: "7" });
    expect(to.getHours()).toBe(23);
    expect(to.getMinutes()).toBe(59);
  });

  it("starts at midnight, so the first day is whole", () => {
    const { from } = resolveDateRange({ range: "30" });
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
  });

  it("includes today", () => {
    const { from, to } = resolveDateRange({ range: "7" });
    const now = new Date();
    expect(from.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(to.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });
});

describe("custom ranges are inclusive at both ends", () => {
  it("covers whole days from the first to the last", () => {
    const r = resolveDateRange({ from: "2026-06-01", to: "2026-06-30" });
    expect(calendarDays(r)).toBe(30);
    expect(r.from.getHours()).toBe(0);
    expect(r.to.getHours()).toBe(23);
  });

  it("swaps the dates if they are given backwards", () => {
    const r = resolveDateRange({ from: "2026-06-30", to: "2026-06-01" });
    expect(r.from.getTime()).toBeLessThan(r.to.getTime());
  });

  it("falls back to a preset when the dates are unusable", () => {
    const r = resolveDateRange({ from: "not-a-date", to: "also-not" });
    expect(Number.isNaN(r.from.getTime())).toBe(false);
    expect(Number.isNaN(r.to.getTime())).toBe(false);
  });
});
