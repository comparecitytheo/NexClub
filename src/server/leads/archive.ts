import { prisma } from "@/lib/prisma";

/**
 * MONTHLY LEAD SWEEP (runs on the 1st)
 *
 * Two steps, in this order:
 *
 *   1. ARCHIVE — leads already sitting in DELETED are stamped `archivedAt`.
 *      This is now an internal retention marker only: there is no separate
 *      archive screen, and both archived and unarchived deleted leads appear
 *      together on the Deleted tab.
 *
 *   2. SWEEP LOST — leads still sitting in CLOSED_LOST are moved into DELETED,
 *      recording CLOSED_LOST as `statusBeforeDelete` so they can be reopened
 *      back to Lost. `deletedById` stays null, which the UI reads as an
 *      automatic deletion rather than one a member performed.
 *
 * Order matters: archiving runs FIRST, so a lead swept out of Lost this month
 * gets a full month in the Deleted tab before it is archived, rather than being
 * archived the instant it is deleted.
 *
 * Idempotency: each step filters on the state it is changing, so a re-run —
 * same day, twice over, or after a partial failure — skips whatever it already
 * did. Cron delivery is at-least-once, so this matters.
 */

/** Leads in these statuses get archived once they have been deleted. */
export const ARCHIVABLE_STATUSES = ["DELETED"] as const;

/** Leads in these statuses are swept into DELETED by the monthly job. */
export const SWEEP_TO_DELETED_STATUSES = ["CLOSED_LOST"] as const;

export type ArchiveResult = {
  /** Lost leads swept into DELETED by this run. */
  sweptFromLost: number;
  /** Rows archived by this run (or, on a dry run, rows that would be). */
  archived: number;
  /** Rows already archived and therefore skipped. */
  alreadyArchived: number;
  dryRun: boolean;
};

export async function archiveLapsedLeads(
  options: { dryRun?: boolean } = {}
): Promise<ArchiveResult> {
  const dryRun = options.dryRun ?? false;

  // Not yet archived, so the extension's injected `archivedAt: null` matches and
  // no override is needed here.
  const pending = {
    status: { in: [...ARCHIVABLE_STATUSES] },
    archivedAt: null,
  };

  const [toArchive, alreadyArchived] = await Promise.all([
    prisma.lead.count({ where: pending }),
    // Explicit `archivedAt` overrides the injected default — the only way to
    // count rows that are already archived.
    prisma.lead.count({
      where: { status: { in: [...ARCHIVABLE_STATUSES] }, archivedAt: { not: null } },
    }),
  ]);

  // Step 2 target: leads still sitting in Lost. Counted up front so a dry run
  // can report both steps.
  const lostPending = { status: { in: [...SWEEP_TO_DELETED_STATUSES] } };
  const toSweep = await prisma.lead.count({ where: lostPending });

  if (dryRun) {
    return {
      archived: toArchive,
      sweptFromLost: toSweep,
      alreadyArchived,
      dryRun: true,
    };
  }

  // STEP 1 — archive what is already deleted. Runs first so a lead swept out of
  // Lost below gets a full month on the Deleted tab before it is archived.
  const archived =
    toArchive === 0
      ? 0
      : (await prisma.lead.updateMany({ where: pending, data: { archivedAt: new Date() } })).count;

  // STEP 2 — sweep Lost into Deleted. `deletedById` stays null, which the UI
  // reads as an automatic deletion rather than one a member performed.
  // `statusBeforeDelete` records CLOSED_LOST so Reopen returns it to Lost.
  const sweptFromLost =
    toSweep === 0
      ? 0
      : (
          await prisma.lead.updateMany({
            where: lostPending,
            data: {
              status: "DELETED",
              statusBeforeDelete: "CLOSED_LOST",
              deletedOn: new Date(),
              deletedById: null,
            },
          })
        ).count;

  return { archived, sweptFromLost, alreadyArchived, dryRun: false };
}

/**
 * True on the 1st of the month. The schedule already targets the 1st; this is a
 * guard so a daily or retried schedule cannot archive early. Because the job is
 * idempotent, an extra run on the 1st itself is harmless.
 */
export function isFirstOfMonth(now: Date = new Date()): boolean {
  return now.getDate() === 1;
}
