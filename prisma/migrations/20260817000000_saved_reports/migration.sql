-- SAVED REPORTS (custom report builder)
--
-- The report builder shipped without its migration: the `SavedReport` model and
-- the `SAVED_REPORT` EntityType value exist in schema.prisma but were never
-- written to a migration, so /admin/reports fails on any database whose schema
-- came from `migrate deploy`.
--
-- Nothing is cached here — a saved report stores only the DEFINITION (which
-- metrics, which scope, which range). Figures are recomputed by
-- /api/admin/reports/run on every load, so deleting a row loses no data.
--
-- Apply with `npx prisma migrate deploy`.
--
-- NOTE: this migration assumes "organizations" and "users" already exist. See
-- the baselining section in HANDOVER.md — the migration history has no initial
-- migration, so a FRESH database needs a baseline generated before this runs.

-- Audit log needs to be able to record actions against a saved report.
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'SAVED_REPORT';

CREATE TABLE "saved_reports" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  -- Report keys, in the order the builder listed them.
  "metricKeys"     TEXT[],
  -- Scope the report runs against. NULL means club-wide.
  "businessKey"    TEXT,
  -- Range in days (7/30/90), or NULL when explicit dates are used.
  "rangeDays"      INTEGER,
  "rangeFrom"      TIMESTAMP(3),
  "rangeTo"        TIMESTAMP(3),
  "createdById"    TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- One report name per club, so "Q3 revenue" is unambiguous in the saved list.
CREATE UNIQUE INDEX "saved_reports_organizationId_name_key"
  ON "saved_reports"("organizationId", "name");
CREATE INDEX "saved_reports_organizationId_idx"
  ON "saved_reports"("organizationId");

-- Cascades match the schema: deleting a club or the member who built the report
-- removes the definition with it.
ALTER TABLE "saved_reports"
  ADD CONSTRAINT "saved_reports_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_reports"
  ADD CONSTRAINT "saved_reports_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
