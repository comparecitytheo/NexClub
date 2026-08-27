import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Support mode must be read-only.
 *
 * This is a STRUCTURAL test rather than a behavioural one, and deliberately so:
 * the original bug was not that the block misbehaved, it was that 49 mutating
 * routes never called it. A test that exercises one route would have passed
 * while the other 48 stayed open. This asserts the property across every route.
 */
const API = join(process.cwd(), "src/app/api");

/** Endpoints with no session to block: public, or the way OUT of support mode. */
const EXEMPT = [
  "admin/support/route.ts",     // DELETE ends a session — must work while in one
  "auth/forgot-password/route.ts",
  "auth/register/route.ts",
  "auth/reset-password/route.ts",
  "invitations/accept/route.ts",
];

function routeFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, acc);
    else if (entry === "route.ts") acc.push(full);
  }
  return acc;
}

const MUTATES = /export async function (POST|PATCH|PUT|DELETE)/;

describe("every mutating API route blocks writes during support mode", () => {
  const files = routeFiles(API);

  it("finds the routes to check", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("uses a write guard wherever it mutates", () => {
    const unguarded: string[] = [];
    for (const f of files) {
      // Normalise separators: join() yields backslashes on Windows, which would
      // never match the forward-slash EXEMPT entries.
      const rel = f.slice(API.length + 1).replace(/\\/g, "/");
      if (EXEMPT.includes(rel)) continue;
      const src = readFileSync(f, "utf8");
      if (!MUTATES.test(src)) continue;
      if (!/require(User|Admin|SuperAdmin)ForWrite\(\)/.test(src)) unguarded.push(rel);
    }
    expect(unguarded).toEqual([]);
  });

  it("does not block reads — support mode exists to see the member's view", () => {
    // A GET-only route must not use a write guard, or viewing as a member would
    // fail outright rather than showing what they see.
    const wrong: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (MUTATES.test(src)) continue;
      if (/require(User|Admin|SuperAdmin)ForWrite\(\)/.test(src)) wrong.push(f.slice(API.length + 1));
    }
    expect(wrong).toEqual([]);
  });

  it("keeps the escape hatch usable", () => {
    const src = readFileSync(join(API, "admin/support/route.ts"), "utf8");
    expect(src).toMatch(/export async function DELETE/);
    expect(src).not.toMatch(/require(User|Admin|SuperAdmin)ForWrite\(\)/);
  });
});
