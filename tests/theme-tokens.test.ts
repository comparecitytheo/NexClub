import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { THEME_TOKENS, themeToCssVars } from "@/lib/theme";

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const SCHEMA = readFileSync(join(process.cwd(), "src/server/validators/profile.ts"), "utf8");

describe("the announcement bar is themeable", () => {
  it("is offered as a token in Appearance", () => {
    const t = THEME_TOKENS.find((x) => x.key === "announcement");
    expect(t).toBeTruthy();
    expect(t?.cssVar).toBe("announce");
  });

  it("keeps the original orange as its default", () => {
    expect(THEME_TOKENS.find((x) => x.key === "announcement")?.default).toBe("#FF5F1F");
  });

  it("the schema accepts it — .strict() would reject the whole save otherwise", () => {
    expect(SCHEMA).toMatch(/announcement: hex\.optional\(\)/);
  });

  it("the bar reads the variable, not a hardcoded colour", () => {
    expect(CSS).toMatch(/background: hsl\(var\(--announce/);
    expect(CSS).not.toMatch(/\.announce \{[^}]*background: #FF5F1F/);
  });

  it("falls back to the original orange when nobody has set one", () => {
    // 17 100% 56% is #FF5F1F — a wrong fallback would silently recolour the bar
    // for every member who has never opened Appearance.
    expect(CSS).toMatch(/--announce, 17 100% 56%/);
  });

  it("a chosen colour reaches the CSS variable", () => {
    const vars = themeToCssVars({ announcement: "#1D4ED8" });
    expect(vars["--announce"]).toBe("224 76% 48%");
  });
});


describe("the announcement bar text stays readable", () => {
  it("stays WHITE on the default fluro orange", () => {
    // The strict WCAG comparison used for buttons picks black here (6.2:1 vs
    // 3.0:1) because that orange is light by the numbers. The banner uses a
    // luminance threshold instead, so it reads the way the colour looks.
    expect(themeToCssVars({ announcement: "#FF5F1F" })["--announce-foreground"]).toBe("0 0% 100%");
  });

  it("goes white on a dark banner", () => {
    expect(themeToCssVars({ announcement: "#7B1E3A" })["--announce-foreground"]).toBe("0 0% 100%");
  });

  it("goes near-black on a pale banner", () => {
    // A pale yellow banner with fixed white text would be unreadable, which
    // defeats the point of an announcement.
    expect(themeToCssVars({ announcement: "#FFE066" })["--announce-foreground"]).toBe("0 0% 7%");
  });

  it("sits under Heading text in the Appearance grid", () => {
    // Two columns, filled left to right: Announcement must be 6th so it lands
    // directly beneath Heading text.
    const order = THEME_TOKENS.map((t) => t.key);
    expect(order).toEqual([
      "primary",
      "sidebar",
      "foreground",
      "heading",
      "buttonText",
      "announcement",
    ]);
  });
});
