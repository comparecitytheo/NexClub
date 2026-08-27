-- REAL BUSINESSES
--
-- Business membership used to be a free-text `businessName` on each user, which
-- every user could edit on their own profile. That made membership self-asserted:
-- anyone could type another business's name and be treated as part of it, and a
-- business admin could invite staff into a business they did not belong to.
--
-- This creates a real `businesses` table and points each user at a row. From here
-- `users.businessId` is the authority; `users.businessName` survives only as a
-- display mirror maintained server-side.
--
-- Apply with `npx prisma migrate deploy` or `npx prisma db push`.

CREATE TABLE "businesses" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "industry"       TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "businesses_organizationId_name_key" ON "businesses"("organizationId", "name");
CREATE INDEX "businesses_organizationId_idx" ON "businesses"("organizationId");

ALTER TABLE "businesses" ADD CONSTRAINT "businesses_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD COLUMN "businessId" TEXT;

-- BACKFILL --------------------------------------------------------------------
-- One business per distinct name per organisation, matched case-insensitively so
-- "Sharma Financial" and "sharma financial" become ONE business rather than two.
-- The spelling kept is the one belonging to the earliest-created member, which is
-- normally the business admin who was invited first.
INSERT INTO "businesses" ("id", "organizationId", "name", "industry", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  first_user."organizationId",
  first_user."businessName",
  first_user."industry",
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT ON (u."organizationId", LOWER(TRIM(u."businessName")))
    u."organizationId",
    TRIM(u."businessName") AS "businessName",
    u."industry"
  FROM "users" u
  WHERE u."businessName" IS NOT NULL
    AND TRIM(u."businessName") <> ''
  ORDER BY u."organizationId", LOWER(TRIM(u."businessName")), u."createdAt" ASC
) AS first_user;

-- Link every user to their business, matching case-insensitively so members who
-- typed a different capitalisation still land in the right one.
UPDATE "users" u
SET "businessId" = b."id"
FROM "businesses" b
WHERE b."organizationId" = u."organizationId"
  AND LOWER(TRIM(b."name")) = LOWER(TRIM(u."businessName"));

ALTER TABLE "users" ADD CONSTRAINT "users_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "users_businessId_idx" ON "users"("businessId");
