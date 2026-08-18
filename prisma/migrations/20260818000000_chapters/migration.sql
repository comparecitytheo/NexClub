-- CHAPTERS (geographic chapters of the club)
--
-- Same omission as the saved-reports migration: the `Chapter` model, the
-- `CHAPTER` EntityType value and `Business.chapterId` all exist in
-- schema.prisma but were never written to a migration. The chapters admin
-- screen is the visible casualty, but `chapterId` is a column on an EXISTING
-- table, so without this every Prisma read of a Business — directory, members,
-- dashboard, any lead joined to a business — fails with
-- `column businesses.chapterId does not exist`.
--
-- Additive only. No existing row is read, rewritten or dropped: one new table,
-- one new nullable column, and indexes. Existing businesses get chapterId NULL,
-- which is exactly "no chapter assigned".

-- Audit log needs to be able to record actions against a chapter.
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'CHAPTER';

CREATE TABLE "chapters" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- One chapter name per club, so "The Shire" is unambiguous in the picker.
CREATE UNIQUE INDEX "chapters_organizationId_name_key"
  ON "chapters"("organizationId", "name");
CREATE INDEX "chapters_organizationId_idx"
  ON "chapters"("organizationId");

ALTER TABLE "chapters"
  ADD CONSTRAINT "chapters_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- A chapter is a LOCATION, so it hangs off the business, not the member.
-- Nullable, and added without a default, so no existing row is rewritten.
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "chapterId" TEXT;

-- SetNull, not Cascade: deleting a chapter must never delete businesses.
ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_chapterId_fkey"
  FOREIGN KEY ("chapterId") REFERENCES "chapters"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "businesses_organizationId_chapterId_idx"
  ON "businesses"("organizationId", "chapterId");
