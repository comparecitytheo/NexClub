import { z } from "zod";

const blank = (v: unknown) => v === "" || v === null || v === undefined;

export const optionalText = (max = 255) =>
  z.preprocess((v) => (blank(v) ? undefined : v), z.string().max(max).optional());

export const optionalEmail = () =>
  z.preprocess((v) => (blank(v) ? undefined : v), z.string().email("Enter a valid email").optional());

export const optionalId = () =>
  z.preprocess((v) => (blank(v) ? undefined : v), z.string().optional());

export const optionalNumber = (min = 0) =>
  z.preprocess(
    (v) => (blank(v) ? undefined : typeof v === "string" ? Number(v) : v),
    z.number().min(min).optional()
  );

export const optionalDate = () =>
  z.preprocess((v) => (blank(v) ? undefined : new Date(v as string)), z.date().optional());

export const optionalTags = () =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.split(",").map((t) => t.trim()).filter(Boolean) : v),
    z.array(z.string().max(40)).optional()
  );
