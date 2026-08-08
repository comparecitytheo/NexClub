-- LEAD ARCHIVAL
--
-- Deletion is a state transition on the existing `status` field — a new DELETED
-- enum value — rather than a separate boolean column. Visibility is controlled by
-- `archivedAt`: null means admins can still see the lead, set means Super Admins
-- only. Leads are never hard-deleted.
--
-- Backwards-compatible: all added columns are nullable, existing rows keep NULL,
-- and no existing row changes status. Apply with `npx prisma migrate deploy` or
-- `npx prisma db push`.

-- New status value. Safe inside a transaction on PostgreSQL 12+ as long as the
-- value is not used in the same transaction, which it is not.
ALTER TYPE "LeadStatus" ADD VALUE 'DELETED';

-- When the delete action ran. Named `deletedOn`, not `deletedAt`: `deletedAt` is
-- the pre-existing soft-delete column whose Prisma extension hides rows from
-- every read, and deletion here must NOT hide the lead — archival does that.
ALTER TABLE "leads" ADD COLUMN "deletedOn" TIMESTAMP(3);

-- Who performed the delete. SET NULL so removing a member never destroys the
-- archived lead itself.
ALTER TABLE "leads" ADD COLUMN "deletedById" TEXT;

-- The status the lead held before deletion, for the archive export.
ALTER TABLE "leads" ADD COLUMN "statusBeforeDelete" "LeadStatus";

-- The visibility switch. Stamped by the monthly archival job.
ALTER TABLE "leads" ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Supports the archive list/export and the archival job's pending query.
CREATE INDEX "leads_organizationId_archivedAt_idx" ON "leads"("organizationId", "archivedAt");
