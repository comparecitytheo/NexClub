import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/server/api-helpers";
import { runReport } from "@/server/reports";
import { getReport } from "@/server/reports/registry";
import type { ReportBlock } from "@/components/admin/club-report";

/**
 * Runs a custom set of metrics for the report builder.
 *
 * A GET, because it computes and returns figures without writing anything.
 *
 * Deliberately calls the SAME `runReport` the club-wide cards use, rather than
 * calculating anything here — two paths would drift and the numbers would stop
 * agreeing. This route only decides WHICH reports to run and in WHAT scope.
 */
const querySchema = z.object({
  // Report keys, e.g. "revenue.by_member". Capped so one request cannot ask for
  // dozens of queries at once.
  metricKeys: z.array(z.string().trim().min(1)).min(1).max(12),
  // Scope. At most one of these is meaningful; none means club-wide.
  businessKey: z.string().trim().optional(),
  chapterId: z.string().trim().optional(),
  memberId: z.string().trim().optional(),
  rangeDays: z.number().int().positive().max(3650).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;

  // GET, not POST: this reads figures and writes nothing. Twelve keys plus a
  // scope come to roughly 350 characters, well inside any URL limit — so there
  // is no reason to use a verb that implies mutation and would otherwise need
  // exempting from the support-mode write guard.
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    metricKeys: (url.searchParams.get("metricKeys") ?? "").split(",").filter(Boolean),
    businessKey: url.searchParams.get("businessKey") ?? undefined,
    rangeDays: url.searchParams.get("rangeDays")
      ? Number(url.searchParams.get("rangeDays"))
      : undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { metricKeys, businessKey, chapterId, memberId, rangeDays, from, to } = parsed.data;

  // Unknown keys are dropped rather than failing the whole run: a saved report
  // may name a metric that has since been removed from the code.
  const known = [...new Set(metricKeys)].filter((k) => getReport(k));
  const skipped = [...new Set(metricKeys)].filter((k) => !getReport(k));
  if (known.length === 0) {
    return NextResponse.json({ error: "None of those metrics exist any more." }, { status: 400 });
  }

  // Resolve the scope the same way the reporting page does: a business maps to
  // its members, and no business means the whole club.
  let memberIds: string[] | undefined;
  let scopeName: string | null = null;

  // One member. Narrowest scope, and the only one that is a single person.
  if (memberId) {
    const m = await prisma.user.findFirst({
      where: { id: memberId, organizationId: user.organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!m) return NextResponse.json({ error: "Member not found." }, { status: 400 });
    memberIds = [m.id];
    scopeName = m.name;
  } else if (chapterId) {
    // A chapter is a property of the BUSINESS, so its members are everyone in
    // every business assigned to it.
    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, organizationId: user.organizationId },
      select: { id: true, name: true },
    });
    if (!chapter) return NextResponse.json({ error: "Chapter not found." }, { status: 400 });
    const members = await prisma.user.findMany({
      where: { organizationId: user.organizationId, deletedAt: null, business: { chapterId } },
      select: { id: true },
    });
    if (members.length === 0) {
      return NextResponse.json({ error: `No members in ${chapter.name} yet.` }, { status: 400 });
    }
    memberIds = members.map((x) => x.id);
    scopeName = chapter.name;
  } else if (businessKey) {
    const members = await prisma.user.findMany({
      where: { organizationId: user.organizationId, businessName: businessKey, deletedAt: null },
      select: { id: true, businessName: true },
    });
    if (members.length === 0) {
      return NextResponse.json({ error: "That business has no members." }, { status: 400 });
    }
    memberIds = members.map((m) => m.id);
    scopeName = members[0].businessName;
  }

  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - (rangeDays ?? 30) * 24 * 60 * 60 * 1000);
  const dateRange = { from: start.toISOString(), to: end.toISOString() };

  const ctx = {
    userId: memberIds ? memberIds[0] : user.id,
    userIds: memberIds,
    role: user.role,
    organizationId: user.organizationId,
    // Club-wide only when no business was chosen. Identical to the cards.
    isAdmin: !memberIds,
  };

  const blocks: (ReportBlock | null)[] = await Promise.all(
    known.map(async (key) => {
      const def = getReport(key);
      if (!def) return null;
      try {
        const res = await runReport({ reportKey: key, dateRange }, ctx);
        return {
          key,
          title: def.title,
          caption: "",
          // viz is a property of the report definition, not of the run result.
          viz: def.defaultViz,
          columns: res.columns,
          rows: res.rows,
        } as ReportBlock;
      } catch {
        // One failing metric should not lose the other eleven.
        return null;
      }
    })
  );

  return NextResponse.json({
    blocks: blocks.filter(Boolean),
    scopeName,
    from: dateRange.from,
    to: dateRange.to,
    skipped,
  });
}
