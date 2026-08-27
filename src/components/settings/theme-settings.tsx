"use client";
import { useEffect, useMemo } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  THEME_TOKENS,
  DEFAULT_THEME,
  MIN_CONTRAST,
  contrastRatio,
  isValidHex,
  themeToCssText,
  type ThemePreferences,
  type ThemeTokenKey,
} from "@/lib/theme";

/**
 * Appearance settings — the user's own colours.
 *
 * Preview works by writing the same CSS variables the server writes on load, so
 * what you see while dragging a picker is exactly what you get after saving.
 * The preview is torn down on unmount, so navigating away without saving leaves
 * no trace.
 */
export function ThemeSettings({
  value,
  onChange,
}: {
  value: ThemePreferences;
  onChange: (next: ThemePreferences) => void;
}) {
  const theme = { ...DEFAULT_THEME, ...value };

  // Live preview: a style element carrying the in-progress theme, which beats
  // the server-rendered one because it is appended later in the document. Torn
  // down on unmount, so leaving without saving leaves no trace.
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "theme-preview";
    el.textContent = `:root { ${themeToCssText(theme)} }`;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(theme)]);

  function set(key: ThemeTokenKey, next: string) {
    onChange({ ...theme, [key]: next });
  }

  // Warn where a pairing would be hard to read. The server also enforces this
  // on save, so a bad pick cannot make the app unusable — this is the polite
  // heads-up before that happens.
  const warnings = useMemo(() => {
    const out: string[] = [];
    const primary = theme.primary ?? DEFAULT_THEME.primary;
    const buttonText = theme.buttonText ?? DEFAULT_THEME.buttonText;
    if (isValidHex(primary) && isValidHex(buttonText)) {
      const ratio = contrastRatio(primary, buttonText);
      if (ratio < MIN_CONTRAST) {
        out.push(
          `Button text on the brand colour is ${ratio.toFixed(1)}:1 — below the ${MIN_CONTRAST}:1 needed to read comfortably. It will be adjusted automatically when you save.`
        );
      }
    }
    const body = theme.foreground ?? DEFAULT_THEME.foreground;
    if (isValidHex(body) && contrastRatio(body, "#FFFFFF") < MIN_CONTRAST) {
      out.push(
        `Body text is ${contrastRatio(body, "#FFFFFF").toFixed(1)}:1 against the page background — pick something darker so it stays readable.`
      );
    }
    return out;
  }, [theme]);


  return (
    <div className="space-y-4 rounded-lg bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div>
        <h3 className="text-sm font-semibold">Appearance</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Your own colours. They follow your login, so they appear on any device you
          sign in from and never affect other members.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {THEME_TOKENS.map((token) => {
          const value = theme[token.key] ?? token.default;
          const valid = isValidHex(value);
          return (
            <div key={token.key} className="space-y-1.5">
              <Label htmlFor={`theme-${token.key}`}>{token.label}</Label>
              <div className="flex items-center gap-2">
                {/* Native picker: no dependency, and it gives every platform's
                    own colour UI, including eyedroppers where available. */}
                <input
                  type="color"
                  aria-label={`${token.label} colour picker`}
                  value={valid ? value : token.default}
                  onChange={(e) => set(token.key, e.target.value.toUpperCase())}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1"
                />
                <Input
                  id={`theme-${token.key}`}
                  value={value}
                  spellCheck={false}
                  onChange={(e) => set(token.key, e.target.value.toUpperCase())}
                  className={cn("font-mono", !valid && "border-destructive")}
                  placeholder={token.default}
                />
              </div>
              <p className="text-xs text-muted-foreground">{token.help}</p>
              {!valid && (
                <p className="text-xs text-destructive">Use a 6-digit hex value, e.g. {token.default}</p>
              )}
            </div>
          );
        })}
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 p-3">
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Reset restores the defaults in the preview immediately, so a user who
            has made the UI unreadable can see it fixed before saving. It is
            persisted by the page's single Save changes button. */}
        <Button variant="outline" onClick={() => onChange({ ...DEFAULT_THEME })}>
          <RotateCcw className="h-4 w-4" /> Reset to default
        </Button>
        <span className="text-xs text-muted-foreground">
          Colours save with the rest of your profile.
        </span>
      </div>
    </div>
  );
}
