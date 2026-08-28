-- The client team's drop added the street address to `model Business` in
-- schema.prisma but shipped no migration for it, so production kept a
-- `businesses` table without these columns while the generated client selected
-- them. Prisma raised P2022 and every read that touches a business address
-- 500'd: /settings (reached from the avatar menu), /admin/businesses, and the
-- PATCH endpoints behind both.
--
-- Same failure mode as the missing `chapters` migration caught before go-live,
-- and it slipped through for the same reason: `prisma migrate status` compares
-- the migration history, not the datamodel against the database. `prisma
-- migrate diff --from-schema-datasource --to-schema-datamodel` is what catches
-- it.
--
-- All five are nullable TEXT with no default, so this adds columns to the 16
-- existing rows without rewriting or touching any of them.
ALTER TABLE "businesses" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "postcode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "suburb" TEXT;
