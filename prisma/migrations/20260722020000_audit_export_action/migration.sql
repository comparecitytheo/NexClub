-- Adds an EXPORT action to the audit log so bulk CSV downloads of personal
-- information are recorded distinctly, rather than being invisible or filed
-- under an action that misdescribes them. Additive and backwards-compatible:
-- existing audit rows and enum values are untouched.
--
-- Note: ALTER TYPE ... ADD VALUE is safe inside a transaction on PostgreSQL 12+
-- provided the new value is not used in the same transaction, which it is not.
-- Apply with `npx prisma migrate deploy` or `npx prisma db push`.

ALTER TYPE "AuditAction" ADD VALUE 'EXPORT';
