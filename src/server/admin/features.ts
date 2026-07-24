import { redirect } from "next/navigation";
import { getOrgSettings, type FeatureKey } from "@/server/admin/settings";

// Server guard for a CRM module page. The nav already hides disabled modules;
// call this in a module's page/layout to also block direct navigation. Example:
//   await requireFeature(session.user.organizationId, "events");
export async function requireFeature(organizationId: string, key: FeatureKey): Promise<void> {
  const settings = await getOrgSettings(organizationId);
  if (!settings.features[key]) redirect("/dashboard");
}
