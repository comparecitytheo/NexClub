// Consent for passing a lead's personal information to another member business.
//
// A lead is a third party who never signed up to NEX Club: they gave their
// details to one member, and sharing them with another member is a disclosure
// to a separate business. We therefore require the sending member to confirm
// they have that person's consent, and we record which wording they agreed to.
//
// The version is stored on the Lead alongside the timestamp so that, if the
// wording is ever revised, historical records still show exactly what was
// confirmed at the time. BUMP THE VERSION whenever CONSENT_STATEMENT changes.

export const CONSENT_STATEMENT_VERSION = "2026-07-v1";

export const CONSENT_STATEMENT =
  "I confirm I have this person's consent to pass their contact details and enquiry " +
  "to another NEX Club member, and that they understand who will receive it.";

// Shown under the checkbox — free-text notes are the most likely place for
// sensitive information (health, financial hardship), which needs consent of its own.
export const CONSENT_HINT =
  "Only include details this person agreed to share. Avoid health or financial-hardship specifics.";
