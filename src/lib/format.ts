// Coerce Prisma Decimal | string | number | null into a number, or null.
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "object" ? Number((value as { toString(): string }).toString()) : Number(value);
  return Number.isNaN(n) ? null : n;
}

export function formatCurrency(value: unknown, currency = "AUD"): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export function formatDate(value?: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

/**
 * Date AND time, in the same en-AU style as formatDate.
 *
 * "02 Jun 2026, 9:15 am" — the date reads identically to formatDate everywhere
 * else in the app, with the time appended, so the two never look like different
 * conventions sitting side by side.
 */
export function formatDateTime(value?: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatRelative(value?: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diff < 0) return formatDate(d);
  if (diff < day) return "Today";
  if (diff < 2 * day) return "Yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  return formatDate(d);
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
