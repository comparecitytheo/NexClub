-- Per-user theme colours, stored on the user row so the theme follows the
-- ACCOUNT rather than the browser or device. Nullable: null means the app
-- default, so existing users are unaffected.
-- Apply with `npx prisma migrate deploy` or `npx prisma db push`.

ALTER TABLE "users" ADD COLUMN "themePreferences" JSONB;
