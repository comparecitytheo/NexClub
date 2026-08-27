import { prisma } from "@/lib/prisma";
import { INDUSTRIES } from "@/lib/industries";

// The industries table is the single shared source for every dropdown, filter,
// and facet. src/lib/industries.ts is now only the seed list + a safe fallback.

// All industry names, alphabetical. Falls back to the seed list if the table is
// empty (e.g. a fresh DB before the migration has been applied) so dropdowns are
// never blank.
export async function listIndustryNames(): Promise<string[]> {
  // The industries table alone is not enough: a member can set their own
  // industry from profile settings, which writes User.industry without ever
  // touching this table. Those industries appeared on business cards in the
  // directory but were missing from the filter dropdown, so they could not be
  // filtered for. Union the two so every industry actually in use is listed.
  const [rows, inUse] = await Promise.all([
    prisma.industry.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.user.findMany({
      where: { industry: { not: null }, isActive: true },
      distinct: ["industry"],
      select: { industry: true },
    }),
  ]);

  const names = new Map<string, string>(); // lowercase key -> display name
  for (const r of rows) names.set(r.name.toLowerCase(), r.name);
  for (const u of inUse) {
    const name = u.industry?.trim();
    if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }

  // Seed list only as a last resort, so a fresh database still has options.
  if (names.size === 0) return [...INDUSTRIES];
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

// Every industry, with how many active members use each. Powers the admin
// management screen; the count is what makes a rename or delete a safe decision.
export async function listIndustriesWithUsage(): Promise<
  { id: string | null; name: string; memberCount: number }[]
> {
  const [rows, grouped] = await Promise.all([
    prisma.industry.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.groupBy({
      by: ["industry"],
      where: { industry: { not: null }, isActive: true },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map<string, number>();
  for (const g of grouped) {
    const key = g.industry?.trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + g._count._all);
  }

  // `id: string | null` — free-text industries appended below have no table row
  // and are pushed with a null id, so the inferred `string` would be too narrow.
  const out: { id: string | null; name: string; memberCount: number }[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    memberCount: counts.get(r.name.toLowerCase()) ?? 0,
  }));

  // Industries members typed themselves that were never added to the table —
  // shown with a null id so the UI can offer to formalise them.
  const known = new Set(rows.map((r) => r.name.toLowerCase()));
  for (const g of grouped) {
    const name = g.industry?.trim();
    if (name && !known.has(name.toLowerCase())) {
      out.push({ id: null, name, memberCount: g._count._all });
    }
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Resolve an industry name to its canonical stored form, creating it if it's new.
// - trims whitespace
// - throws on empty
// - case-insensitive match against existing industries (reuse, never duplicate)
// - tolerant of a concurrent insert (unique index) via a re-read
export async function resolveOrCreateIndustry(rawName: string): Promise<string> {
  const name = rawName.trim();
  if (!name) throw new Error("Industry name is required");

  const existing = await prisma.industry.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { name: true },
  });
  if (existing) return existing.name;

  try {
    const created = await prisma.industry.create({ data: { name }, select: { name: true } });
    return created.name;
  } catch {
    // Lost a race against another insert of the same (case-insensitive) name.
    const again = await prisma.industry.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { name: true },
    });
    return again?.name ?? name;
  }
}
