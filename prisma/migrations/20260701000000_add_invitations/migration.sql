-- Member invitations. Backwards-compatible: only adds a new enum + table, no
-- changes to existing rows. Apply with `npx prisma migrate deploy`, or (matching
-- this project's schema-first workflow) `npx prisma db push`.

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedUserId" TEXT,
    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");
CREATE INDEX "invitations_organizationId_status_idx" ON "invitations"("organizationId", "status");
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- Email is unique per *pending* invite (partial index; accepted/expired/revoked
-- rows may repeat an address). Enforced in the API too.
CREATE UNIQUE INDEX "invitations_pending_email_key" ON "invitations"("organizationId", "email") WHERE "status" = 'PENDING';

-- Foreign keys
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
