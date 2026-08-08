-- BUSINESS LOGO OWNERSHIP
--
-- The logo was a per-user field, and the directory displayed whichever member of
-- a business happened to have uploaded one. That made the choice arbitrary when
-- colleagues both uploaded, and left the logo absent everywhere else.
--
-- The business now names the member whose logo represents it, so every surface
-- resolves the same image.
--
-- Apply with `npx prisma migrate deploy` or `npx prisma db push`.

ALTER TABLE "businesses" ADD COLUMN "logoUserId" TEXT;

-- Backfill: for each business, adopt the logo of its longest-standing member who
-- has one — normally the admin who set the business up.
UPDATE "businesses" b
SET "logoUserId" = pick."id"
FROM (
  SELECT DISTINCT ON (u."businessId") u."businessId", u."id"
  FROM "users" u
  WHERE u."businessId" IS NOT NULL
    AND u."businessLogoUrl" IS NOT NULL
  ORDER BY u."businessId", u."createdAt" ASC
) AS pick
WHERE pick."businessId" = b."id";
