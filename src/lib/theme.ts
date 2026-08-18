/**
 * THEME TOKENS
 *
 * The app's colours already live as HSL triplets in CSS custom properties on
 * :root (src/app/globals.css), and tailwind.config.ts maps every colour to
 * `hsl(var(--x))`. So changing a variable at runtime restyles the whole CRM with
 * no rebuild — this module is only the bridge between a user's saved hex values
 * and those variables.
 *
 * TO ADD A NEW THEMEABLE COLOUR: add one entry to THEME_TOKENS below. The
 * settings UI, validation, persistence and runtime application all read from
 * this list, so nothing else needs touching.
 */

export type ThemeTokenKey =
  | "primary"
  | "foreground"
  | "heading"
  | "sidebar"
  | "buttonText"
  | "announcement";

export type ThemeToken = {
  key: ThemeTokenKey;
  label: string;
  help: string;
  /** The CSS custom property this drives, without the leading `--`. */
  cssVar: string;
  /** App default, as hex. Mirrors the value in globals.css. */
  default: string;
  /**
   * When set, this token is a background that text sits on, and the named token
   * is the text colour that must stay readable against it.
   */
  contrastPartner?: ThemeTokenKey;
};

export const THEME_TOKENS: ThemeToken[] = [
  {
    key: "primary",
    label: "Primary / brand",
    help: "Buttons, links, active states and highlights.",
    cssVar: "primary",
    default: "#7B1E3A",
    contrastPartner: "buttonText",
  },
  {
    key: "sidebar",
    label: "Menu / navigation",
    help: "The left navigation bar background.",
    cssVar: "sidebar",
    default: "#7B1E3A",
  },
  {
    key: "foreground",
    label: "Body text",
    help: "Default text colour throughout the app.",
    cssVar: "foreground",
    default: "#171717",
  },
  {
    key: "heading",
    label: "Heading text",
    help: "Page and section headings.",
    cssVar: "heading",
    default: "#0A0A0A",
  },
  {
    key: "buttonText",
    label: "Button text",
    help: "Text sitting on primary-coloured buttons.",
    cssVar: "primary-foreground",
    default: "#FFFFFF",
  },  {
    key: "announcement",
    label: "Announcement bar",
    help: "The scrolling banner across the top. Pick something that stands out — it is meant to be noticed.",
    cssVar: "announce",
    default: "#FF5F1F",
  },
];

export type ThemePreferences = Partial<Record<ThemeTokenKey, string>>;

export const DEFAULT_THEME: Record<ThemeTokenKey, string> = THEME_TOKENS.reduce(
  (acc, t) => ({ ...acc, [t.key]: t.default }),
  {} as Record<ThemeTokenKey, string>
);

export const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/;

export function isValidHex(value: string): boolean {
  return HEX_PATTERN.test(value.trim());
}

/** "#7B1E3A" -> { r, g, b } */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = HEX_PATTERN.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * "#7B1E3A" -> "342 61% 30%" — the space-separated HSL form the CSS variables
 * use, so a value can be dropped straight into `hsl(var(--x))`.
 */
export function hexToHslTriplet(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Move a colour towards mid-grey, for deriving secondary text from body text.
 * `amount` 0 = unchanged, 1 = fully grey.
 */
export function mixTowardsGrey(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const t = Math.min(1, Math.max(0, amount));
  const mix = (c: number) => Math.round(c + (128 - c) * t);
  const to2 = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to2(mix(rgb.r))}${to2(mix(rgb.g))}${to2(mix(rgb.b))}`.toUpperCase();
}

/** Relative luminance, per WCAG 2.x. */
function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** WCAG contrast ratio between two hex colours, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Text colour for the announcement bar.
 *
 * Deliberately NOT the strict WCAG comparison used for buttons and the menu.
 * The default fluro orange is a light colour by the numbers — black scores
 * 6.2:1 against it, white only 3.0:1 — so the strict rule flips the banner to
 * black text, which is not what the brand wants.
 *
 * A luminance threshold matches how the colour actually reads: white text on
 * anything up to a mid-tone, dark text only once the background is genuinely
 * pale (yellow, cream, light grey) and white would disappear.
 */
export function bannerTextOn(background: string): string {
  return luminance(background) > 0.5 ? "#111111" : "#FFFFFF";
}

/** Whichever of black or white reads better on the given background. */
export function readableTextOn(background: string): string {
  return contrastRatio(background, "#FFFFFF") >= contrastRatio(background, "#111111")
    ? "#FFFFFF"
    : "#111111";
}

export const MIN_CONTRAST = 4.5; // WCAG AA for normal text

/**
 * Turn a saved theme into CSS variable declarations.
 *
 * Contrast is enforced here rather than only warned about in the UI: if the
 * chosen button text would be unreadable on the chosen brand colour, it is
 * swapped for black or white, whichever passes. That means a user can never
 * save a combination that makes the interface unusable — the reset button is a
 * convenience, not the only way out.
 */
export function themeToCssVars(theme: ThemePreferences): Record<string, string> {
  const merged = { ...DEFAULT_THEME, ...theme };
  const vars: Record<string, string> = {};

  for (const token of THEME_TOKENS) {
    let value = merged[token.key];
    if (!isValidHex(value)) value = token.default;

    if (token.key === "buttonText") {
      const bg = isValidHex(merged.primary) ? merged.primary : DEFAULT_THEME.primary;
      if (contrastRatio(bg, value) < MIN_CONTRAST) value = readableTextOn(bg);
    }

    const hsl = hexToHslTriplet(value);
    if (hsl) vars[`--${token.cssVar}`] = hsl;
  }

  // Secondary text (hints, descriptions, table meta) is derived from the chosen
  // body colour rather than left at a fixed grey. Without this, picking a new
  // body colour changed only some of the text on screen and the result looked
  // half-applied — which is exactly how it reads when the two disagree.
  const body = isValidHex(merged.foreground) ? merged.foreground : DEFAULT_THEME.foreground;
  // 0.876 is chosen so the DEFAULT body colour reproduces the existing
  // --muted-foreground exactly — the theme changes nothing until a user does.
  const mutedHsl = hexToHslTriplet(mixTowardsGrey(body, 0.876));
  if (mutedHsl) vars["--muted-foreground"] = mutedHsl;

  // The nav bar carries text and icons on it, so its foreground has to follow
  // whatever background the user picked or the menu becomes unreadable.
  const sidebarBg = isValidHex(merged.sidebar) ? merged.sidebar : DEFAULT_THEME.sidebar;
  const sidebarFg = hexToHslTriplet(readableTextOn(sidebarBg));
  if (sidebarFg) vars["--sidebar-foreground"] = sidebarFg;

  // Same rule for the announcement bar: it carries text on a colour the user
  // chose, and the whole point of the bar is to be read. Left at fixed white, a
  // pale yellow or lime banner would be illegible.
  const announceBg = isValidHex(merged.announcement)
    ? merged.announcement
    : DEFAULT_THEME.announcement;
  const announceFg = hexToHslTriplet(bannerTextOn(announceBg));
  if (announceFg) vars["--announce-foreground"] = announceFg;

  // `--ring` (focus outlines) tracks the brand colour, as it does by default.
  if (vars["--primary"]) vars["--ring"] = vars["--primary"];

  return vars;
}

/** Serialise to a `--x: v;` string for a <style> tag or an inline style attr. */
export function themeToCssText(theme: ThemePreferences): string {
  return Object.entries(themeToCssVars(theme))
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");
}
