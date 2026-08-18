import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const AUTH = readFileSync(join(process.cwd(), "src/lib/auth.ts"), "utf8");
const SUPPORT = readFileSync(join(process.cwd(), "src/server/support-session.ts"), "utf8");

/**
 * Sessions expire after 1 hour of INACTIVITY.
 *
 * Structural assertions, because the failure they guard against is a future
 * edit dropping `updateAge` — which would silently turn a rolling timeout into
 * an absolute one and start signing people out mid-task exactly one hour
 * after login. Nothing would error; people would just be logged out for no
 * apparent reason.
 */
describe("session inactivity timeout", () => {
  it("expires 1 hour after the last request", () => {
    expect(AUTH).toMatch(/maxAge:\s*60\s*\*\s*60/);
  });

  it("renews on every request, so the timeout is rolling and not absolute", () => {
    // Without this, an active user is signed out an hour after logging in
    // regardless of what they are doing.
    expect(AUTH).toMatch(/updateAge:\s*0/);
  });

  it("keeps the JWT strategy", () => {
    expect(AUTH).toMatch(/strategy:\s*"jwt"/);
  });
});

describe("support mode expiry", () => {
  it("matches the login timeout", () => {
    // A support session is only read while signed in, so a longer TTL could
    // never be reached — it would only misreport how long access lasts.
    expect(SUPPORT).toMatch(/const TTL_MINUTES = 60;/);
  });

  it("still expires on its own, independent of the login", () => {
    expect(SUPPORT).toMatch(/expiresAt.*TTL_MINUTES/s);
    expect(SUPPORT).toMatch(/if \(p\.expiresAt < Date\.now\(\)\) return null/);
  });
});
