import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { bearerMatches } from "@/server/request";

/**
 * The cron endpoints are public URLs. The shared secret is the only thing
 * between an attacker and a job that emails the whole club, so the comparison
 * must not short-circuit on the first differing byte.
 */
describe("bearerMatches", () => {
  const S = "s3cret-value";
  it("accepts the correct secret", () => expect(bearerMatches(`Bearer ${S}`, S)).toBe(true));
  it("rejects a wrong secret of the same length", () =>
    expect(bearerMatches("Bearer wrong-value", S)).toBe(false));
  it("rejects a matching prefix", () => expect(bearerMatches("Bearer s3cret-valu", S)).toBe(false));
  it("rejects the wrong scheme casing", () => expect(bearerMatches(`bearer ${S}`, S)).toBe(false));
  it("rejects a missing or empty header", () => {
    expect(bearerMatches(null, S)).toBe(false);
    expect(bearerMatches("", S)).toBe(false);
  });
  it("rejects an empty secret rather than matching everything", () =>
    expect(bearerMatches(`Bearer ${S}`, "")).toBe(false));
  it("rejects a bare token with no Bearer prefix", () => expect(bearerMatches(S, S)).toBe(false));
});

describe("every cron route uses it", () => {
  const routes = ["archive-leads", "task-reminders", "event-rsvp-reminders"];
  for (const r of routes) {
    const src = readFileSync(join(process.cwd(), `src/app/api/cron/${r}/route.ts`), "utf8");
    it(`${r} fails closed when CRON_SECRET is unset`, () => {
      expect(src).toMatch(/if \(!secret\)/);
      expect(src).toMatch(/status: 503/);
    });
    it(`${r} compares in constant time`, () => {
      expect(src).toMatch(/bearerMatches\(/);
      expect(src).not.toMatch(/!== `Bearer/);
    });
  }
});
