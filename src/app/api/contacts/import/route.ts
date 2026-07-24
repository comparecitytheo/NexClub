import { NextResponse } from "next/server";
import { ContactStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { parseCsv, pick } from "@/lib/csv";
import { recordAudit } from "@/server/audit";

const STATUSES = new Set(Object.values(ContactStatus));

function normaliseStatus(raw: string): ContactStatus {
  const up = raw.trim().toUpperCase();
  return STATUSES.has(up as ContactStatus) ? (up as ContactStatus) : ContactStatus.ACTIVE;
}

// Accepts raw CSV in the request body (text/csv). Each row becomes a contact
// owned by the current user. "Company" matches an existing company by name.
export async function POST(req: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  const text = await req.text();
  if (!text.trim()) return NextResponse.json({ error: "Empty file" }, { status: 400 });

  const rows = parseCsv(text);
  if (rows.length === 0) return NextResponse.json({ error: "No data rows found" }, { status: 400 });

  const companies = await prisma.company.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, name: true },
  });
  const byName = new Map(companies.map((c) => [c.name.trim().toLowerCase(), c.id]));

  const errors: Array<{ row: number; message: string }> = [];
  const toCreate: Prisma.ContactUncheckedCreateInput[] = [];

  rows.forEach((row, idx) => {
    const line = idx + 2;
    const firstName = pick(row, "First Name", "firstName");
    const lastName = pick(row, "Last Name", "lastName");
    if (!firstName || !lastName) {
      errors.push({ row: line, message: "Missing first or last name" });
      return;
    }

    const companyName = pick(row, "Company", "companyName");
    const companyId = companyName ? byName.get(companyName.trim().toLowerCase()) ?? null : null;
    const tagsRaw = pick(row, "Tags", "tags");

    toCreate.push({
      organizationId: user.organizationId,
      ownerId: user.id,
      companyId,
      firstName,
      lastName,
      email: pick(row, "Email", "email") || null,
      phone: pick(row, "Phone", "phone") || null,
      jobTitle: pick(row, "Job Title", "jobTitle") || null,
      status: normaliseStatus(pick(row, "Status", "status")),
      tags: tagsRaw ? tagsRaw.split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [],
      notes: pick(row, "Notes", "notes") || null,
    });
  });

  let created = 0;
  if (toCreate.length > 0) {
    await prisma.$transaction(toCreate.map((data) => prisma.contact.create({ data })));
    created = toCreate.length;
    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "CREATE",
      entityType: "Contact",
      after: { imported: created },
    });
  }

  return NextResponse.json({ created, skipped: errors.length, errors });
}
