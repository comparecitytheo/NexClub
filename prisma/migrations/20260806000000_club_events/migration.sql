-- CLUB EVENTS
-- Events are created and edited by Super Admins and visible to the whole club.
-- Members respond with one RSVP row each. Additive: no existing table changes
-- except two new enum values.
-- Apply with `npx prisma migrate deploy` or `npx prisma db push`.

ALTER TYPE "NotificationType" ADD VALUE 'EVENT_CREATED';
ALTER TYPE "EntityType" ADD VALUE 'EVENT';

CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'NOT_GOING');

CREATE TABLE "events" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "description"    TEXT,
  "location"       TEXT,
  "startsAt"       TIMESTAMP(3) NOT NULL,
  "endsAt"         TIMESTAMP(3),
  "createdById"    TEXT NOT NULL,
  "deletedAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "events_organizationId_startsAt_idx" ON "events"("organizationId", "startsAt");
CREATE INDEX "events_deletedAt_idx" ON "events"("deletedAt");

ALTER TABLE "events" ADD CONSTRAINT "events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "event_rsvps" (
  "id"        TEXT NOT NULL,
  "eventId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "status"    "RsvpStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("id")
);

-- One response per member per event; changing your mind updates the row.
CREATE UNIQUE INDEX "event_rsvps_eventId_userId_key" ON "event_rsvps"("eventId", "userId");
CREATE INDEX "event_rsvps_eventId_idx" ON "event_rsvps"("eventId");

ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
