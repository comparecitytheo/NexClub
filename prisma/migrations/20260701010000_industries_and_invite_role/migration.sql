-- Backwards-compatible: adds the shared industries table (seeded with the current
-- list) and an invite role column. No existing rows are modified beyond a defaulted
-- column. Apply with `npx prisma migrate deploy` or `npx prisma db push`.

-- Invitation role (business admin for super-admin invites; member for business-admin
-- invites). Existing pending invites default to SALES_REP, matching prior behaviour.
ALTER TABLE "invitations" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'SALES_REP';

-- Shared industries table.
CREATE TABLE "industries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "industries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "industries_name_key" ON "industries"("name");
-- Case-insensitive uniqueness so "Finance" and "finance" can't both exist.
CREATE UNIQUE INDEX "industries_name_lower_key" ON "industries"(lower("name"));

-- Seed with the existing canonical list (src/lib/industries.ts).
INSERT INTO "industries" ("id", "name") VALUES
  (gen_random_uuid()::text, 'Automotive'),
  (gen_random_uuid()::text, 'Construction'),
  (gen_random_uuid()::text, 'Consulting'),
  (gen_random_uuid()::text, 'Education'),
  (gen_random_uuid()::text, 'Finance'),
  (gen_random_uuid()::text, 'Hospitality'),
  (gen_random_uuid()::text, 'Information Technology'),
  (gen_random_uuid()::text, 'Legal'),
  (gen_random_uuid()::text, 'Marketing & Advertising'),
  (gen_random_uuid()::text, 'Medical'),
  (gen_random_uuid()::text, 'Real Estate'),
  (gen_random_uuid()::text, 'Retail'),
  (gen_random_uuid()::text, 'Accounting'),
  (gen_random_uuid()::text, 'Other')
ON CONFLICT DO NOTHING;
