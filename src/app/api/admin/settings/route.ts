import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { isStorageConfigured } from "@/lib/storage";
import { isEmailConfigured } from "@/lib/email";
import { requireSuperAdmin } from "@/server/api-helpers";
import { getClientContext } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { getOrgSettings, saveOrgSettings, mergeSettings, defaultSettings } from "@/server/admin/settings";
import { updateSettingsSchema } from "@/server/validators/admin";

// Integration/secret status is derived from env — booleans only, never the
// secret values themselves. Secrets (API keys) stay in the environment and
// are surfaced masked + read-only in the UI.
function integrationStatus() {
  return {
    email: isEmailConfigured(),
    ai: Boolean(env.ANTHROPIC_API_KEY),
    storage: isStorageConfigured(),
  };
}

export async function GET() {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const settings = await getOrgSettings(a.user.organizationId);
  return NextResponse.json({ settings, integrations: integrationStatus() });
}

export async function PATCH(req: Request) {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;
  const ctx = getClientContext(req);

  const parsed = updateSettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const before = await getOrgSettings(user.organizationId);
  const next = mergeSettings(parsed.data);
  await saveOrgSettings(user.organizationId, next);

  if (next.branding.companyName && next.branding.companyName !== before.branding.companyName) {
    await prisma.organization.update({ where: { id: user.organizationId }, data: { name: next.branding.companyName } });
  }

  await recordAudit({
    organizationId: user.organizationId, actorId: user.id, action: "UPDATE", entityType: "OrganizationSettings",
    entityId: user.organizationId, before, after: next, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent,
  });

  return NextResponse.json({ settings: next, integrations: integrationStatus() });
}

// Reset all CRM settings back to their defaults (also audited).
export async function DELETE(req: Request) {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;
  const ctx = getClientContext(req);

  const before = await getOrgSettings(user.organizationId);
  const next = defaultSettings();
  await saveOrgSettings(user.organizationId, next);

  await recordAudit({
    organizationId: user.organizationId, actorId: user.id, action: "UPDATE", entityType: "OrganizationSettings",
    entityId: user.organizationId, before, after: { reset: true, ...next }, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent,
  });

  return NextResponse.json({ settings: next, integrations: integrationStatus() });
}
