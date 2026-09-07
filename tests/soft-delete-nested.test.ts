import { describe, it, expect } from "vitest";
import { applyReadScope } from "@/lib/prisma";

/**
 * A task deleted from a lead used to come back the next time that lead was
 * opened.
 *
 * The read filter only ever rewrote the `where` of the model being queried, so
 * anything pulled in beside it arrived unfiltered: the lead detail route reads
 * `taskEntries` as a nested include, and nested includes were nobody's job.
 * The panel's own `/api/tasks` call was filtered, which is why the task
 * vanished from one view and persisted in the other.
 *
 * These exercise the rule directly rather than the four call sites that
 * happened to trip over it, because the next drop will add a fifth.
 */
describe("nested relations are filtered too", () => {
  it("turns `include: { taskEntries: true }` into a filtered read", () => {
    const args = applyReadScope("Lead", "findFirst", { include: { taskEntries: true } });
    expect(args.include).toEqual({ taskEntries: { where: { deletedAt: null } } });
  });

  it("keeps the caller's own options while adding the filter", () => {
    const args = applyReadScope("Lead", "findFirst", {
      include: { taskEntries: { orderBy: { dueDate: "asc" }, take: 50 } },
    });
    expect(args.include).toEqual({
      taskEntries: { where: { deletedAt: null }, orderBy: { dueDate: "asc" }, take: 50 },
    });
  });

  it("filters notes on a lead, not only tasks", () => {
    const args = applyReadScope("Lead", "findFirst", { include: { noteEntries: true } });
    expect(args.include).toEqual({ noteEntries: { where: { deletedAt: null } } });
  });

  it("filters tasks hanging off a deal", () => {
    const args = applyReadScope("Deal", "findUnique", { include: { taskEntries: true } });
    expect(args.include).toEqual({ taskEntries: { where: { deletedAt: null } } });
  });

  it("works through `select` as well as `include`", () => {
    const args = applyReadScope("Lead", "findFirst", {
      select: { id: true, taskEntries: { select: { id: true } } },
    });
    expect(args.select).toEqual({
      id: true,
      taskEntries: { where: { deletedAt: null }, select: { id: true } },
    });
  });

  it("descends more than one level", () => {
    const args = applyReadScope("Organization", "findFirst", {
      include: { leads: { include: { taskEntries: true } } },
    });
    expect(args.include).toMatchObject({
      leads: {
        where: { deletedAt: null, archivedAt: null },
        include: { taskEntries: { where: { deletedAt: null } } },
      },
    });
  });
});

describe("relation counts", () => {
  /**
   * The sent-leads list shows a task and comment badge per lead, built from
   * `_count`. An unfiltered count kept counting deleted rows, so a lead with one
   * live task and two deleted ones read "3".
   */
  it("filters `_count` selections", () => {
    const args = applyReadScope("Lead", "findMany", {
      select: { _count: { select: { taskEntries: true, noteEntries: true } } },
    });
    expect(args.select).toEqual({
      _count: {
        select: {
          taskEntries: { where: { deletedAt: null } },
          noteEntries: { where: { deletedAt: null } },
        },
      },
    });
  });
});

describe("what it must not touch", () => {
  it("leaves a to-one relation alone — Prisma rejects a `where` there", () => {
    const args = applyReadScope("Lead", "findFirst", {
      include: { owner: { select: { name: true } } },
    });
    expect(args.include).toEqual({ owner: { select: { name: true } } });
  });

  it("leaves relations that carry no deletedAt alone", () => {
    const args = applyReadScope("Lead", "findFirst", { include: { activityEntries: true } });
    expect(args.include).toEqual({ activityEntries: true });
  });

  it("lets an explicit filter win, so the archive views still work", () => {
    const args = applyReadScope("Lead", "findMany", { where: { archivedAt: { not: null } } });
    expect(args.where).toEqual({ deletedAt: null, archivedAt: { not: null } });
  });

  it("still scopes the top-level read", () => {
    const args = applyReadScope("Task", "findMany", {});
    expect(args.where).toEqual({ deletedAt: null });
  });

  it("does not put a where on findUnique itself", () => {
    const args = applyReadScope("Task", "findUnique", { where: { id: "t1" } });
    expect(args.where).toEqual({ id: "t1" });
  });

  it("ignores raw calls, which have no model", () => {
    const args = applyReadScope(undefined, "$queryRaw", { anything: true });
    expect(args).toEqual({ anything: true });
  });
});
