import { z } from "zod";
import { optionalText } from "./shared";

// Theme colours are validated as hex here, on the SERVER, so a crafted request
// cannot inject arbitrary CSS through a colour value.
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour, e.g. #7B1E3A");
export const themePreferencesSchema = z
  .object({
    primary: hex.optional(),
    foreground: hex.optional(),
    heading: hex.optional(),
    sidebar: hex.optional(),
    buttonText: hex.optional(),
  })
  .strict();

export const updateProfileSchema = z.object({
  // `name` is deliberately ABSENT, like businessName. Both a member's own name
  // and their business name are changed by a Super Admin only, from the Admin
  // panel — so what one member is called cannot be altered unilaterally.
  // businessName is deliberately ABSENT. It used to be here, which let any user
  // move themselves into another business by typing its name — and let a
  // business admin invite staff into a business they did not belong to.
  // Membership is changed only by an invitation or a Super Admin; see
  // src/server/businesses.ts.
  industry: optionalText(120),
  services: optionalText(2000),
  phone: optionalText(40),
  bio: optionalText(2000),
  // Per-user theme. Optional, so the profile form can omit it entirely.
  themePreferences: themePreferencesSchema.optional(),
});
