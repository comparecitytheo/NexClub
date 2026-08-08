import { prisma } from "@/lib/prisma";
import { requireSuperAdminPage } from "@/server/admin/guard";
import { registerAllReports, runReport } from "@/server/reports";
import { resolveDateRange, readRangeParams } from "@/lib/date-range";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { ClubReport, MemberPicker, type ReportBlock } from "@/components/admin/club-report";

// REPORTING — Super Admin only.
//
// Deliberately small: four headline numbers, then two breakdowns. The full
// report builder lives elsewhere; this page answers "how are we doing?" at a
// glance, for the club or for one member.
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSuperAdminPage();
  registerAllReports();

  const sp = await searchParams;
  const rangeParams = readRangeParams(sp);
  const { from, to } = resolveDateRange(rangeParams);
  const dateRange = { from: from.toISOString(), to: to.toISOString() };

  const members = await prisma.user.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    // Order by the related business so members of one business stay together.
    orderBy: [{ business: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true, name: true, role: true,
      businessId: true,
      business: { select: { name: true } },
    },
  });

  // Group by the business RELATION, matching the directory and the staff list.
  // This used to group on the typed name — the last place still reading the
  // display mirror, and so the one place that could disagree with everything
  // else. Someone with no business stands alone. The DIRECTOR is that business's
  // highest-ranking member, which is who the club deals with.
  const RANK: Record<string, number> = {
    SUPER_ADMIN: 5, ADMIN: 4, MANAGER: 3, SALES_REP: 2, SUPPORT_AGENT: 1,
  };
  const groups = new Map<string, { key: string; name: string; director: string; memberIds: string[] }>();
  for (const m of members) {
    const key = m.businessId ? `b:${m.businessId}` : `m:${m.id}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        key,
        name: m.business?.name ?? m.name,
        director: m.name,
        memberIds: [m.id],
      });
      continue;
    }
    g.memberIds.push(m.id);
    // Whoever outranks the current pick becomes the director.
    const current = members.find((x) => x.name === g.director);
    if ((RANK[m.role] ?? 0) > (RANK[current?.role ?? ""] ?? 0)) g.director = m.name;
  }
  const businesses = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));

  const scopeParam = typeof sp.member === "string" ? sp.member : "all";
  const selected = businesses.find((b) => b.key === scopeParam) ?? null;

  // Scoping to one member reuses the engine's own "self" path: passing their id
  // with isAdmin false makes every data source narrow to their rows, exactly as
  // it would for them. No second set of scoping rules to keep in step.
  // Scoping to a business covers every member of it, not just the director —
  // otherwise a two-person business would report only half its work.
  const ctx = {
    userId: selected ? selected.memberIds[0] : user.id,
    userIds: selected ? selected.memberIds : undefined,
    role: user.role,
    organizationId: user.organizationId,
    isAdmin: !selected,
  };

  async function run(key: string) {
    try {
      return await runReport({ reportKey: key, dateRange }, ctx);
    } catch {
      return null;
    }
  }

  const who = selected?.name ?? null;

  // Six blocks: the questions a club owner actually asks. Captions change with
  // the scope, since "who is feeding the club" is meaningless for one person.
  const wanted: { key: string; title: string; caption: string; viz: ReportBlock["viz"] }[] = who
    ? [
        { key: "revenue.by_member", title: "Revenue", caption: `Closed revenue credited to ${who}.`, viz: "bar" },
        { key: "referral.sent", title: "Referrals sent", caption: `Leads ${who} referred out.`, viz: "bar" },
        { key: "referral.received", title: "Referrals received", caption: `Leads sent to ${who}.`, viz: "bar" },
        { key: "revenue.by_industry", title: "Revenue by industry", caption: "Which industries their revenue comes from.", viz: "bar" },
        { key: "revenue.by_month", title: "Revenue by month", caption: "Are they growing?", viz: "line" },
        { key: "referral.status", title: "Referral outcomes", caption: `Where ${who}'s referrals end up.`, viz: "table" },
      ]
    : [
        { key: "revenue.by_member", title: "Revenue by member", caption: "Who is converting referrals into money.", viz: "bar" },
        { key: "referral.sent", title: "Referrals sent", caption: "Who is feeding the club.", viz: "bar" },
        { key: "referral.received", title: "Referrals received", caption: "Who the club is feeding.", viz: "bar" },
        { key: "revenue.by_industry", title: "Revenue by industry", caption: "Which industries the money comes from.", viz: "bar" },
        { key: "revenue.by_month", title: "Revenue by month", caption: "Is the club growing?", viz: "line" },
        { key: "referral.status", title: "Referral outcomes", caption: "Where referrals end up.", viz: "table" },
      ];

  const blocks: ReportBlock[] = await Promise.all(
    wanted.map(async (w) => {
      const result = await run(w.key);
      return { ...w, columns: result?.columns ?? [], rows: result?.rows ?? [] };
    })
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Reporting</h2>
          <p className="text-sm text-muted-foreground">
            {who ? `Everything ${who} has sent, received and closed.` : "How the club is performing as a whole."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MemberPicker businesses={businesses} value={selected ? selected.key : "all"} />
          <DateRangePicker {...rangeParams} />
        </div>
      </div>
      <ClubReport blocks={blocks} />
    </div>
  );
}
