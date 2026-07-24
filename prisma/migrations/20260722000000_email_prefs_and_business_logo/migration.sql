-- Backwards-compatible: adds two nullable/defaulted columns to `users`. No existing
-- rows are modified beyond the defaulted boolean. Apply with
-- `npx prisma migrate deploy` or `npx prisma db push`.

-- Mirrors in-app notifications to email. Defaults on, so existing members keep
-- receiving notifications exactly as before until they opt out.
ALTER TABLE "users" ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Logo for the member's business, shown on their business card in the member
-- directory. Nullable: members without a logo fall back to no logo.
ALTER TABLE "users" ADD COLUMN "businessLogoUrl" TEXT;
