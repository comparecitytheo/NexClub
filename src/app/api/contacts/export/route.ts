import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { isSuperAdmin } from "@/lib/rbac";
import { ownerScope } from "@/server/scope";
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

  // Same rule as the leads export: bulk CSV download is Super Admin only.
  if (!isSuperAdmin(user.role)) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const rl = rateLimit(`export-contacts:${user.id}`, 5, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many exports. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const found = await prisma.contact.findMany({
    where: ownerScope(user),
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT_ROWS + 1,
    include: { company: { select: { name: true } } },
  });
  const truncated = found.length > MAX_EXPORT_ROWS;
  const contacts = truncated ? found.slice(0, MAX_EXPORT_ROWS) : found;

  const headerList = await headers();
  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "EXPORT",
    entityType: "Contact",
    after: { rows: contacts.length, truncated },
    ipAddress: headerList.get("x-forwarded-for"),
    userAgent: headerList.get("user-agent"),
  });

  const csvHeaders = ["First Name", "Last Name", "Email", "Phone", "Job Title", "Company", "Status", "Tags", "Notes"];
  const rows = contacts.map((c) => [
    c.firstName, c.lastName, c.email ?? "", c.phone ?? "", c.jobTitle ?? "",
    c.company?.name ?? "", c.status, (c.tags ?? []).join("; "), c.notes ?? "",
  ]);

  return new NextResponse(toCsv(csvHeaders, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
      "X-Export-Truncated": String(truncated),
    },
  });
}
