/**
 * RETENTION PURGE
 *
 * "Delete" in the app is a soft delete: the row stays, with `deletedAt` set. That
 * is deliberate — it makes deletion recoverable — but on its own it means personal
 * information is kept forever, which Australian Privacy Principle 11.2 does not
 * allow ("destroy or de-identify when no longer needed").
 *
 * This script closes that gap: it permanently removes records that have been in
 * the deleted state longer than the retention window. Whatever window you choose
 * must match what your privacy policy tells people.
 *
 * Usage:
 *   npm run purge -- --dry-run          # report what would go, change nothing
 *   npm run purge                        # actually delete
 *   RETENTION_DAYS=730 npm run purge     # override the window (default 365)
 *
 * Schedule it (cron, Vercel Cron hitting a small wrapper, or your host's
 * scheduler) so retention is enforced rather than remembered.
 *
 * Deliberately NOT purged:
 *   - User and Organization. Leads carry `Restrict` foreign keys to their referrer
 *     and owner, so removing a member would either fail or orphan the referral
 *     history that the remaining member still legitimately holds. Departed members
 *     need a separate, considered anonymisation step — not a blunt delete.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_RETENTION_DAYS = 365;

// Children first, then parents. Cascades handle most of it, but being explicit
// keeps the counts meaningful and the order safe if cascade rules ever change.
const TARGETS = ["note", "task", "deal", "contact", "company", "lead"] as const;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const days = Number(process.env.RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS);

  if (!Number.isFinite(days) || days < 1) {
    throw new Error("RETENTION_DAYS must be a positive number of days.");
  }

  const cutoff = new Date(Date.now() - days * 86_400_000);
  console.log(
    `${dryRun ? "[dry run] " : ""}Purging records soft-deleted before ${cutoff.toISOString()} ` +
      `(retention: ${days} days).`
  );

  let total = 0;
  for (const model of TARGETS) {
    // Two things make this safe. `deleteMany` is not in the extension's read-op
    // list, so it is a real delete, not another soft delete. And the extension
    // builds `{ deletedAt: null, ...where }` — caller-supplied `deletedAt` wins —
    // so this filter reaches the database intact rather than being neutralised.
    const where = { deletedAt: { not: null, lt: cutoff } };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[model];
    const count = await delegate.count({ where });

    if (count === 0) {
      console.log(`  ${model}: nothing to purge`);
      continue;
    }

    if (dryRun) {
      console.log(`  ${model}: ${count} record(s) would be permanently deleted`);
    } else {
      const result = await delegate.deleteMany({ where });
      console.log(`  ${model}: ${result.count} record(s) permanently deleted`);
    }
    total += count;
  }

  console.log(
    dryRun
      ? `[dry run] ${total} record(s) would be removed. Re-run without --dry-run to apply.`
      : `Done. ${total} record(s) permanently removed.`
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
