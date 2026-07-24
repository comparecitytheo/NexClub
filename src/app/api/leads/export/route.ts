import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { isAdmin } from "@/lib/rbac";
import { recordAudit } from "@/server/audit";
import { rateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";

// Bulk export hands a whole book of personal information to a single click, so
// it is rate limited, capped, and always written to the audit trail (APP 11.1).
const MAX_EXPORT_ROWS = 10_000;

export async function GET() {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const admin = isAdmin(user.role);

  const rl = rateLimit(`export-leads:${user.id}`, 5, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many exports. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const found = await prisma.lead.findMany({
    where: { organizationId: user.organizationId, ...(admin ? {} : { OR: [{ ownerId: user.id }, { referrerId: user.id }] }) },
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT_ROWS + 1,
    include: { owner: { select: { name: true } }, referrer: { select: { name: true } } },
  });
  const truncated = found.length > MAX_EXPORT_ROWS;
  const leads = truncated ? found.slice(0, MAX_EXPORT_ROWS) : found;

  const headerList = await headers();
  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "EXPORT",
    entityType: "Lead",
    after: { rows: leads.length, scope: admin ? "organisation" : "own", truncated },
    ipAddress: headerList.get("x-forwarded-for"),
    userAgent: headerList.get("user-agent"),
  });

  const csvHeaders = [
    "Contact Name", "Company", "Email", "Phone", "Industry", "Value Estimate",
    "Status", "Source", "Referred By", "Assigned To", "Date Received", "Follow Up Date",
  ];
  const rows = leads.map((l) => [
    l.contactName, l.company ?? "", l.email ?? "", l.phone ?? "", l.industry ?? "",
    l.valueEstimate ? Number(l.valueEstimate) : "", l.status, l.source,
    l.referrer.name, l.owner.name,
    l.dateReceived.toISOString().slice(0, 10),
    l.followUpDate ? l.followUpDate.toISOString().slice(0, 10) : "",
  ]);

  return new NextResponse(toCsv(csvHeaders, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      // Surfaced so a truncated export is never mistaken for a complete one.
      "X-Export-Truncated": String(truncated),
    },
  });
}
