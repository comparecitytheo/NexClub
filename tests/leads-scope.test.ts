import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * Received and Sent must be PERSONAL.
 *
 * A structural test, deliberately: the bug it guards was not a wrong result from
 * one query, it was a scope value that Prisma treats as "no condition". Both the
 * page and the API built their filter from `team ? { in: team } : undefined`, and
 * `undefined` means unfiltered — so for a Super Admin every tab returned the whole
 * club. Leads the member had sent appeared under Received, alongside leads
 * involving them at neither end. A behavioural test on one tab would have passed
 * while the other stayed broken, so this pins the property in both places.
 */
const PAGE = "src/app/(dashboard)/leads/page.tsx";
const API = "src/app/api/leads/route.ts";

describe("Received and Sent are scoped to the member, not the club", () => {
  const page = read(PAGE);
  const api = read(API);

  it("the page filters Received and Sent by the personal scope", () => {
    // `inbox` falls back to the user's own id; `mine` falls back to undefined.
    expect(page).toMatch(/const inbox = team \? \{ in: team \} : user\.id;/);
    expect(page).toMatch(/\{ referrerId: inbox \}/);
    expect(page).toMatch(/\{ ownerId: inbox \}/);
  });

  it("the API filters Received and Sent by the personal scope", () => {
    expect(api).toMatch(/const me = team \? \{ in: team \} : user\.id;/);
    expect(api).toMatch(/view === "received"\) and\.push\(\{ ownerId: me \}\)/);
    expect(api).toMatch(/view === "sent"\) and\.push\(\{ referrerId: me \}\)/);
  });

  it("neither uses the club-wide scope on Received or Sent", () => {
    // The club-wide value is legitimate on All — `{ OR: [{ ownerId: mine }, …] }`
    // — so these target the two personal branches by their ternary punctuation
    // rather than the bare property, which would also match the All clause.
    expect(page).not.toMatch(/\? \{ referrerId: mine \}/); // the Sent branch
    expect(page).not.toMatch(/: \{ ownerId: mine \};/); // the Received fallthrough
    expect(api).not.toMatch(/view === "received"\) and\.push\(\{ ownerId: who \}\)/);
    expect(api).not.toMatch(/view === "sent"\) and\.push\(\{ referrerId: who \}\)/);
  });

  it("the page and the API agree, or the board changes on refresh", () => {
    // The board renders from the page then refetches from the API. If the two
    // scopes drift, a member sees one set of leads on load and another a moment
    // later — which is how this surfaced.
    for (const src of [page, api]) {
      expect(src).toMatch(/team \? \{ in: team \} : user\.id/);
    }
  });
});
