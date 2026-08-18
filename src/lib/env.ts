import { z } from "zod";

// Fail fast on misconfiguration. AI/S3/email vars are optional so the app
// boots in early phases before those integrations are wired up.
const schema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().optional(),
  // New club joins this organization on self-registration.
  DEFAULT_ORG_SLUG: z.string().optional(),
  DEFAULT_ORG_NAME: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_SERVER_HOST: z.string().optional(),
  EMAIL_SERVER_PORT: z.string().optional(),
  EMAIL_SERVER_USER: z.string().optional(),
  EMAIL_SERVER_PASSWORD: z.string().optional(),
  // Optional at boot ON PURPOSE: making it required would stop every existing
  // deployment that lacks it from starting. The cron routes already fail closed
  // (503) without it, so the risk is silence, not exposure — hence the warning
  // below rather than a hard failure.
  CRON_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;

// Without this, task reminders, RSVP reminders and the monthly Lost->Deleted
// sweep are all inactive and nothing says so. Warn loudly at boot instead.
if (!parsed.data.CRON_SECRET) {
  console.warn(
    "[env] CRON_SECRET is not set. /api/cron/* will refuse to run (503), so " +
      "task reminders, RSVP reminders and lead archival are DISABLED."
  );
}
