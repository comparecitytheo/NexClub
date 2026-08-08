/**
 * MONTH-LAPSE LEAD ARCHIVAL (script form)
 *
 * The same logic the cron route runs, for deployments that schedule with the
 * host's own cron rather than Vercel Cron (e.g. the Docker image).
 *
 *   npm run archive:leads -- --dry-run   # report what would move, change nothing
 *   npm run archive:leads                # apply (only acts on the 1st)
 *   npm run archive:leads -- --force     # run regardless of the date
 *
 * Suggested crontab entry:  0 3 1 * *  cd /app && npm run archive:leads
 *
 * Safe to re-run: already-archived leads are skipped, never re-processed.
 */
import { archiveLapsedLeads, isFirstOfMonth } from "../src/server/leads/archive";
import { prisma } from "../src/lib/prisma";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");

  if (!force && !isFirstOfMonth()) {
    console.log("Not the 1st of the month — nothing to do. Pass --force to run anyway.");
    return;
  }

  const r = await archiveLapsedLeads({ dryRun });
  console.log(
    r.dryRun
      ? `[dry run] ${r.archived} lead(s) would be archived. ${r.alreadyArchived} already archived (skipped).`
      : `Archived ${r.archived} lead(s). ${r.alreadyArchived} already archived (skipped).`
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
