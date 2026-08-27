import bcrypt from "bcryptjs";
import type { Invitation, UserRole } from "@prisma/client";
import { parsePhoneNumber } from "libphonenumber-js";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/tokens";
import { renderInvitationEmail } from "@/lib/emails/invitation";
import { resolveOrCreateIndustry } from "@/server/industries";
import { resolveBusiness } from "@/server/businesses";
import { DEFAULT_PHONE_REGION, type CreateInvitationInput } from "@/server/validators/invitation";

// Invitations expire after this many days. Configurable via env; sensible default.
export const INVITATION_TTL_DAYS = Math.max(1, Number(process.env.INVITATION_TTL_DAYS ?? 7));

export function invitationExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function acceptUrl(base: string, rawToken: string): string {
  return `${base.replace(/\/$/, "")}/invitations/accept?token=${encodeURIComponent(rawToken)}`;
}

// Store phone numbers normalised to E.164 (already validated by the schema).
// Falls back to the home region so a locally-formatted number still stores as E.164.
export function normaliseMobile(v: string): string {
  try {
    return parsePhoneNumber(v).number;
  } catch {
    /* not international; try the home region below */
  }
  try {
    return parsePhoneNumber(v, DEFAULT_PHONE_REGION).number;
  } catch {
    return v;
  }
}

// Public payload for preview / acceptance lookup — never exposes the token hash.
export function mapInvitation(i: Invitation) {
  return {
    id: i.id,
    businessName: i.businessName,
    contactPerson: i.contactPerson,
    email: i.email,
    mobileNumber: i.mobileNumber,
    industry: i.industry,
    role: i.role,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
    expiresAt: i.expiresAt.toISOString(),
  };
}

// Create + persist an invitation. Returns the raw token (for the link) and the
// rendered email so the caller can send it. Kept send-free so it's unit-testable.
// The industry is resolved (and created if new) first, so a brand-new industry is
// available system-wide immediately, and the invite stores the canonical name.
export async function createInvitation(
  input: CreateInvitationInput & {
    organizationId: string;
    invitedById: string;
    base: string;
    companyName: string;
    role: UserRole;
    businessName: string;
  }
) {
  const industry = await resolveOrCreateIndustry(input.industry);
  const rawToken = generateToken();
  const invitation = await prisma.invitation.create({
    data: {
      organizationId: input.organizationId,
      invitedById: input.invitedById,
      businessName: input.businessName,
      contactPerson: input.contactPerson,
      email: input.email.toLowerCase(),
      mobileNumber: normaliseMobile(input.mobileNumber),
      industry,
      role: input.role,
      tokenHash: hashToken(rawToken),
      expiresAt: invitationExpiry(),
    },
  });
  const url = acceptUrl(input.base, rawToken);
  const email = renderInvitationEmail({
    contactPerson: invitation.contactPerson,
    businessName: invitation.businessName,
    industry: invitation.industry,
    acceptUrl: url,
    companyName: input.companyName,
  });
  return { invitation, rawToken, acceptUrl: url, email };
}

// Resend: rotate the token, reset the clock, and re-render the email to send.
export async function refreshInvitationToken(id: string, base: string, companyName: string) {
  const rawToken = generateToken();
  const invitation = await prisma.invitation.update({
    where: { id },
    data: { tokenHash: hashToken(rawToken), status: "PENDING", expiresAt: invitationExpiry() },
  });
  const url = acceptUrl(base, rawToken);
  const email = renderInvitationEmail({
    contactPerson: invitation.contactPerson,
    businessName: invitation.businessName,
    industry: invitation.industry,
    acceptUrl: url,
    companyName,
  });
  return { invitation, rawToken, acceptUrl: url, email };
}

// Look up a PENDING invite by raw token; flips it to EXPIRED if past expiry.
export async function findAcceptableInvitation(rawToken: string): Promise<Invitation | { expired: true } | null> {
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!invitation || invitation.status !== "PENDING") return null;
  if (invitation.expiresAt.getTime() < Date.now()) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
    return { expired: true };
  }
  return invitation;
}

export type AcceptResult =
  | { ok: true; user: { id: string; email: string; name: string }; invitation: Invitation }
  | { ok: false; reason: "invalid" | "expired" | "exists" };

// Complete acceptance: create the member carrying ALL FIVE canonical fields and
// mark the invite ACCEPTED (single-use). Caller resolves the role.
export async function acceptInvitation(input: { rawToken: string; password: string; role: UserRole }): Promise<AcceptResult> {
  const found = await findAcceptableInvitation(input.rawToken);
  if (found === null) return { ok: false, reason: "invalid" };
  if ("expired" in found) return { ok: false, reason: "expired" };
  const invitation = found;

  const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existing) return { ok: false, reason: "exists" };

  const hashedPassword = await bcrypt.hash(input.password, 10);

  // Link the new member to the real business row, creating it if this is the
  // first person in it. Matched case-insensitively, so a differently-capitalised
  // invite joins the existing business rather than forking a duplicate.
  const business = await resolveBusiness(invitation.organizationId, invitation.businessName);

  const user = await prisma.user.create({
    data: {
      organizationId: invitation.organizationId,
      name: invitation.contactPerson, // contactPerson -> member name
      email: invitation.email, // email
      businessId: business?.id ?? null, // authority on membership
      businessName: business?.name ?? invitation.businessName, // display mirror
      phone: invitation.mobileNumber, // mobileNumber -> phone
      industry: invitation.industry, // industry
      hashedPassword,
      role: input.role,
    },
    select: { id: true, email: true, name: true },
  });

  const updated = await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedUserId: user.id },
  });

  return { ok: true, user, invitation: updated };
}
