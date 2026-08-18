import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { initials } from "@/lib/format";

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const LAYOUT = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

/**
 * Emoji have to survive everywhere a member can type.
 *
 * Two things break them. Fonts: Manrope carries no emoji glyphs, so without an
 * explicit fallback some platforms draw a tofu box. And string handling: `s[0]`
 * takes one UTF-16 code unit, which is HALF an emoji.
 */
describe("initials handle emoji as whole characters", () => {
  it("keeps an emoji intact instead of splitting the surrogate pair", () => {
    expect(initials("🌱 Green Co")).toBe("🌱G");
    expect(initials("🚀Rocket Plumbing")).toBe("🚀P");
  });

  it("still works for ordinary names", () => {
    expect(initials("Priya Sharma")).toBe("PS");
    expect(initials("Theo")).toBe("T");
  });

  it("handles accented and non-Latin names", () => {
    expect(initials("Ángel Ruiz")).toBe("ÁR");
    expect(initials("张 伟")).toBe("张伟");
  });

  it("falls back for an empty name", () => {
    expect(initials("")).toBe("?");
    expect(initials(null)).toBe("?");
  });
});

describe("the font stack names an emoji fallback", () => {
  it("lists each platform's emoji font", () => {
    for (const font of ["Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"]) {
      expect(CSS).toContain(font);
    }
  });

  it("exposes the body font as a variable so the fallback can follow it", () => {
    expect(LAYOUT).toMatch(/variable: "--font-sans"/);
    expect(LAYOUT).toMatch(/className=\{manrope\.variable\}/);
  });

  it("makes form controls inherit, so typing matches the saved text", () => {
    expect(CSS).toMatch(/input,\s*\n\s*textarea,\s*\n\s*select,\s*\n\s*button \{\s*\n\s*font-family: inherit;/);
  });
});

describe("emoji survive the email path", () => {
  it("escapeHtml only touches the five HTML characters, never emoji", () => {
    const NOTIFY = readFileSync(join(process.cwd(), "src/server/notify.ts"), "utf8");
    const fn = NOTIFY.slice(NOTIFY.indexOf("export function escapeHtml"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    // Only &, <, >, " and ' are replaced — nothing strips or re-encodes.
    expect(body.match(/\.replace\(/g)?.length).toBe(5);
    expect(body).not.toMatch(/x00-\\x7F|normalize\(|ascii/i);
  });

  it("the email declares UTF-8 for clients that ignore the header", () => {
    const NOTIFY = readFileSync(join(process.cwd(), "src/server/notify.ts"), "utf8");
    expect(NOTIFY).toMatch(/<meta charset="utf-8">/);
  });
});

describe("nothing truncates mid-character", () => {
  it("no shared helper slices a raw string index for initials", () => {
    for (const f of [
      "src/lib/format.ts",
      "src/components/shared/business-logo.tsx",
      "src/components/shared/user-menu.tsx",
    ]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src).not.toMatch(/\.map\(\((\w)\) => \1\[0\]\)/);
      expect(src).toMatch(/\[\.\.\.\w\]\[0\]/);
    }
  });
});
