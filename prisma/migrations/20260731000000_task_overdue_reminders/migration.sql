-- Tracks when an overdue task last had a reminder emailed, so the reminder job
-- can send every 2nd day rather than every day it runs. Nullable and additive:
-- existing tasks keep NULL and are picked up by the first overdue pass.
-- Apply with `npx prisma migrate deploy` or `npx prisma db push`.

ALTER TABLE "tasks" ADD COLUMN "lastOverdueReminderAt" TIMESTAMP(3);
