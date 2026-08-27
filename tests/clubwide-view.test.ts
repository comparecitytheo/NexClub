import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PAGE = readFileSync(join(process.cwd(), "src/app/(dashboard)/leads/page.tsx"), "utf8");
const API = readFileSync(join(process.cwd(), "src/app/api/leads/route.ts"), "utf8");
const BOARD = readFileSync(join(process.cwd(), "src/components/leads/lead-board.tsx"), "utf8");

/**
 * "Club wide" is a Super-Admin-only tab showing every lead in the club.
 * "All" is now a BUSINESS view for every role, Super Admin included.
 */
describe("the Club wide tab", () => {
  it("exists and is labelled for people, not code", () => {
    expect(BOARD).toMatch(/\{ value: "clubwide", label: "Club wide" \}/);
  });

  it("is only rendered for a Super Admin", () => {
    expect(BOARD).toMatch(/isSuperAdmin \? SUPER_ADMIN_VIEWS : \[\]/);
  });

  it("returns every lead in the club, unfiltered", () => {
    expect(PAGE).toMatch(/view === "clubwide"[\s\S]{0,200}\{\}/);
  });

  it("names both parties on each row", () => {
    // A lead between two OTHER businesses would otherwise show neither side.
    expect(BOARD).toMatch(/view === "all" \|\| view === "clubwide"/);
  });
});

describe("Club wide cannot be reached by editing the URL", () => {
  it("the page checks the role before honouring the view", () => {
    // Without this a member could type ?view=clubwide and see the whole club.
    expect(PAGE).toMatch(/rawView === "clubwide" && isSuperAdmin\(user\.role\)/);
  });

  it("the API falls back to the member's own business scope", () => {
    expect(API).toMatch(/view === "clubwide"[\s\S]{0,260}if \(!superAdmin\)/);
  });
});

describe("All is now a business view for every role", () => {
  it("a Super Admin is no longer exempt from the business scope", () => {
    // Previously `team` was null for a Super Admin, which made All unfiltered —
    // there was no way for them to see just their own business.
    expect(PAGE).toMatch(/const team = await colleagueIdsFor\(user\.id\);/);
    expect(API).toMatch(/const team = await colleagueIdsFor\(user\.id\);/);
    expect(PAGE).not.toMatch(/const team = superAdmin \? null/);
    expect(API).not.toMatch(/const team = superAdmin \? null/);
  });

  it("still scopes All to the business, both directions", () => {
    expect(PAGE).toMatch(/OR: \[\{ ownerId: mine \}, \{ referrerId: mine \}\]/);
    expect(API).toMatch(/OR: \[\{ ownerId: who \}, \{ referrerId: who \}\]/);
  });

  it("leaves Received and Sent scoped to the business for everyone", () => {
    // Business scoping is correct — leads cross businesses, so a lead this
    // business sent has an owner elsewhere and stays out of Received.
    expect(PAGE).toMatch(/\{ ownerId: mine \};/);
    expect(API).toMatch(/view === "received"\) and\.push\(\{ ownerId: who \}\)/);
  });
});

/**
 * Club wide must be a first-class view, not a stripped-down one: the same
 * kanban, the same list, the same detail panel, filters and controls as every
 * other tab.
 */
describe("Club wide has full UI parity", () => {
  it("offers the kanban/list toggle, like every tab except Deleted", () => {
    // Deleted is the only view that forces a list.
    expect(BOARD).toMatch(/view !== "deleted" && \(/);
    expect(BOARD).not.toMatch(/view !== "clubwide" &&[\s\S]{0,40}viewMode/);
  });

  it("renders the same kanban columns, ungated by view", () => {
    expect(BOARD).toMatch(/LEAD_STATUS_ORDER\.map\(\(s\) => \(\s*<Column/);
  });

  it("uses the same list component and detail panel", () => {
    expect(BOARD).toMatch(/deletedView=\{view === "deleted"\}/);
    expect(BOARD).toMatch(/onOpen=\{openPanel\}/);
  });

  it("has its own description rather than falling through to another tab's", () => {
    expect(BOARD).toMatch(/view === "clubwide"\s*\?\s*"Every lead in the club/);
  });
});

describe("Club wide is read-only", () => {
  it("cards cannot be dragged there", () => {
    // Dragging would move ANOTHER business's lead through their pipeline — a
    // stage only they have the context to set.
    expect(BOARD).toMatch(/view !== "clubwide" && \(isAdmin \|\| lead\.ownerId === currentUserId\)/);
  });

  it("leaves dragging intact on every other tab", () => {
    expect(BOARD).toMatch(/isAdmin \|\| lead\.ownerId === currentUserId/);
  });
});
