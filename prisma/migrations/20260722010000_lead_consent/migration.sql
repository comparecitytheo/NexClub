-- Backwards-compatible: adds two nullable columns to `leads` recording the
-- sender's confirmation that the lead consented to their details being passed to
-- another member business (Australian Privacy Principle 6). Existing rows keep
-- NULL, which correctly reads as "no consent was recorded for this lead".
-- Apply with `npx prisma migrate deploy` or `npx prisma db push`.

ALTER TABLE "leads" ADD COLUMN "consentConfirmedAt" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN "consentStatementVersion" TEXT;
