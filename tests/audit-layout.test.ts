import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const TABLE = readFileSync(join(process.cwd(), "src/components/audit/audit-table.tsx"), "utf8");
const PAGE = readFileSync(join(process.cwd(), "src/app/(dashboard)/admin/audit/page.tsx"), "utf8");
const ADMIN = readFileSync(join(process.cwd(), "src/app/(dashboard)/admin/layout.tsx"), "utf8");

/**
 * The audit log fills the page rather than sizing to its rows.
 *
 * It previously ended wherever the rows ended, leaving the card floating in the
 * top half of an otherwise empty page and not lining up with the rail.
 */
describe("the audit log fills the page", () => {
  it("the table card takes the remaining height", () => {
    expect(TABLE).toMatch(/min-h-0 flex-1 overflow-auto rounded-lg bg-card/);
  });

  it("the empty state fills it too, rather than collapsing", () => {
    expect(TABLE).toMatch(/grid min-h-0 flex-1 place-items-center/);
  });

  it("the filters keep their own height", () => {
    expect(TABLE).toMatch(/flex shrink-0 flex-wrap items-center gap-2/);
  });

  it("the page is a full-height column", () => {
    expect(PAGE).toMatch(/flex h-full min-h-0 flex-col gap-4/);
  });

  it("the admin layout passes the height through", () => {
    // h-full resolves to nothing unless every ancestor has a height, which is
    // why the card stayed short even once it asked to grow.
    expect(ADMIN).toMatch(/flex h-full min-h-0 flex-col gap-6/);
    expect(ADMIN).toMatch(/<div className="min-h-0 flex-1">\{children\}<\/div>/);
  });
});
