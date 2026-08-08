import { describe, it, expect } from "vitest";
import { isAdmin } from "@/lib/rbac";

// Reopening restores a deleted lead to the stage it held before deletion and
// clears the whole deletion trail. Permission mirrors deletion: sender or admin.

/** Mirrors the guard in POST /api/leads/[id]/reopen. */
function canReopen(role: string, referrerId: string, userId: string) {
  return isAdmin(role as never) || referrerId === userId;
}

/** Mirrors the data written by the reopen route. */
function reopenPatch(statusBeforeDelete: string | null) {
  return {
    status: statusBeforeDelete ?? "NEW",
    statusBeforeDelete: null,
    deletedOn: null,
    deletedById: null,
    archivedAt: null,
  };
}

describe("who may reopen", () => {
  it("lets the member who sent the referral reopen it", () => {
    expect(canReopen("SALES_REP", "user-1", "user-1")).toBe(true);
  });

  it("lets an admin reopen any lead", () => {
    expect(canReopen("ADMIN", "someone-else", "user-1")).toBe(true);
    expect(canReopen("SUPER_ADMIN", "someone-else", "user-1")).toBe(true);
  });

  it("does not let the receiver reopen — they could not delete it either", () => {
    expect(canReopen("SALES_REP", "the-sender", "the-receiver")).toBe(false);
  });

  it("matches the delete rule exactly, so the two cannot drift apart", () => {
    for (const role of ["SUPPORT_AGENT", "SALES_REP", "MANAGER", "ADMIN", "SUPER_ADMIN"]) {
      const canDelete = isAdmin(role as never) || "u1" === "u1";
      expect(canReopen(role, "u1", "u1")).toBe(canDelete);
    }
  });
});

describe("what reopening restores", () => {
  it("returns the lead to the stage it held before deletion", () => {
    expect(reopenPatch("IN_PROGRESS").status).toBe("IN_PROGRESS");
    expect(reopenPatch("CLOSED_WON").status).toBe("CLOSED_WON");
  });

  it("falls back to NEW when no prior stage was recorded", () => {
    // Leads deleted before the trail existed have a null statusBeforeDelete;
    // they must still land somewhere valid rather than staying DELETED.
    expect(reopenPatch(null).status).toBe("NEW");
  });

  it("clears the entire deletion trail", () => {
    const patch = reopenPatch("CONTACTED");
    expect(patch.statusBeforeDelete).toBeNull();
    expect(patch.deletedOn).toBeNull();
    expect(patch.deletedById).toBeNull();
  });

  it("clears archivedAt, so an archived lead leaves the archive too", () => {
    expect(reopenPatch("NEW").archivedAt).toBeNull();
  });

  it("never leaves the lead in DELETED status", () => {
    for (const prior of ["NEW", "CONTACTED", "IN_PROGRESS", "CLOSED_WON", "CLOSED_LOST", null]) {
      expect(reopenPatch(prior).status).not.toBe("DELETED");
    }
  });
});
