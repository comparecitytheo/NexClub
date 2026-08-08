import { NextResponse } from "next/server";
import { LeadSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CONSENT_STATEMENT_VERSION } from "@/lib/consent";
import { notify } from "@/server/notify";
import { requireUserForWrite } from "@/server/api-helpers";
import { parseCsv, pick } from "@/lib/csv";
import { recordAudit } from "@/server/audit";

const SOURCES = new Set(Object.values(LeadSource));

function normaliseSource(raw: string): LeadSource {
  const up = raw.trim().toUpperCase().replaceAll(" ", "_");
  return SOURCES.has(up as LeadSource) ? (up as LeadSource) : LeadSource.REFERRAL;
}

// Parse import dates as DD/MM/YYYY (Australian) first, then fall back to native
// parsing (ISO etc.). Returns null for anything unrecognised.
function parseImportDate(raw: string): Date | null {
  const t = raw.trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Accepts raw CSV in the request body (text/csv). Each row becomes a lead the
// current user refers. "Assigned To Email" picks the recipient; if omitted or
// unknown, the importer keeps the lead for the current user.
export async function POST(req: Request) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

  // Bulk import is the highest-risk collection path: many third parties at once,
  // with no per-row provenance. Require the same explicit confirmation the
  // single-lead form requires (APP 6), sent as a header alongside the CSV body.
  if (req.headers.get("x-consent-confirmed") !== CONSENT_STATEMENT_VERSION) {
    return NextResponse.json(
      { error: "Confirm you have consent to share these contacts before importing." },
      { status: 400 }
    );
  }

  const text = await req.text();
  if (!text.trim()) return NextResponse.json({ error: "Empty file" }, { status: 400 });

  const rows = parseCsv(text);
  if (rows.length === 0) return NextResponse.json({ error: "No data rows found" }, { status: 400 });

  const members = await prisma.user.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    select: { id: true, email: true },
  });
  const byEmail = new Map(members.map((m) => [m.email.toLowerCase(), m.id]));

  const errors: Array<{ row: number; message: string }> = [];
  const toCreate: Prisma.LeadUncheckedCreateInput[] = [];

  rows.forEach((row, idx) => {
    const line = idx + 2; // header is line 1
    const contactName = pick(row, "Contact Name", "contactName", "Name");
    if (!contactName) {
      errors.push({ row: line, message: "Missing contact name" });
      return;
    }

    const recipientEmail = pick(row, "Assigned To Email", "ownerEmail", "Assigned To").toLowerCase();
    let ownerId = user.id;
    if (recipientEmail) {
      const match = byEmail.get(recipientEmail);
      if (!match) {
        errors.push({ row: line, message: `Unknown recipient: ${recipientEmail}` });
        return;
      }
      ownerId = match;
    }

    const valueRaw = pick(row, "Value Estimate", "valueEstimate", "Value");
    const value = valueRaw ? Number(valueRaw.replace(/[^0-9.]/g, "")) : null;
    const followRaw = pick(row, "Follow Up Date", "followUpDate");
    const follow = followRaw ? parseImportDate(followRaw) : null;

    toCreate.push({
      consentConfirmedAt: new Date(),
      consentStatementVersion: CONSENT_STATEMENT_VERSION,
      organizationId: user.organizationId,
      referrerId: user.id,
      ownerId,
      contactName,
      company: pick(row, "Company", "company") || null,
      email: pick(row, "Email", "email") || null,
      phone: pick(row, "Phone", "phone") || null,
      industry: pick(row, "Industry", "industry") || null,
      valueEstimate: value !== null && !Number.isNaN(value) ? value : null,
      source: normaliseSource(pick(row, "Source", "source")),
      status: "NEW",
      followUpDate: follow,
    });
  });

  let created = 0;
  if (toCreate.length > 0) {
    try {
      await prisma.$transaction(toCreate.map((data) => prisma.lead.create({ data })));
    } catch (e) {
      console.error("Lead import failed", e);
      return NextResponse.json(
        { error: "No leads were saved — some rows were rejected by the database. Fix the file and try again.", skipped: errors.length, errors },
        { status: 422 }
      );
    }
    created = toCreate.length;

    // Notify each recipient (other than the importer) of the leads now assigned to them.
    const counts = new Map<string, number>();
    for (const l of toCreate) {
      if (l.ownerId !== user.id) counts.set(l.ownerId, (counts.get(l.ownerId) ?? 0) + 1);
    }
    if (counts.size > 0) {
      for (const [recipientId, n] of counts) {
        await notify({
          organizationId: user.organizationId,
          recipientIds: [recipientId],
          actorId: user.id,
          type: "LEAD_ASSIGNED",
          title: "New leads received",
          body: `${user.name} imported ${n} lead${n > 1 ? "s" : ""} assigned to you.`,
          entityType: "LEAD",
          email: { actorName: user.name, count: n },
        });
      }
    }

    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "CREATE",
      entityType: "Lead",
      after: { imported: created },
    });
  }

  return NextResponse.json({ created, skipped: errors.length, errors });
}
