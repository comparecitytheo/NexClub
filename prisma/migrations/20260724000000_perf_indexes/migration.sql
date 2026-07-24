-- Performance: composite indexes backing the ORDER BY on full-table list loads.
--
-- The Companies list (src/app/(dashboard)/companies/page.tsx) fetches every
-- company in the org and sorts by name; the Contacts list
-- (src/app/(dashboard)/contacts/page.tsx) fetches every contact and sorts by
-- createdAt. Foreign keys were already indexed, but the (organizationId, <sort>)
-- pairs were not, so both sorts fell back to an in-memory sort of the whole
-- table. These composite indexes let Postgres satisfy the filter + order from
-- the index directly.
--
-- Additive and backwards-compatible; no data change. IF NOT EXISTS keeps the
-- migration idempotent even if an index was previously created out-of-band.

CREATE INDEX IF NOT EXISTS "companies_organizationId_name_idx" ON "companies"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "contacts_organizationId_createdAt_idx" ON "contacts"("organizationId", "createdAt");
