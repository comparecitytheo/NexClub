import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type EntityFk = "leadId" | "contactId" | "companyId" | "dealId";

export function entityFkField(type: EntityType): EntityFk {
  switch (type) {
    case "LEAD": return "leadId";
    case "CONTACT": return "contactId";
    case "COMPANY": return "companyId";
    case "DEAL": return "dealId";
  }
}

// Build the FK fragment to link an activity/task to its parent entity.
export function entityLink(type: EntityType, id: string): Record<EntityFk, string> {
  return { [entityFkField(type)]: id } as Record<EntityFk, string>;
}

export async function entityExistsInOrg(type: EntityType, id: string, organizationId: string): Promise<boolean> {
  const where = { id, organizationId };
  switch (type) {
    case "LEAD": return Boolean(await prisma.lead.findFirst({ where, select: { id: true } }));
    case "CONTACT": return Boolean(await prisma.contact.findFirst({ where, select: { id: true } }));
    case "COMPANY": return Boolean(await prisma.company.findFirst({ where, select: { id: true } }));
    case "DEAL": return Boolean(await prisma.deal.findFirst({ where, select: { id: true } }));
  }
}
