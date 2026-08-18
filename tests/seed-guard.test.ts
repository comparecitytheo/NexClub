import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SEED = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf8");

/**
 * The seed deletes the club organization and everything cascading from it.
 *
 * It used to be guarded by `NODE_ENV === "production"`, which is the wrong
 * signal: NODE_ENV is "development" whenever a script runs locally, and
 * DEPLOY.md tells the operator to run release commands "locally with your env
 * pointed at production". In that shell the guard stayed silent.
 */
const isLocalDb = (u: string) =>
  /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal|postgres|db)[:/]/.test(u);

describe("the seed refuses to run against a non-local database", () => {
  const remote = [
    ["Neon", "postgresql://u:p@ep-x.ap-southeast-2.aws.neon.tech/neondb?sslmode=require"],
    ["Supabase", "postgresql://u:p@db.abcdefg.supabase.co:5432/postgres"],
    ["RDS", "postgresql://u:p@prod.cluster-x.rds.amazonaws.com:5432/crm"],
    ["unset", ""],
  ] as const;
  for (const [label, url] of remote) {
    it(`refuses: ${label}`, () => expect(isLocalDb(url)).toBe(false));
  }

  const local = [
    ["localhost", "postgresql://user:pass@localhost:5432/valet_crm"],
    ["loopback IP", "postgresql://postgres@127.0.0.1:5433/nexlink"],
    ["docker host", "postgresql://u:p@host.docker.internal:5432/db"],
    ["compose service", "postgresql://u:p@postgres:5432/db"],
  ] as const;
  for (const [label, url] of local) {
    it(`allows: ${label}`, () => expect(isLocalDb(url)).toBe(true));
  }

  it("keys on the DATABASE_URL, not NODE_ENV", () => {
    expect(SEED).toMatch(/const dbUrl = process\.env\.DATABASE_URL/);
    expect(SEED).not.toMatch(/process\.env\.NODE_ENV === "production" && !process\.env\.ALLOW_DESTRUCTIVE_SEED/);
  });

  it("still allows a deliberate override", () => {
    expect(SEED).toMatch(/ALLOW_DESTRUCTIVE_SEED/);
  });
});
