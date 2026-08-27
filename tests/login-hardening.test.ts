import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import bcrypt from "bcryptjs";

const AUTH = readFileSync(join(process.cwd(), "src/lib/auth.ts"), "utf8");

/**
 * Login was the only public auth endpoint with neither a rate limit nor a
 * constant-cost failure path. forgot-password, reset-password and invitation
 * accept all had limits, so credential stuffing simply used the front door.
 */
describe("login is rate limited", () => {
  it("limits per IP and per email", () => {
    expect(AUTH).toMatch(/rateLimit\(`login:ip:/);
    expect(AUTH).toMatch(/rateLimit\(`login:email:/);
  });
  it("takes the request so the client IP is available", () => {
    expect(AUTH).toMatch(/async authorize\(credentials, request\)/);
    expect(AUTH).toMatch(/getClientContext\(request\)/);
  });
  it("fails closed when either limit trips", () => {
    expect(AUTH).toMatch(/if \(!perIp\.ok \|\| !perEmail\.ok\) return null;/);
  });
});

describe("login does not leak which emails have accounts", () => {
  it("spends bcrypt time on the unknown-user path too", () => {
    expect(AUTH).toMatch(/await bcrypt\.compare\(password, DUMMY_HASH\)/);
  });

  it("uses a real bcrypt hash at the same cost factor the app writes", async () => {
    const m = /const DUMMY_HASH = "([^"]+)"/.exec(AUTH);
    expect(m).not.toBeNull();
    const hash = m![1];
    // Must be a genuine cost-10 hash, or the compare returns early and the
    // timing gap reopens silently.
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    await expect(bcrypt.compare("anything", hash)).resolves.toBe(false);
    // Generous timeout: a cost-10 compare is ~100ms alone, but it is CPU-bound
    // and the full suite runs files in parallel, so it can starve past the 5s
    // default and fail for load rather than for a weakened hash.
  }, 30_000);

  it("checks isActive and deletedAt before granting a session", () => {
    expect(AUTH).toMatch(/!user\.isActive \|\| user\.deletedAt/);
  });
});
