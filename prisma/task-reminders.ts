/**
 * OVERDUE TASK REMINDERS (script form)
 *
 * Same logic the cron route runs, for deployments scheduling with the host's own
 * cron rather than Vercel Cron (e.g. the Docker image).
 *
 *   npm run tasks:remind -- --dry-run   # report who would be chased
 *   npm run tasks:remind                # send
 *
 * Suggested crontab entry (daily at 8am):  0 8 * * *  cd /app && npm run tasks:remind
 *
 * Safe to run daily: each task is only chased every 2nd day.
 */
import { sendOverdueTaskReminders } from "../src/server/tasks/overdue-reminders";
import { prisma } from "../src/lib/prisma";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const r = await sendOverdueTaskReminders({ dryRun });
  console.log(
    r.dryRun
      ? `[dry run] ${r.reminded} reminder(s) would be sent. ${r.skippedRecentlyReminded} overdue task(s) chased within the last 2 days (skipped).`
      : `Sent ${r.reminded} reminder(s). ${r.skippedRecentlyReminded} overdue task(s) chased within the last 2 days (skipped).`
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
