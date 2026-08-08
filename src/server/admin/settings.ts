import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

// CRM-wide configuration, stored as JSON on Organization.settings and edited only
// by a Super Admin. Values are consumed at their real call sites (see below), so
// changing them here takes effect rather than being cosmetic:
//   - defaultSignupRole -> role assigned to open self-registrations (register route)
//   - security.passwordMinLength -> enforced when a password is set (reset-password route)
//   - smtp.* -> used by the mailer (src/lib/email.ts), password still from env
//   - features.* -> gates module nav + can gate module routes (requireFeature)
// Anything not listed as wired is stored + surfaced but noted in the summary.

// New self-registrations may only default to a non-privileged tier; ADMIN /
// SUPER_ADMIN are never handed out automatically.
export type SignupRole = "MANAGER" | "SALES_REP" | "SUPPORT_AGENT";
export type FeatureKey = "leads" | "deals" | "contacts" | "companies" | "tasks" | "events";
export const FEATURE_KEYS: FeatureKey[] = ["leads", "deals", "contacts", "companies", "tasks", "events"];
export const SIGNUP_ROLES: SignupRole[] = ["MANAGER", "SALES_REP", "SUPPORT_AGENT"];

export type OrgSettings = {
  branding: { companyName: string; supportEmail: string };
  defaultSignupRole: SignupRole;
  security: { passwordMinLength: number; sessionTimeoutMinutes: number };
  smtp: { host: string; port: number; user: string; from: string }; // SMTP password stays in env, never in the DB
  features: Record<FeatureKey, boolean>;
};

export function defaultSettings(): OrgSettings {
  return {
    branding: { companyName: env.DEFAULT_ORG_NAME ?? "NEX Club", supportEmail: env.EMAIL_FROM ?? "" },
    defaultSignupRole: "SALES_REP",
    security: { passwordMinLength: 8, sessionTimeoutMinutes: 60 * 24 * 30 },
    smtp: {
      host: env.EMAIL_SERVER_HOST ?? "",
      port: Number(env.EMAIL_SERVER_PORT ?? 587),
      user: env.EMAIL_SERVER_USER ?? "",
      from: env.EMAIL_FROM ?? "",
    },
    features: { leads: true, deals: true, contacts: true, companies: true, tasks: true, events: true },
  };
}

// Merge a stored (possibly partial / legacy) settings blob over the defaults so
// older orgs and newly-added fields both resolve to a complete, typed object.
export function mergeSettings(raw: unknown): OrgSettings {
  const d = defaultSettings();
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<OrgSettings>;
  return {
    branding: { ...d.branding, ...(s.branding ?? {}) },
    defaultSignupRole: SIGNUP_ROLES.includes(s.defaultSignupRole as SignupRole)
      ? (s.defaultSignupRole as SignupRole)
      : d.defaultSignupRole,
    security: { ...d.security, ...(s.security ?? {}) },
    smtp: { ...d.smtp, ...(s.smtp ?? {}) },
    features: { ...d.features, ...(s.features ?? {}) },
  };
}

export async function getOrgSettings(organizationId: string): Promise<OrgSettings> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: { settings: true },
  });
  return mergeSettings(org?.settings ?? null);
}

export async function saveOrgSettings(organizationId: string, next: OrgSettings): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { settings: next as unknown as Prisma.InputJsonValue },
  });
}

export function featureEnabled(settings: OrgSettings, key: FeatureKey): boolean {
  return settings.features[key] !== false;
}

// The canonical enum role written for a signup default.
export function signupRoleToUserRole(role: SignupRole): UserRole {
  return role as UserRole;
}
