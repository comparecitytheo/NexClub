import { describe, it, expect, vi, beforeEach } from "vitest";

// The archival job and the visibility guard both talk to Prisma, so that
// boundary is mocked and the real logic is exercised against it.
const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { count: mocks.count, updateMany: mocks.updateMany } },
}));

import {
  archiveLapsedLeads,
  isFirstOfMonth,
  ARCHIVABLE_STATUSES,
  SWEEP_TO_DELETED_STATUSES,
} from "@/server/leads/archive";
import { isAdmin, isSuperAdmin } from "@/lib/rbac";

beforeEach(() => {
  mocks.count.mockReset();
  mocks.updateMany.mockReset().mockResolvedValue({ count: 0 });
});

/**
 * count() is called three times per run: archive-pending, already-archived, then
 * the Lost leads waiting to be swept into DELETED.
 */
function mockCounts(pending: number, already: number, lost = 0) {
  mocks.count
    .mockResolvedValueOnce(pending)
    .mockResolvedValueOnce(already)
    .mockResolvedValueOnce(lost);
}

describe("month-lapse archival — which leads are touched", () => {
  it("only targets deleted leads, leaving every other status untouched", async () => {
    mockCounts(3, 0);
    mocks.updateMany.mockResolvedValue({ count: 3 });

    await archiveLapsedLeads();

    const where = mocks.updateMany.mock.calls[0][0].where;
    // The status filter is the guarantee that NEW / CONTACTED / IN_PROGRESS /
    // CLOSED_WON are never swept up by the job.
    expect(where.status).toEqual({ in: ["DELETED"] });
    expect(where.archivedAt).toBeNull();
  });

  it("does not archive genuine lost leads, which stay visible in the pipeline", () => {
    expect(ARCHIVABLE_STATUSES).not.toContain("CLOSED_LOST");
    expect(ARCHIVABLE_STATUSES).toContain("DELETED");
  });

  it("stamps archivedAt when it archives", async () => {
    mockCounts(2, 0);
    mocks.updateMany.mockResolvedValue({ count: 2 });

    const r = await archiveLapsedLeads();

    expect(r.archived).toBe(2);
    expect(mocks.updateMany.mock.calls[0][0].data.archivedAt).toBeInstanceOf(Date);
  });
});

describe("month-lapse archival — idempotency", () => {
  it("skips leads that are already archived rather than re-processing them", async () => {
    // Nothing pending, 5 already archived — a second run on the same day.
    mockCounts(0, 5);

    const r = await archiveLapsedLeads();

    expect(r.archived).toBe(0);
    expect(r.alreadyArchived).toBe(5);
    // The decisive assertion: a re-run performs no write at all.
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("is safe to re-run: the second pass finds nothing left to do", async () => {
    mockCounts(4, 0);
    mocks.updateMany.mockResolvedValue({ count: 4 });
    const first = await archiveLapsedLeads();
    expect(first.archived).toBe(4);

    mocks.updateMany.mockClear();
    mockCounts(0, 4);
    const second = await archiveLapsedLeads();

    expect(second.archived).toBe(0);
    expect(second.alreadyArchived).toBe(4);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("never re-archives, because the filter requires archivedAt to be null", async () => {
    mockCounts(1, 9);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    await archiveLapsedLeads();
    expect(mocks.updateMany.mock.calls[0][0].where.archivedAt).toBeNull();
  });

  it("reports without writing on a dry run", async () => {
    mockCounts(7, 2);
    const r = await archiveLapsedLeads({ dryRun: true });
    expect(r).toMatchObject({ archived: 7, alreadyArchived: 2, dryRun: true });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

describe("month-lapse schedule guard", () => {
  it("runs on the 1st and not on other days", () => {
    expect(isFirstOfMonth(new Date("2026-08-01T03:00:00Z"))).toBe(true);
    expect(isFirstOfMonth(new Date("2026-08-02T03:00:00Z"))).toBe(false);
    expect(isFirstOfMonth(new Date("2026-08-31T03:00:00Z"))).toBe(false);
  });
});

describe("archive visibility — admin vs super admin", () => {
  it("an admin is not a super admin, so the archive endpoints reject them", () => {
    // The archive list/export call requireSuperAdmin, which is this predicate.
    expect(isSuperAdmin("ADMIN")).toBe(false);
    expect(isSuperAdmin("MANAGER")).toBe(false);
    expect(isSuperAdmin("SALES_REP")).toBe(false);
    expect(isSuperAdmin("SUPPORT_AGENT")).toBe(false);
  });

  it("only a super admin passes the archive gate", () => {
    expect(isSuperAdmin("SUPER_ADMIN")).toBe(true);
  });

  it("the admin check must not be mistaken for the archive gate", () => {
    // isAdmin("ADMIN") is true — if the archive used isAdmin instead of
    // isSuperAdmin, every admin would see archived leads. This pins them apart.
    expect(isAdmin("ADMIN")).toBe(true);
    expect(isSuperAdmin("ADMIN")).toBe(false);
  });
});

describe("monthly sweep of Lost leads", () => {
  it("targets CLOSED_LOST, so lost leads become deleted automatically", () => {
    expect(SWEEP_TO_DELETED_STATUSES).toEqual(["CLOSED_LOST"]);
  });

  it("does not sweep active stages", () => {
    for (const s of ["NEW", "CONTACTED", "IN_PROGRESS", "CLOSED_WON"]) {
      expect(SWEEP_TO_DELETED_STATUSES).not.toContain(s);
    }
  });

  it("moves lost leads into DELETED and records Lost as the prior stage", async () => {
    mockCounts(0, 0);
    mocks.count.mockResolvedValue(0);
    mocks.count.mockReset();
    // archive pending=0, alreadyArchived=0, lostPending=2
    mocks.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    mocks.updateMany.mockResolvedValue({ count: 2 });

    const r = await archiveLapsedLeads();

    expect(r.sweptFromLost).toBe(2);
    const call = mocks.updateMany.mock.calls.at(-1)![0];
    expect(call.where.status).toEqual({ in: ["CLOSED_LOST"] });
    expect(call.data).toMatchObject({
      status: "DELETED",
      statusBeforeDelete: "CLOSED_LOST",
      // No actor: the job did it, not a member.
      deletedById: null,
    });
  });

  it("archives BEFORE sweeping, so a freshly swept lead is not archived same-run", async () => {
    mocks.count.mockReset();
    mocks.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    mocks.updateMany.mockResolvedValue({ count: 1 });

    await archiveLapsedLeads();

    const [first, second] = mocks.updateMany.mock.calls;
    expect(first[0].data).toHaveProperty("archivedAt");        // archive ran first
    expect(second[0].data.status).toBe("DELETED");              // sweep ran second
  });
});
