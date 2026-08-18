import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * A lead scope must never evaluate to `undefined`.
 *
 * The bug this guards was not a wrong result from one query. Both the page and
 * the API built their filter as `superAdmin ? undefined : { in: team }`, and
 * Prisma reads `undefined` as "no condition" — so for a Super Admin the filter
 * silently vanished and every tab returned the whole club. Leads the member had
 * sent appeared under Received, beside leads involving them at neither end.
 *
 * The fix is to fail CLOSED: fall back to the caller's own id, never to
 * `undefined`. Club-wide sight is an explicit view, not the absence of a filter.
 * A behavioural test on one tab would pass while another stayed broken, so this
 * pins the property in both files.
 */
const PAGE = "src/app/(dashboard)/leads/page.tsx";
const API = "src/app/api/leads/route.ts";

describe("a lead scope always falls closed, never to no filter", () => {
  const page = read(PAGE);
  const api = read(API);

  it("the page's scope falls back to the caller, not to undefined", () => {
    expect(page).toMatch(/const mine = \{ in: team\.length \? team : \[user\.id\] \}/);
    expect(page).not.toMatch(/const mine = team \? \{ in: team \} : undefined/);
  });

  it("the API's scope falls back to the caller, not to undefined", () => {
    expect(api).toMatch(/const who = \{ in: team\.length \? team : \[user\.id\] \}/);
    expect(api).not.toMatch(/const who = team \? \{ in: team \} : undefined/);
  });

  it("no Super Admin exemption is applied when building the scope", () => {
    // `superAdmin ? null : await colleagueIdsFor(...)` is what produced the
    // undefined. Club-wide access belongs to the clubwide view, not to the
    // scope value every tab shares.
    for (const src of [page, api]) {
      expect(src).not.toMatch(/superAdmin \? null : await colleagueIdsFor/);
      expect(src).toMatch(/const team = await colleagueIdsFor\(user\.id\)/);
    }
  });

  it("Received and Sent use that scope on the expected side", () => {
    expect(page).toMatch(/\? \{ referrerId: mine \}/);
    expect(api).toMatch(/view === "received"\) and\.push\(\{ ownerId: who \}\)/);
    expect(api).toMatch(/view === "sent"\) and\.push\(\{ referrerId: who \}\)/);
  });

  it("the page and the API agree, or the board changes on refresh", () => {
    // The board renders from the page then refetches from the API. If the two
    // scopes drift, a member sees one set of leads on load and another a moment
    // later — which is how the original fault surfaced.
    for (const src of [page, api]) {
      expect(src).toMatch(/team\.length \? team : \[user\.id\]/);
    }
  });
});
