import { describe, it, expect } from "vitest";
import {
  THEME_TOKENS,
  DEFAULT_THEME,
  MIN_CONTRAST,
  contrastRatio,
  hexToHslTriplet,
  isValidHex,
  readableTextOn,
  themeToCssVars,
  mixTowardsGrey,
} from "@/lib/theme";

describe("hex validation", () => {
  it("accepts 6-digit hex", () => {
    expect(isValidHex("#7B1E3A")).toBe(true);
    expect(isValidHex("#ffffff")).toBe(true);
  });

  it("rejects anything that is not a 6-digit hex", () => {
    for (const bad of ["7B1E3A", "#FFF", "#GGGGGG", "red", "", "#7B1E3A;color:red"]) {
      expect(isValidHex(bad)).toBe(false);
    }
  });
});

describe("hex to the HSL triplet the CSS variables use", () => {
  it("converts the brand burgundy to its existing :root value", () => {
    // globals.css ships `--primary: 342 61% 30%` — the conversion must agree,
    // or saving the default would visibly shift the brand colour.
    expect(hexToHslTriplet("#7B1E3A")).toBe("342 61% 30%");
  });

  it("handles pure white and black", () => {
    expect(hexToHslTriplet("#FFFFFF")).toBe("0 0% 100%");
    expect(hexToHslTriplet("#000000")).toBe("0 0% 0%");
  });

  it("returns null for an invalid value rather than emitting broken CSS", () => {
    expect(hexToHslTriplet("nonsense")).toBeNull();
  });
});

describe("contrast", () => {
  it("scores white on burgundy as comfortably readable", () => {
    expect(contrastRatio("#7B1E3A", "#FFFFFF")).toBeGreaterThan(MIN_CONTRAST);
  });

  it("scores near-identical colours as unreadable", () => {
    expect(contrastRatio("#7B1E3A", "#7B1E3B")).toBeLessThan(1.1);
  });

  it("picks whichever of black or white reads better", () => {
    expect(readableTextOn("#FFFFFF")).toBe("#111111");
    expect(readableTextOn("#000000")).toBe("#FFFFFF");
    expect(readableTextOn("#7B1E3A")).toBe("#FFFFFF");
  });
});

describe("turning a theme into CSS variables", () => {
  it("emits a variable for every token", () => {
    const vars = themeToCssVars(DEFAULT_THEME);
    for (const t of THEME_TOKENS) {
      expect(vars[`--${t.cssVar}`]).toBeTruthy();
    }
  });

  it("falls back to the default when a value is invalid", () => {
    const vars = themeToCssVars({ primary: "not-a-colour" });
    expect(vars["--primary"]).toBe(hexToHslTriplet(DEFAULT_THEME.primary));
  });

  it("overrides unreadable button text so the UI can never become unusable", () => {
    // Dark text on a dark brand colour would be invisible. The server swaps it
    // rather than trusting the picker, so a bad save cannot lock anyone out.
    const vars = themeToCssVars({ primary: "#111111", buttonText: "#222222" });
    expect(vars["--primary-foreground"]).toBe(hexToHslTriplet("#FFFFFF"));
  });

  it("leaves a readable pairing alone", () => {
    const vars = themeToCssVars({ primary: "#7B1E3A", buttonText: "#FFFFFF" });
    expect(vars["--primary-foreground"]).toBe(hexToHslTriplet("#FFFFFF"));
  });

  it("derives nav text from the chosen menu colour", () => {
    // A light menu needs dark text; the user never picks this directly.
    expect(themeToCssVars({ sidebar: "#FFFFFF" })["--sidebar-foreground"]).toBe(
      hexToHslTriplet("#111111")
    );
    expect(themeToCssVars({ sidebar: "#111111" })["--sidebar-foreground"]).toBe(
      hexToHslTriplet("#FFFFFF")
    );
  });

  it("keeps focus rings on the brand colour", () => {
    const vars = themeToCssVars({ primary: "#2563EB" });
    expect(vars["--ring"]).toBe(vars["--primary"]);
  });

  it("ignores unknown keys instead of emitting stray CSS", () => {
    const vars = themeToCssVars({ nope: "#123456" } as never);
    expect(Object.keys(vars).every((k) => k.startsWith("--"))).toBe(true);
    expect(vars["--nope"]).toBeUndefined();
  });
});

describe("secondary text follows the body colour", () => {
  it("reproduces the existing grey for the default body colour", () => {
    // The theme must change nothing until a user actually picks something, so
    // the default body must map onto the --muted-foreground already shipped.
    expect(mixTowardsGrey(DEFAULT_THEME.foreground, 0.876)).toBe("#737373");
  });

  it("emits a muted colour derived from whatever body colour is chosen", () => {
    const vars = themeToCssVars({ foreground: "#B61111" });
    expect(vars["--muted-foreground"]).toBeTruthy();
    // Derived, not the fixed default — otherwise half the page keeps the old grey.
    expect(vars["--muted-foreground"]).not.toBe(
      themeToCssVars({ foreground: DEFAULT_THEME.foreground })["--muted-foreground"]
    );
  });

  it("leaves an invalid body colour on the default grey", () => {
    const vars = themeToCssVars({ foreground: "nope" });
    expect(vars["--muted-foreground"]).toBe(
      themeToCssVars({ foreground: DEFAULT_THEME.foreground })["--muted-foreground"]
    );
  });
});
