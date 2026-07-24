import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { isAdmin } from "@/lib/rbac";
import { convertLeadSchema } from "@/server/validators/lead";
import { recordAudit } from "@/server/audit";

type Params = { params: Promise<{ id: string }> };

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  const firstName = parts[0] ?? full;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return { firstName, lastName };
}

// Convert a worked lead into a Contact, Company, and Deal. Recipient or admin only.
export async function POST(req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: user.organizationId, ...(isAdmin(user.role) ? {} : { ownerId: user.id }) },
  });
  if (!lead) return NextResponse.json({ error: "You can only convert leads assigned to you." }, { status: 403 });
  if (lead.convertedAt) return NextResponse.json({ error: "This lead has already been converted." }, { status: 400 });

  const parsed = convertLeadSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { createContact, createCompany, createDeal, dealValue } = parsed.data;

  const ownerId = lead.ownerId;
  const orgId = lead.organizationId;
  const value = dealValue ?? (lead.valueEstimate ? Number(lead.valueEstimate) : 0);

  const result = await prisma.$transaction(async (tx) => {
    let companyId: string | null = null;
    if (createCompany && lead.company) {
      const company = await tx.company.create({
        data: { organizationId: orgId, ownerId, name: lead.company, industry: lead.industry ?? null },
      });
      companyId = company.id;
    }

    let contactId: string | null = null;
    if (createContact) {
      const { firstName, lastName } = splitName(lead.contactName);
      const contact = await tx.contact.create({
        data: {
          organizationId: orgId,
          ownerId,
          companyId,
          firstName,
          lastName,
          email: lead.email ?? null,
          phone: lead.phone ?? null,
          status: "CUSTOMER",
        },
      });
      contactId = contact.id;
    }

    let dealId: string | null = null;
    if (createDeal) {
      const deal = await tx.deal.create({
        data: {
          organizationId: orgId,
          ownerId,
          companyId,
          contactId,
          leadId: lead.id,
          name: lead.company ? `${lead.company} — ${lead.contactName}` : lead.contactName,
          value,
          stage: "PROSPECTING",
          probability: 10,
        },
      });
      dealId = deal.id;
    }

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        status: "CLOSED_WON",
        convertedAt: new Date(),
        convertedContactId: contactId,
        convertedCompanyId: companyId,
        convertedDealId: dealId,
        lastActivityAt: new Date(),
      },
    });

    await tx.activity.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        type: "NOTE",
        subject: "Lead converted to deal",
        entityType: "LEAD",
        leadId: lead.id,
      },
    });

    return { companyId, contactId, dealId };
  });

  await recordAudit({ organizationId: orgId, actorId: user.id, action: "UPDATE", entityType: "Lead", entityId: id, after: { converted: true, ...result } });
  return NextResponse.json({ ok: true, ...result }, { status: 201 });
}
