// Shared date-range logic used by the date-range picker (client) and by the
// pages that filter their data by it (server). The range lives in the URL as
// either ?range=7|30|90 (last N days) or ?from=YYYY-MM-DD&to=YYYY-MM-DD (custom).

export const RANGE_DAYS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];
export const DEFAULT_RANGE_DAYS: RangeDays = 30;

export type DateRangeParams = { range?: string; from?: string; to?: string };

// Next 15 searchParams values are string | string[] | undefined — normalise to
// single strings the picker and resolver can use.
export function readRangeParams(sp: Record<string, string | string[] | undefined>): DateRangeParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return { range: one(sp.range), from: one(sp.from), to: one(sp.to) };
}

// Turn the params into a concrete { from, to } window for Prisma filtering.
// Custom (valid from+to) wins; otherwise last N days; otherwise the 30-day
// default. `to` is end-of-day so the range is inclusive.
export function resolveDateRange(p: DateRangeParams): { from: Date; to: Date } {
  if (p.from && p.to) {
    const f = new Date(p.from);
    const t = new Date(p.to);
    if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime())) {
      f.setHours(0, 0, 0, 0);
      t.setHours(23, 59, 59, 999);
      return f <= t ? { from: f, to: t } : { from: t, to: f };
    }
  }
  const n = Number(p.range);
  const days = (RANGE_DAYS as readonly number[]).includes(n) ? n : DEFAULT_RANGE_DAYS;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}
