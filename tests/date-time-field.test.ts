import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const FIELD = readFileSync(join(process.cwd(), "src/components/shared/date-time-field.tsx"), "utf8");

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx$/.test(e)) acc.push(full);
  }
  return acc;
}

/**
 * The date picker is the CRM's own, not the browser's.
 *
 * A native <input type="date"> opens a popup painted by the browser — Chrome's
 * blue selection, blue Clear/Today links — which no CSS can reach. Matching the
 * CRM meant replacing the popup, not restyling the field.
 */
describe("the picker uses CRM colours", () => {
  it("selects with the primary colour, not a hardcoded blue", () => {
    expect(FIELD).toMatch(/bg-primary font-semibold text-primary-foreground/);
    expect(FIELD).not.toMatch(/bg-blue-|#2563eb|#1a73e8/);
  });

  it("reuses the app's popover shell", () => {
    expect(FIELD).toMatch(/rounded-xl bg-card p-4 border-0 shadow-\[0_6px_20px_rgba\(0,0,0,0\.16\)\]/);
  });

  it("matches the shared Input's shape so it sits level with siblings", () => {
    expect(FIELD).toMatch(/h-9 w-full items-center justify-between rounded-md border border-input/);
  });

  it("adds no dependency — icons come from the one already in use", () => {
    expect(FIELD).toMatch(/from "lucide-react"/);
    const imports = FIELD.match(/from "([^"]+)"/g) ?? [];
    for (const i of imports) {
      expect(i).toMatch(/lucide-react|^from "@\/|from "react"/);
    }
  });
});

describe("it keeps the value format callers already use", () => {
  it("emits YYYY-MM-DD, or with time appended", () => {
    expect(FIELD).toMatch(/\$\{d\.getFullYear\(\)\}-\$\{pad\(d\.getMonth\(\) \+ 1\)\}-\$\{pad\(d\.getDate\(\)\)\}/);
    expect(FIELD).toMatch(/withTime \? `\$\{date\}T\$\{pad\(d\.getHours\(\)\)\}:\$\{pad\(d\.getMinutes\(\)\)\}` : date/);
  });

  it("treats an empty or unparseable value as no date", () => {
    expect(FIELD).toMatch(/if \(!value\) return null;/);
    expect(FIELD).toMatch(/Number\.isNaN\(d\.getTime\(\)\) \? null : d/);
  });

  it("defaults a new due time to 9am rather than midnight", () => {
    expect(FIELD).toMatch(/day\.getDate\(\), 9, 0\)/);
  });
});

describe("it closes properly", () => {
  it("on an outside click and on Escape", () => {
    expect(FIELD).toMatch(/document\.addEventListener\("mousedown", onDown\)/);
    expect(FIELD).toMatch(/e\.key === "Escape"/);
  });

  it("removes both listeners on unmount", () => {
    expect(FIELD).toMatch(/removeEventListener\("mousedown", onDown\)/);
    expect(FIELD).toMatch(/removeEventListener\("keydown", onKey\)/);
  });
});

describe("no native date popup is left anywhere", () => {
  it("no component still renders a raw date input", () => {
    const offenders: string[] = [];
    for (const f of sourceFiles(join(process.cwd(), "src/components"))) {
      if (f.endsWith("date-time-field.tsx")) continue; // owns the time sub-input
      const src = readFileSync(f, "utf8");
      if (/type="date"|type="datetime-local"/.test(src)) offenders.push(f.split("/").pop()!);
    }
    expect(offenders).toEqual([]);
  });
});


describe("the popup is not clipped by scrolling containers", () => {
  it("is positioned fixed, not absolute", () => {
    // The lead panel nests three scrolling containers; an absolutely-positioned
    // popup is clipped by the nearest one, which cut the calendar in half
    // inside the Tasks box.
    expect(FIELD).toMatch(/className="fixed z-\[100\]/);
    expect(FIELD).not.toMatch(/className="absolute left-0 z-50/);
  });

  it("measures the trigger to place itself", () => {
    expect(FIELD).toMatch(/btnRef\.current\?\.getBoundingClientRect\(\)/);
  });

  it("flips above the field when there is no room below", () => {
    expect(FIELD).toMatch(/below < H && r\.top > H \? r\.top - H - 8 : r\.bottom \+ 8/);
  });

  it("stays on screen horizontally", () => {
    expect(FIELD).toMatch(/Math\.min\(Math\.max\(8, r\.left\), window\.innerWidth - W - 8\)/);
  });

  it("follows the field when a nested container scrolls", () => {
    // The capture flag is what catches scrolls inside nested boxes, not just
    // the window — without it the popup would detach from its field.
    expect(FIELD).toMatch(/window\.addEventListener\("scroll", place, true\)/);
    expect(FIELD).toMatch(/window\.removeEventListener\("scroll", place, true\)/);
  });
});
