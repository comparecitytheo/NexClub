import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { strongPassword } from "@/server/validators/auth";

// Home country used to interpret locally-formatted phone numbers (e.g. an
// Australian "0412 345 678"). International numbers with a leading + are
// accepted regardless of this.
export const DEFAULT_PHONE_REGION = "AU" as const;

// Canonical invite schema. Keep in sync with src/lib/emails/invitation.ts and
// the Invitation model. Server is the source of truth; the admin form uses the
// same schema client-side via @hookform/resolvers.
export const createInvitationSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(200),
  contactPerson: z.string().trim().min(1, "Contact person is required").max(200),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  // Accept a local Australian mobile (0412 345 678) or any international
  // number (+61412345678). Stored normalised to E.164 (see normaliseMobile).
  mobileNumber: z
    .string()
    .trim()
    .min(1, "Mobile number is required")
    .refine((v) => {
      try {
        return isValidPhoneNumber(v) || isValidPhoneNumber(v, DEFAULT_PHONE_REGION);
      } catch {
        return false;
      }
    }, "Enter a valid mobile, e.g. 0412 345 678 or +61412345678"),
  // Industry is a name from the shared industries list, OR a new name the admin
  // typed via "Add new industry". The server resolves/creates it (case-insensitive)
  // against the industries table, so any non-empty value is accepted here.
  industry: z.string().trim().min(1, "Select or enter an industry").max(100),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Missing invitation token"),
  password: strongPassword,
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
