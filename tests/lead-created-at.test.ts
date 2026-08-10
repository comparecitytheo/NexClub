import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime } from "@/lib/format";

describe("the created timestamp format", () => {
  const when = new Date("2026-06-02T09:15:00");

  it("shows date and time together", () => {
    const out = formatDateTime(when);
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/9:15/);
  });

  it("starts with exactly the same date formatDate produces", () => {
    // The two must not read as different conventions when shown side by side —
    // "Received" uses formatDate and "Created" uses this, in the same panel.
    expect(formatDateTime(when).startsWith(formatDate(when))).toBe(true);
  });

  it("renders an em dash rather than 'Invalid Date' for missing values", () => {
    // The card and list pass the value straight through, so a lead without a
    // timestamp must degrade quietly instead of printing junk.
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("")).toBe("—");
    expect(formatDateTime("not-a-date")).toBe("—");
  });

  it("accepts the ISO strings the API serialises", () => {
    expect(formatDateTime("2026-06-02T09:15:00.000Z")).not.toBe("—");
  });
});
