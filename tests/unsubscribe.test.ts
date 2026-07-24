import { describe, it, expect, vi } from "vitest";

// The unsubscribe link is reachable without a session, so the token is the only
// thing standing between a stranger and switching someone's email off.
vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "test-secret-value-for-signing" } }));

import { unsubscribeToken, unsubscribeTokenMatches } from "@/lib/unsubscribe";

describe("unsubscribe token", () => {
  it("is stable for the same user, so a link keeps working", () => {
    expect(unsubscribeToken("user-1")).toBe(unsubscribeToken("user-1"));
  });

  it("differs per user, so one member's link cannot unsubscribe another", () => {
    expect(unsubscribeToken("user-1")).not.toBe(unsubscribeToken("user-2"));
  });

  it("accepts the matching token", () => {
    expect(unsubscribeTokenMatches("user-1", unsubscribeToken("user-1"))).toBe(true);
  });

  it("rejects another user's token", () => {
    expect(unsubscribeTokenMatches("user-1", unsubscribeToken("user-2"))).toBe(false);
  });

  it("rejects a guessed or empty token without throwing", () => {
    for (const bad of ["", "abc", "0".repeat(32), "not-a-real-token-value-here!!"]) {
      expect(() => unsubscribeTokenMatches("user-1", bad)).not.toThrow();
      expect(unsubscribeTokenMatches("user-1", bad)).toBe(false);
    }
  });

  it("does not leak the user id in the token", () => {
    expect(unsubscribeToken("user-1")).not.toContain("user-1");
  });
});
