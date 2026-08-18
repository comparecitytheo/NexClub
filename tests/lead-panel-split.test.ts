import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PANEL = readFileSync(join(process.cwd(), "src/components/leads/received-lead-panel.tsx"), "utf8");
const BOARD = readFileSync(join(process.cwd(), "src/components/leads/lead-board.tsx"), "utf8");

/**
 * Comments and Tasks are each their own card in the right column, Tasks under
 * Comments. Comments holds a fixed height; Tasks grows to fill the rest so its
 * bottom edge lands level with the bottom of the left column. Both scroll
 * internally with a composer pinned to the bottom.
 *
 * The preview had all of the pinning wrong at once — the composer nested inside
 * the scroller, no pin rule for Tasks at all, and two rule blocks written with
 * a bare `.` selector that every browser silently discarded. None of it showed
 * up as broken markup, which is why it survived.
 */
describe("Comments and Tasks are separate cards", () => {
  it("has no outer card wrapping the pair", () => {
    // Two boxes inside a third card drew a card around a card.
    expect(PANEL).toMatch(/<div className="flex min-w-0 flex-col gap-6">/);
    expect(PANEL).not.toMatch(/<CardContent className="space-y-6 pt-6">/);
    // Exactly one Card left in the file: the Lead Overview card on the left.
    expect((PANEL.match(/<Card /g) ?? []).length).toBe(1);
  });

  it("lets the LEFT column set the row height", () => {
    // Tasks drops its floor at lg so its flex-basis of 0 is what counts. The
    // right column's natural height is then just Comments + gap, always shorter
    // than the left, so the left sets the row and the right stretches to match.
    expect(PANEL).toMatch(/min-h-\[26rem\][^"]*lg:min-h-0/);
    // No zero-height trick: a percentage min-height against an auto-sized row
    // is fragile, and if it fails to resolve the column is left at 0 with its
    // cards hanging out of it.
    expect(PANEL).not.toMatch(/lg:h-0/);
    // A floor for short leads, so Tasks never shrinks to just its header.
    expect(PANEL).toMatch(/lg:min-h-\[36rem\]/);
  });

  it("puts Comments first and Tasks under it", () => {
    expect(PANEL.indexOf(">Comments</h3>")).toBeLessThan(PANEL.indexOf(">Tasks</h3>"));
  });

  it("holds Comments at a fixed height", () => {
    expect(PANEL).toMatch(/flex h-\[26rem\] min-w-0 shrink-0 flex-col/);
  });

  it("gives Tasks the leftover height, not its content height", () => {
    // flex-1 is flex:1 1 0% — basis 0, so Tasks claims only what is left and
    // ends level with the left column instead of being sized by its task list.
    expect(PANEL).toMatch(/flex min-h-\[26rem\] min-w-0 flex-1 flex-col lg:min-h-0/);
  });
});

describe("the composers stay pinned", () => {
  it("the scroller takes the space and the composer keeps its own", () => {
    // flex-1 + min-h-0 on the scroller, shrink-0 on the composer. min-h-0 is
    // the load-bearing half: without it overflow never engages on a flex child.
    expect((PANEL.match(/className="min-h-0 flex-1 overflow-y-auto pr-1"/g) ?? []).length).toBe(2);
    expect((PANEL.match(/className="mt-3 shrink-0/g) ?? []).length).toBe(2);
  });

  it("the composer is a SIBLING of the scroller, never inside it", () => {
    for (const heading of ["Comments", "Tasks"]) {
      const start = PANEL.indexOf(`>${heading}</h3>`);
      expect(start).toBeGreaterThan(-1);
      const scroller = PANEL.indexOf('className="min-h-0 flex-1 overflow-y-auto pr-1"', start);
      const closes = PANEL.indexOf("</section>", scroller);
      const composer = PANEL.indexOf('className="mt-3 shrink-0', start);
      // The scrolling section must close BEFORE the composer opens.
      expect(closes).toBeLessThan(composer);
    }
  });

  it("the task form stacks on box width rather than window width", () => {
    // sm:grid-cols-2 fired on a 640px WINDOW regardless of how wide this box
    // actually was; auto-fit measures the box.
    expect(PANEL).toMatch(/\[grid-template-columns:repeat\(auto-fit,minmax\(140px,1fr\)\)\]/);
    expect(PANEL).not.toMatch(/grid gap-2 sm:grid-cols-2/);
  });
});

describe("one panel for every tab and both view modes", () => {
  it("renders outside the grid/list branch, so the toggle cannot change it", () => {
    const branch = BOARD.indexOf('viewMode === "kanban" && view !== "deleted"');
    const panel = BOARD.indexOf("<ReceivedLeadPanel");
    expect(branch).toBeGreaterThan(-1);
    expect(panel).toBeGreaterThan(branch);
    // Exactly one instance — a second would be free to drift from the first.
    expect((BOARD.match(/<ReceivedLeadPanel/g) ?? []).length).toBe(1);
  });

  it("is keyed off the selected lead alone, not the tab", () => {
    expect(BOARD).toMatch(/\{selectedId && \(/);
  });
});

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("the panel reads at a compact size", () => {
  it("has one scope to tune, not per-element overrides", () => {
    expect(PANEL).toMatch(/className="lead-panel flex min-h-0 flex-1 flex-col/);
    expect(CSS).toMatch(/\.lead-panel :is\(\.text-lg\)/);
    expect(CSS).toMatch(/\.lead-panel :is\(\.text-sm\)/);
    expect(CSS).toMatch(/\.lead-panel :is\(\.text-xs\)/);
  });

  it("holds the 10px legibility floor", () => {
    // globals.css puts the readable limit around here, and the smallest labels
    // already sit on it. Nothing in the panel may go below.
    const scope = CSS.slice(CSS.indexOf(".lead-panel :is(.text-lg)"),
                            CSS.indexOf("/* === Card heading accent"));
    const sizes = [...scope.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(10);
  });

  it("keeps the lead name above the section headings", () => {
    // Explicit, so the text-lg mapping leaves it alone and the hierarchy holds.
    expect(PANEL).toMatch(/<h2 className="truncate text-\[15px\] font-bold/);
  });

  it("leaves a gap under the bottom two cards", () => {
    // On the CONTENT, not on the scroller. Chrome and Safari leave a scroll
    // container's padding-bottom out of the scrollable overflow, so the last
    // card sits flush against the edge and the padding renders as nothing.
    expect(PANEL).toMatch(/<div className="grid gap-6 pb-8 /);
    expect(PANEL).toMatch(/flex-1 overflow-y-auto p-5">/);
    expect(PANEL).not.toMatch(/overflow-y-auto[^"]*pb-\d/);
  });
});
