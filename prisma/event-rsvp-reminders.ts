/**
 * WEEKLY RSVP REMINDERS (script form)
 *
 * The same logic the cron route runs, for deployments scheduling with the host's
 * own cron rather than Vercel Cron (e.g. the Docker image).
 *
 *   npm run events:remind -- --dry-run   # report who would be chased
 *   npm run events:remind                # send (only acts on a Monday)
 *   npm run events:remind -- --force     # run regardless of the day
 *
 * Suggested crontab entry:  0 8 * * 1  cd /app && npm run events:remind
 */
import { sendRsvpReminders, isMonday } from "../src/server/events/rsvp-reminders";
import { prisma } from "../src/lib/prisma";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");

  if (!force && !isMonday()) {
    console.log("Not Monday — nothing to do. Pass --force to run anyway.");
    return;
  }

  const r = await sendRsvpReminders({ dryRun });
  console.log(
    `${r.dryRun ? "[dry run] " : ""}${r.reminded} reminder(s) across ${r.events} upcoming event(s). ` +
      `${r.alreadyResponded} member/event pair(s) already answered (skipped).`
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
