import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PAGE = readFileSync(join(process.cwd(), "src/app/(dashboard)/leads/new/page.tsx"), "utf8");
const FORM = readFileSync(join(process.cwd(), "src/components/leads/lead-form.tsx"), "utf8");

/**
 * Send a lead uses the full page width.
 *
 * It was capped at max-w-2xl and centred, which on a wide screen left the form
 * sitting in a narrow column. Removing the cap alone is not enough: without a
 * grid every field would then stretch across the whole page, which is worse.
 */
describe("the page is full width", () => {
  it("no longer caps itself at max-w-2xl", () => {
    expect(PAGE).not.toMatch(/max-w-2xl/);
  });
});

describe("the fields share the width sensibly", () => {
  it("the form itself is the grid", () => {
    expect(FORM).toMatch(/<form[^>]*className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2 xl:grid-cols-3"/);
  });

  it("the phone/email pair joins that grid rather than nesting", () => {
    // `contents` promotes them to cells of the outer grid, so they line up with
    // everything else without restructuring the markup.
    expect(FORM).toMatch(/<div className="contents">/);
    expect(FORM).not.toMatch(/<div className="grid gap-4 sm:grid-cols-2">/);
  });

  it("keeps all seven fields", () => {
    for (const l of ["Full Name", "Mobile Number", "Email", "Note", "Assign To", "Date received", "Priority"]) {
      expect(FORM).toContain(l);
    }
  });

  it("gives the note a full row — it wants a long line", () => {
    const i = FORM.indexOf('htmlFor="notes"');
    const open = FORM.lastIndexOf('<div className="', 0 + i);
    expect(FORM.slice(open, i)).toMatch(/sm:col-span-2 xl:col-span-3/);
  });

  it("gives the consent statement and the buttons a full row too", () => {
    expect(FORM).toMatch(/rounded-lg bg-card p-4[^"]*sm:col-span-2 xl:col-span-3/);
    expect(FORM).toMatch(/flex justify-end gap-2 sm:col-span-2 xl:col-span-3/);
  });
});


describe("priority and date", () => {
  it("lays the priority buttons out left to right", () => {
    // Priority sat in a one-third grid cell, so its buttons wrapped and stacked.
    expect(FORM).toMatch(/<div className="space-y-2 sm:col-span-2 xl:col-span-3">\s*<Label>Priority<\/Label>/);
    // The field spans a full row so they fit on one line; the buttons keep
    // their natural width rather than stretching to fill it.
    expect(FORM).toMatch(/flex flex-wrap gap-2"/);
  });

  it("defaults the date received to today", () => {
    // The field DISPLAYED today but the form state held nothing, so submitting
    // without touching it sent no date at all.
    expect(FORM).toMatch(/dateReceived: new Date\(\)\.toLocaleDateString\("en-CA"\)/);
  });

  it("uses local time for that default, not UTC", () => {
    // toISOString() would shift a Sydney evening back to the previous UTC day.
    expect(FORM).not.toMatch(/dateReceived[^\n]*toISOString/);
  });
});
