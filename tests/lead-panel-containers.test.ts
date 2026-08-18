import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PANEL = readFileSync(join(process.cwd(), "src/components/leads/received-lead-panel.tsx"), "utf8");
const CARD = "rounded-lg bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]";

/** Each section of the lead panel gets exactly one container — never one inside another. */
function cardBlocks() {
  const lines = PANEL.split("\n");
  const out: { title: string; body: string }[] = [];
  lines.forEach((l, idx) => {
    if (!l.includes("rounded-lg bg-card p-4 border-0")) return;
    let depth = 0;
    for (let i = idx; i < lines.length; i++) {
      depth += (lines[i].match(/<div\b|<section\b/g) ?? []).length;
      depth -= (lines[i].match(/<\/div>|<\/section>/g) ?? []).length;
      if (depth === 0 && i > idx) {
        const body = lines.slice(idx, i + 1).join("\n");
        const t = /<h3[^>]*>([^<{]{2,30})/.exec(body);
        out.push({ title: (t?.[1] ?? "?").trim(), body });
        break;
      }
    }
  });
  return out;
}

describe("one container per section", () => {
  it("no card is nested inside another", () => {
    // Notes used to be a tinted box INSIDE Lead details, and two sections had
    // no container at all — so the panel showed double borders in some places
    // and none in others.
    for (const b of cardBlocks()) {
      const inner = (b.body.match(/rounded-lg bg-card p-4 border-0/g) ?? []).length;
      expect(`${b.title}:${inner}`).toBe(`${b.title}:1`);
    }
  });

  it("every section uses the SAME card, not a one-off style", () => {
    for (const title of ["Your pipeline stage", "Lead details", "Notes", "Deal value", "Comments", "Tasks"]) {
      expect(PANEL).toContain(title);
    }
    expect((PANEL.match(new RegExp(CARD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length)
      .toBeGreaterThanOrEqual(6);
  });

  it("no bare <section> is left without a container", () => {
    expect(PANEL).not.toMatch(/\n\s*<section>\n/);
  });
});

describe("notes scroll internally", () => {
  it("has a fixed height and its own scroll", () => {
    // A long note must not stretch the column or push Deal value and Tasks down.
    expect(PANEL).toMatch(/<div className="max-h-40 overflow-y-auto pr-1">/);
  });

  it("is its own section, not nested in Lead details", () => {
    expect(PANEL).toMatch(/<h3 className="mb-2 text-sm font-semibold">Notes<\/h3>/);
    expect(PANEL).not.toMatch(/mt-3 rounded-md bg-muted\/40 p-3/);
  });
});

describe("nothing functional changed", () => {
  it("keeps the two-column layout", () => {
    // Tolerates extra utilities on the same element (a min-height floor was
    // added later) while still pinning grid + gap + two columns at lg.
    expect(PANEL).toMatch(/grid gap-6[^"]*lg:grid-cols-2/);
  });

  it("keeps every handler and call", () => {
    // Counts pinned so a future "styling only" edit cannot quietly drop one.
    expect((PANEL.match(/useState/g) ?? []).length).toBe(14);
    expect((PANEL.match(/fetch\(/g) ?? []).length).toBe(8);
    expect((PANEL.match(/onClick/g) ?? []).length).toBe(9);
  });
});
