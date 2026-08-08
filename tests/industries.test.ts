import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory industries table mirroring the DB's case-insensitive unique index.
const h = vi.hoisted(() => {
  const store = { industries: [] as any[], memberIndustries: [] as string[] };
  let seq = 0;
  return { store, next: (p: string) => `${p}_${++seq}` };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    industry: {
      findFirst: async ({ where }: any) => {
        const eq = where?.name?.equals ?? where?.name;
        const ci = where?.name?.mode === "insensitive";
        return (
          h.store.industries.find((r: any) =>
            ci ? r.name.toLowerCase() === String(eq).toLowerCase() : r.name === eq
          ) ?? null
        );
      },
      findMany: async () => [...h.store.industries].sort((a: any, b: any) => a.name.localeCompare(b.name)),
      create: async ({ data }: any) => {
        if (h.store.industries.some((r: any) => r.name.toLowerCase() === data.name.toLowerCase())) {
          throw new Error("unique violation");
        }
        const row = { id: h.next("ind"), name: data.name, createdAt: new Date() };
        h.store.industries.push(row);
        return row;
      },
    },
    // listIndustryNames also reads the industries members actually have, so the
    // filter can never miss one that is in use.
    user: {
      findMany: async () => h.store.memberIndustries.map((industry: string) => ({ industry })),
      groupBy: async () =>
        h.store.memberIndustries.map((industry: string) => ({ industry, _count: { _all: 1 } })),
    },
  },
}));

import { resolveOrCreateIndustry, listIndustryNames } from "@/server/industries";
import { INDUSTRIES } from "@/lib/industries";

beforeEach(() => {
  h.store.industries.length = 0;
  h.store.memberIndustries.length = 0;
});

describe("industries: the shared source (resolve/create + list)", () => {
  it("creates a brand-new industry and returns its canonical name", async () => {
    const name = await resolveOrCreateIndustry("Renewables");
    expect(name).toBe("Renewables");
    expect(h.store.industries.map((r: any) => r.name)).toContain("Renewables");
  });

  it("reuses the existing record instead of duplicating (exact match)", async () => {
    await resolveOrCreateIndustry("Finance");
    const again = await resolveOrCreateIndustry("Finance");
    expect(again).toBe("Finance");
    expect(h.store.industries.filter((r: any) => r.name === "Finance")).toHaveLength(1);
  });

  it("dedupes case-insensitively and keeps the original casing", async () => {
    await resolveOrCreateIndustry("Finance");
    const again = await resolveOrCreateIndustry("  finance ");
    expect(again).toBe("Finance"); // canonical original, not "finance"
    expect(h.store.industries).toHaveLength(1);
  });

  it("trims surrounding whitespace before storing", async () => {
    const name = await resolveOrCreateIndustry("   Logistics   ");
    expect(name).toBe("Logistics");
  });

  it("throws on an empty / whitespace-only name", async () => {
    await expect(resolveOrCreateIndustry("   ")).rejects.toThrow();
    await expect(resolveOrCreateIndustry("")).rejects.toThrow();
  });

  it("listIndustryNames returns stored names alphabetically", async () => {
    await resolveOrCreateIndustry("Retail");
    await resolveOrCreateIndustry("Accounting");
    expect(await listIndustryNames()).toEqual(["Accounting", "Retail"]);
  });

  it("listIndustryNames falls back to the seed list when the table is empty", async () => {
    expect(await listIndustryNames()).toEqual([...INDUSTRIES]);
  });
});

describe("industries members typed themselves", () => {
  it("appear in the list even though they were never added to the table", async () => {
    // The bug: a member sets their industry from profile settings, which writes
    // User.industry without touching the industries table. The business showed
    // that industry in the directory, but the filter never offered it.
    h.store.industries.push({ id: "i1", name: "Finance", createdAt: new Date() });
    h.store.memberIndustries.push("Plumbing");

    const names = await listIndustryNames();

    expect(names).toContain("Finance");
    expect(names).toContain("Plumbing");
  });

  it("does not duplicate one that is already in the table", async () => {
    h.store.industries.push({ id: "i1", name: "Finance", createdAt: new Date() });
    h.store.memberIndustries.push("finance");

    const names = await listIndustryNames();

    expect(names.filter((n) => n.toLowerCase() === "finance")).toHaveLength(1);
    // The stored spelling wins, so the list stays tidy.
    expect(names).toContain("Finance");
  });

  it("stays alphabetical once the two sources are merged", async () => {
    h.store.industries.push({ id: "i1", name: "Retail", createdAt: new Date() });
    h.store.memberIndustries.push("Accounting");

    expect(await listIndustryNames()).toEqual(["Accounting", "Retail"]);
  });
});
