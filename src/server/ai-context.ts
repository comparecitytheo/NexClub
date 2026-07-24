import type { EntityType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import { ownerScope } from "@/server/scope";
import { formatCurrency, formatDate } from "@/lib/format";
import { buildRedaction, type Redaction } from "@/server/ai-redact";
import {
  LEAD_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
  DEAL_STAGE_LABELS,
  CONTACT_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
} from "@/lib/labels";

type SessionUser = { id: string; organizationId: string; role: UserRole };

// `context` is pseudonymised and safe to send to the AI provider. `name` is the
// real value and stays server-side. `restore` puts real values back into the
// model's reply before it reaches the user.
export type EntityContext = { name: string; kind: string; context: string; restore: Redaction["restore"] };

function joinLines(lines: Array<string | false | null | undefined>): string {
  return lines.filter(Boolean).join("\n");
}

export async function buildEntityContext(
  user: SessionUser,
  type: EntityType,
  id: string
): Promise<EntityContext | null> {
  const org = user.organizationId;
  const admin = isAdmin(user.role);

  if (type === "LEAD") {
    const lead = await prisma.lead.findFirst({
      where: { id, organizationId: org, ...(admin ? {} : { OR: [{ ownerId: user.id }, { referrerId: user.id }] }) },
      include: {
        owner: { select: { name: true } },
        referrer: { select: { name: true } },
        activityEntries: { orderBy: { occurredAt: "desc" }, take: 10, include: { user: { select: { name: true } } } },
      },
    });
    if (!lead) return null;
    const leadRedaction = buildRedaction([
      { token: "[CONTACT]", value: lead.contactName },
      { token: "[EMAIL]", value: lead.email },
      { token: "[PHONE]", value: lead.phone },
      { token: "[REFERRER]", value: lead.referrer.name },
      { token: "[OWNER]", value: lead.owner.name },
    ]);
    return {
      name: lead.contactName,
      kind: "lead",
      restore: leadRedaction.restore,
      context: leadRedaction.redact(joinLines([
        `Lead contact: ${lead.contactName}`,
        lead.company && `Company: ${lead.company}`,
        lead.industry && `Industry: ${lead.industry}`,
        lead.email && `Email: ${lead.email}`,
        lead.phone && `Phone: ${lead.phone}`,
        `Pipeline status: ${LEAD_STATUS_LABELS[lead.status]}`,
        `Source: ${LEAD_SOURCE_LABELS[lead.source]}`,
        lead.valueEstimate != null && `Estimated value: ${formatCurrency(Number(lead.valueEstimate))}`,
        `Referred by ${lead.referrer.name}, assigned to ${lead.owner.name}`,
        lead.followUpDate && `Follow-up date: ${formatDate(lead.followUpDate)}`,
        lead.notes && `Notes: ${lead.notes}`,
        lead.activityEntries.length > 0 &&
          `Recent activity:\n${lead.activityEntries.map((a) => `- [${ACTIVITY_TYPE_LABELS[a.type]}] ${a.subject} (${formatDate(a.occurredAt)})`).join("\n")}`,
      ])),
    };
  }

  if (type === "DEAL") {
    const deal = await prisma.deal.findFirst({
      where: { id, ...ownerScope(user) },
      include: {
        company: { select: { name: true, industry: true } },
        contact: { select: { firstName: true, lastName: true, jobTitle: true } },
        owner: { select: { name: true } },
        activityEntries: { orderBy: { occurredAt: "desc" }, take: 10 },
      },
    });
    if (!deal) return null;
    const dealRedaction = buildRedaction([
      { token: "[CONTACT]", value: deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : null },
      { token: "[CONTACT_FIRST]", value: deal.contact?.firstName },
      { token: "[CONTACT_LAST]", value: deal.contact?.lastName },
      { token: "[OWNER]", value: deal.owner?.name },
    ]);
    const ageDays = Math.floor((Date.now() - deal.createdAt.getTime()) / 86_400_000);
    return {
      name: deal.name,
      kind: "deal",
      restore: dealRedaction.restore,
      context: dealRedaction.redact(joinLines([
        `Deal: ${deal.name}`,
        deal.company && `Company: ${deal.company.name}${deal.company.industry ? ` (${deal.company.industry})` : ""}`,
        deal.contact && `Primary contact: ${deal.contact.firstName} ${deal.contact.lastName}${deal.contact.jobTitle ? `, ${deal.contact.jobTitle}` : ""}`,
        `Value: ${formatCurrency(Number(deal.value))}`,
        `Stage: ${DEAL_STAGE_LABELS[deal.stage]}`,
        `Win probability: ${deal.probability}%`,
        deal.expectedCloseDate && `Expected close: ${formatDate(deal.expectedCloseDate)}`,
        `Age: ${ageDays} day(s) in pipeline`,
        deal.owner && `Owner: ${deal.owner.name}`,
        deal.activityEntries.length > 0 &&
          `Recent activity:\n${deal.activityEntries.map((a) => `- [${ACTIVITY_TYPE_LABELS[a.type]}] ${a.subject} (${formatDate(a.occurredAt)})`).join("\n")}`,
      ])),
    };
  }

  if (type === "CONTACT") {
    const contact = await prisma.contact.findFirst({
      where: { id, ...ownerScope(user) },
      include: {
        company: { select: { name: true, industry: true } },
        deals: { select: { name: true, stage: true, value: true }, orderBy: { updatedAt: "desc" }, take: 5 },
        activityEntries: { orderBy: { occurredAt: "desc" }, take: 10 },
      },
    });
    if (!contact) return null;
    const contactRedaction = buildRedaction([
      { token: "[CONTACT]", value: `${contact.firstName} ${contact.lastName}` },
      { token: "[CONTACT_FIRST]", value: contact.firstName },
      { token: "[CONTACT_LAST]", value: contact.lastName },
      { token: "[EMAIL]", value: contact.email },
      { token: "[PHONE]", value: contact.phone },
    ]);
    return {
      name: `${contact.firstName} ${contact.lastName}`,
      kind: "contact",
      restore: contactRedaction.restore,
      context: contactRedaction.redact(joinLines([
        `Contact: ${contact.firstName} ${contact.lastName}`,
        contact.jobTitle && `Title: ${contact.jobTitle}`,
        contact.company && `Company: ${contact.company.name}${contact.company.industry ? ` (${contact.company.industry})` : ""}`,
        contact.email && `Email: ${contact.email}`,
        contact.phone && `Phone: ${contact.phone}`,
        `Status: ${CONTACT_STATUS_LABELS[contact.status]}`,
        contact.tags.length > 0 && `Tags: ${contact.tags.join(", ")}`,
        contact.notes && `Notes: ${contact.notes}`,
        contact.deals.length > 0 &&
          `Deals:\n${contact.deals.map((d) => `- ${d.name} — ${DEAL_STAGE_LABELS[d.stage]} (${formatCurrency(Number(d.value))})`).join("\n")}`,
        contact.activityEntries.length > 0 &&
          `Recent activity:\n${contact.activityEntries.map((a) => `- [${ACTIVITY_TYPE_LABELS[a.type]}] ${a.subject} (${formatDate(a.occurredAt)})`).join("\n")}`,
      ])),
    };
  }

  // COMPANY
  const company = await prisma.company.findFirst({
    where: { id, ...ownerScope(user) },
    include: {
      contacts: { select: { firstName: true, lastName: true, jobTitle: true }, take: 10 },
      deals: { select: { name: true, stage: true, value: true }, orderBy: { updatedAt: "desc" }, take: 5 },
    },
  });
  if (!company) return null;
  // A company name is business information, but the people listed under it are not.
  const companyRedaction = buildRedaction(
    company.contacts.map((c, i) => ({ token: `[CONTACT_${i + 1}]`, value: `${c.firstName} ${c.lastName}` }))
  );
  return {
    name: company.name,
    kind: "company",
    restore: companyRedaction.restore,
    context: companyRedaction.redact(joinLines([
      `Company: ${company.name}`,
      company.industry && `Industry: ${company.industry}`,
      company.website && `Website: ${company.website}`,
      company.employeeCount != null && `Employees: ${company.employeeCount}`,
      company.revenue != null && `Revenue: ${formatCurrency(Number(company.revenue))}`,
      company.notes && `Notes: ${company.notes}`,
      company.contacts.length > 0 &&
        `Contacts:\n${company.contacts.map((c) => `- ${c.firstName} ${c.lastName}${c.jobTitle ? `, ${c.jobTitle}` : ""}`).join("\n")}`,
      company.deals.length > 0 &&
        `Deals:\n${company.deals.map((d) => `- ${d.name} — ${DEAL_STAGE_LABELS[d.stage]} (${formatCurrency(Number(d.value))})`).join("\n")}`,
    ])),
  };
}
