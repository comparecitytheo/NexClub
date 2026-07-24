// ============================================================================
// INVITE A MEMBER — feature entry point / canonical field reference
// ----------------------------------------------------------------------------
// The five CANONICAL invite fields, propagated everywhere an invitation is
// referenced (Prisma `Invitation` model, validators, API contracts, admin form,
// preview modal, this email template, and the member record on acceptance):
//
//   1. businessName   — string, required
//   2. contactPerson  — string, required (business director / primary contact)
//   3. email          — string, required, RFC-5322 valid, unique per pending invite
//   4. mobileNumber   — string, required, E.164 (validated with libphonenumber-js)
//   5. industry       — one of INDUSTRIES (src/lib/industries.ts)
//
// If you add/rename a field, update: prisma/schema.prisma (Invitation),
// src/server/validators/invitation.ts, src/server/invitations.ts,
// src/components/admin/invite-member-dialog.tsx, the acceptance flow, and this
// template — keep the list above in sync.
// ============================================================================

export const INVITATION_FIELDS = ["businessName", "contactPerson", "email", "mobileNumber", "industry"] as const;
export type InvitationField = (typeof INVITATION_FIELDS)[number];

export type InvitationEmailData = {
  contactPerson: string;
  businessName: string;
  industry: string;
  acceptUrl: string;
  companyName: string;
};

// Pure template — no server-only imports, so the admin preview modal renders the
// exact same markup the recipient receives. Returns subject + full HTML.
export function renderInvitationEmail(data: InvitationEmailData): { subject: string; html: string } {
  const { contactPerson, businessName, industry, acceptUrl, companyName } = data;
  const subject = `You're invited to join ${companyName}`;
  const safe = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const origin = (() => {
    try {
      return new URL(acceptUrl).origin;
    } catch {
      return "";
    }
  })();
  // Served from /public and referenced ONLY by this invitation email.
  const logoUrl = `${origin}/email-logo-invitation.png`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <style>
      /* The logo is white and sits on the fixed maroon brand header, so it stays
         legible in light AND dark mode across clients (this does not rely on
         prefers-color-scheme, which some clients such as Gmail ignore). These
         rules additionally lock the header colour for clients that auto-shift
         colours in dark mode (Apple Mail / iOS Mail, Outlook.com). */
      @media (prefers-color-scheme: dark) {
        .nex-invite-header { background-color: #7B1E3A !important; }
      }
      [data-ogsc] .nex-invite-header { background-color: #7B1E3A !important; }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e6e6e8;border-radius:14px;overflow:hidden;">
            <tr>
              <td class="nex-invite-header" bgcolor="#7B1E3A" style="background-color:#7B1E3A;padding:24px 28px;">
                <img src="${logoUrl}" width="140" height="81" alt="${safe(companyName)}" style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;height:81px;width:140px;max-width:140px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 14px;font-size:20px;font-weight:700;">Hi ${safe(contactPerson)},</h1>
                <p style="margin:0 0 14px;font-size:14px;line-height:1.55;">
                  You've been invited to join <strong>${safe(companyName)}</strong> on behalf of
                  <strong>${safe(businessName)}</strong> (${safe(industry)}).
                </p>
                <p style="margin:0 0 22px;font-size:14px;line-height:1.55;">
                  Follow the link below to <strong>set your password and activate your account</strong>.
                  This is a single-use link tied to your invitation.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                  <tr>
                    <td style="border-radius:8px;background:#7B1E3A;">
                      <a href="${acceptUrl}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Set your password</a>
                    </td>
                  </tr>
                </table>
                <hr style="border:none;border-top:1px solid #e6e6e8;margin:0 0 16px;" />
                <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
                  You're receiving this because ${safe(businessName)} was invited to ${safe(companyName)}.
                  If you weren't expecting this, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}
