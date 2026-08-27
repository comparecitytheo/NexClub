import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const API = readFileSync(join(process.cwd(), "src/app/api/leads/route.ts"), "utf8");
const METRICS = readFileSync(join(process.cwd(), "src/server/metrics.ts"), "utf8");
const PAGE = readFileSync(join(process.cwd(), "src/app/(dashboard)/leads/page.tsx"), "utf8");

const VALIDATOR = readFileSync(join(process.cwd(), "src/server/validators/lead.ts"), "utf8");

describe("a lead can be logged after the fact", () => {
  it("accepts a received date on create", () => {
    expect(VALIDATOR).toMatch(/dateReceived: optionalDate\(\),/);
  });

  it("keeps it optional, so the existing flow is unchanged", () => {
    // optionalDate() yields undefined when blank, and the API falls back to now.
    expect(VALIDATOR).toMatch(/dateReceived: optionalDate\(\)/);
    expect(API).toMatch(/dateReceived && dateReceived < now \? dateReceived : now/);
  });

  it("clamps a future date to now rather than rejecting the referral", () => {
    // A clock skew on the client should not fail an otherwise valid lead, but a
    // lead received "tomorrow" would sit in a window nobody is looking at.
    expect(API).toMatch(/const receivedAt = dateReceived && dateReceived < now \? dateReceived : now;/);
    expect(API).toMatch(/dateReceived: receivedAt,/);
  });
});

describe("a backdated lead lands in the right period everywhere", () => {
  it("the lead list filters on dateReceived", () => {
    expect(PAGE).toMatch(/\{ dateReceived: \{ gte: from, lte: to \} \}/);
    expect(API).toMatch(/\{ dateReceived: range \}/);
  });

  it("lead metrics filter on dateReceived", () => {
    expect(METRICS).toMatch(/const inRange = range \? \{ dateReceived: \{ gte: range\.from, lte: range\.to \} \} : \{\};/);
    expect(METRICS).toMatch(/const leadRange = range \? \{ dateReceived: /);
  });

  it("deals keep createdAt, having no received date", () => {
    expect(METRICS).toMatch(/const dealRange = range \? \{ createdAt: /);
  });

  it("the displayed timestamp shows the same date the filter uses", () => {
    // Otherwise a lead backdated to June would read "today" while being absent
    // from today's range.
    expect(PAGE).toMatch(/createdAt: l\.dateReceived \? new Date\(l\.dateReceived\)\.toISOString\(\) : ""/);
  });
});
