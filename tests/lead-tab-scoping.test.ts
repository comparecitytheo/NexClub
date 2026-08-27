import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PAGE = readFileSync(join(process.cwd(), "src/app/(dashboard)/leads/page.tsx"), "utf8");
const API = readFileSync(join(process.cwd(), "src/app/api/leads/route.ts"), "utf8");

/**
 * Every lead tab is scoped to the signed-in member's BUSINESS.
 *
 * The bug these guard against was not business scoping — it was EXEMPTING a
 * role from it. `mine`/`who` resolve to `undefined` when the business lookup is
 * skipped, and `{ ownerId: undefined }` is not "everything of mine", it is NO
 * FILTER: the whole club leaking into a personal tab. That is why a Super Admin
 * saw leads they had sent, and leads they had nothing to do with, in Received.
 *
 * Club-wide sight belongs on its own tab, never as a side effect of a missing
 * filter.
 */
describe("Received and Sent are business views", () => {
  it("scopes Received to the business, on the page", () => {
    expect(PAGE).toMatch(/\{ ownerId: mine \};/);
  });

  it("scopes Sent to the business, on the page", () => {
    expect(PAGE).toMatch(/view === "sent"\s*\?\s*\{ referrerId: mine \}/);
  });

  it("scopes both to the business, in the API", () => {
    expect(API).toMatch(/view === "received"\) and\.push\(\{ ownerId: who \}\)/);
    expect(API).toMatch(/view === "sent"\) and\.push\(\{ referrerId: who \}\)/);
  });

  it("exempts NO role from the business filter", () => {
    // The exemption is the bug. Any `superAdmin ? … :` around the scope
    // variables reintroduces the unfiltered club-wide leak.
    expect(PAGE).toMatch(/const team = await colleagueIdsFor\(user\.id\);/);
    expect(API).toMatch(/const team = await colleagueIdsFor\(user\.id\);/);
    expect(PAGE).not.toMatch(/const team = superAdmin \? null/);
    expect(API).not.toMatch(/const team = superAdmin \? null/);
  });
});

describe("a sent lead does not come back into Received", () => {
  it("relies on Received matching the OWNER and Sent the REFERRER", () => {
    // Leads cross businesses in a referral club, so a lead this business sent
    // has an owner elsewhere and cannot match Received.
    expect(PAGE).toMatch(/ownerId: mine/);
    expect(PAGE).toMatch(/referrerId: mine/);
    expect(PAGE).not.toMatch(/view === "sent"[\s\S]{0,80}ownerId/);
  });
});

describe("All combines both directions", () => {
  it("shows anything the business is party to", () => {
    expect(PAGE).toMatch(/OR: \[\{ ownerId: mine \}, \{ referrerId: mine \}\]/);
    expect(API).toMatch(/OR: \[\{ ownerId: who \}, \{ referrerId: who \}\]/);
  });
});

describe("only Club wide crosses businesses", () => {
  it("is Super Admin only and role-checked server-side", () => {
    expect(PAGE).toMatch(/rawView === "clubwide" && isSuperAdmin\(user\.role\)/);
    expect(API).toMatch(/view === "clubwide"[\s\S]{0,260}if \(!superAdmin\)/);
  });
});

describe("the scope fails closed", () => {
  it("never resolves to an unfiltered query", () => {
    // `undefined` in a Prisma where means NO FILTER, not "nothing" — that is how
    // the whole club ended up in a personal tab. An empty team must produce an
    // empty list instead.
    expect(PAGE).toMatch(/const mine = \{ in: team\.length \? team : \[user\.id\] \};/);
    expect(API).toMatch(/const who = \{ in: team\.length \? team : \[user\.id\] \};/);
    expect(PAGE).not.toMatch(/const mine = team\.length \? \{ in: team \} : undefined;/);
    expect(API).not.toMatch(/const who = team\.length \? \{ in: team \} : undefined;/);
  });
});
