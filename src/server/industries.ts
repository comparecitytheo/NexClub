import { prisma } from "@/lib/prisma";
import { INDUSTRIES } from "@/lib/industries";

// The industries table is the single shared source for every dropdown, filter,
// and facet. src/lib/industries.ts is now only the seed list + a safe fallback.

// All industry names, alphabetical. Falls back to the seed list if the table is
// empty (e.g. a fresh DB before the migration has been applied) so dropdowns are
// never blank.
export async function listIndustryNames(): Promise<string[]> {
  const rows = await prisma.industry.findMany({ orderBy: { name: "asc" }, select: { name: true } });
  return rows.length ? rows.map((r) => r.name) : [...INDUSTRIES];
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
