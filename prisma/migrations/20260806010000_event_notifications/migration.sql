-- Event notification types: a change of date/time, a cancellation, and the
-- weekly RSVP nudge. Additive enum values only — no table changes.
-- Apply with `npx prisma migrate deploy` or `npx prisma db push`.

ALTER TYPE "NotificationType" ADD VALUE 'EVENT_RESCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_RSVP_REMINDER';
