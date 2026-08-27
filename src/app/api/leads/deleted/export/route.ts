import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";
import { rateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { LEAD_STATUS_LABELS } from "@/lib/labels";

export const runtime = "nodejs";

// CSV of every deleted lead in the club. Super Admin only, enforced server-side.
// This is the retention export: there is no separate archive screen any more, so
// this is the one way to get the full record out. Exported whole rather than
// capped, but still rate limited and audited like the other bulk exports.
export async function GET() {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;

  const rl = rateLimit(`export-archive:${user.id}`, 5, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many exports. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const rows = await prisma.lead.findMany({
    // Matches the archive page: every deleted lead, archived or not. A CSV that
    // silently omitted this month's deletions would be a misleading record.
    where: {
      organizationId: user.organizationId,
      status: "DELETED",
      archivedAt: undefined,
    },
    orderBy: [{ deletedOn: "desc" }, { archivedAt: "desc" }],
    select: {
      contactName: true, company: true, email: true, phone: true, industry: true,
      valueEstimate: true, source: true, statusBeforeDelete: true,
      deletedOn: true, archivedAt: true, dateReceived: true,
      deletedBy: { select: { name: true } },
      owner: { select: { name: true } },
      referrer: { select: { name: true } },
    },
  });

  const headerList = await headers();
  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "EXPORT",
    entityType: "Lead",
    after: { rows: rows.length, scope: "archive" },
    ipAddress: headerList.get("x-forwarded-for"),
    userAgent: headerList.get("user-agent"),
  });

  const csvHeaders = [
    "Contact Name", "Company", "Email", "Phone", "Industry", "Value Estimate",
    "Source", "Original Status", "Referred By", "Assigned To",
    "Date Received", "Date Deleted", "Deleted By", "Date Archived",
  ];
  const data = rows.map((l) => [
    l.contactName, l.company ?? "", l.email ?? "", l.phone ?? "", l.industry ?? "",
    l.valueEstimate ? Number(l.valueEstimate) : "",
    l.source,
    l.statusBeforeDelete ? LEAD_STATUS_LABELS[l.statusBeforeDelete] : "",
    l.referrer.name, l.owner.name,
    l.dateReceived.toISOString().slice(0, 10),
    l.deletedOn ? l.deletedOn.toISOString().slice(0, 10) : "",
    l.deletedBy?.name ?? "",
    l.archivedAt ? l.archivedAt.toISOString().slice(0, 10) : "",
  ]);

  return new NextResponse(toCsv(csvHeaders, data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="deleted-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
