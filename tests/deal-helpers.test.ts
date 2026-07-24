import { describe, it, expect } from "vitest";
import { closedFields } from "@/server/deal-helpers";

describe("closedFields", () => {
  it("marks a won deal", () => {
    const r = closedFields("CLOSED_WON");
    expect(r.isWon).toBe(true);
    expect(r.closedAt).toBeInstanceOf(Date);
  });
  it("marks a lost deal", () => {
    const r = closedFields("CLOSED_LOST");
    expect(r.isWon).toBe(false);
    expect(r.closedAt).toBeInstanceOf(Date);
  });
  it("clears the flags for an open stage", () => {
    const r = closedFields("PROPOSAL");
    expect(r.isWon).toBeNull();
    expect(r.closedAt).toBeNull();
  });
});
