import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique, findMany: mocks.findMany } },
}));

import { businessIdsFor, colleagueIdsFor } from "@/server/businesses";

beforeEach(() => {
  mocks.findUnique.mockReset();
  mocks.findMany.mockReset();
});

describe("which businesses a person can act within", () => {
  it("is the one business they belong to", async () => {
    mocks.findUnique.mockResolvedValue({ businessId: "b1" });
    expect(await businessIdsFor("u1")).toEqual(["b1"]);
  });

  it("grants nothing to someone with no business", async () => {
    mocks.findUnique.mockResolvedValue({ businessId: null });
    expect(await businessIdsFor("u1")).toEqual([]);
  });
});

describe("whose leads a person can see", () => {
  it("is everyone at their business, including themselves", async () => {
    mocks.findUnique.mockResolvedValue({ businessId: "b1" });
    mocks.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }, { id: "u3" }]);
    expect((await colleagueIdsFor("u1")).sort()).toEqual(["u1", "u2", "u3"]);
  });

  it("queries only their own businesses, never the whole club", async () => {
    mocks.findUnique.mockResolvedValue({ businessId: "b1" });
    mocks.findMany.mockResolvedValue([{ id: "u1" }]);
    await colleagueIdsFor("u1");
    const where = mocks.findMany.mock.calls[0][0].where;
    // The filter must be by business. A missing filter here would expose every
    // lead in the club to every member.
    expect(JSON.stringify(where)).toContain("b1");
    expect(where.businessId).toBeTruthy();
  });

  it("falls back to just themselves when they have no business", async () => {
    mocks.findUnique.mockResolvedValue({ businessId: null });
    expect(await colleagueIdsFor("u1")).toEqual(["u1"]);
    // Critically, it must NOT query for colleagues — an unfiltered query would
    // return the entire club.
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
