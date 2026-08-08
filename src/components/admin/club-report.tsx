"use client";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";

export type ReportBlock = {
  key: string;
  title: string;
  caption: string;
  viz: "bar" | "line" | "table";
  columns: { key: string; label: string; format?: string }[];
  rows: { dimensions: Record<string, string | number | null>; metrics: Record<string, number> }[];
};

function fmt(value: number, format?: string) {
  if (format === "currency") return formatCurrency(value);
  if (format === "percent") return `${Math.round(value)}%`;
  return new Intl.NumberFormat("en-AU").format(value);
}

/** First dimension is the label; first metric is the value we chart. */
function shape(block: ReportBlock) {
  const dimKey = Object.keys(block.rows[0]?.dimensions ?? {})[0];
  const metricKey = Object.keys(block.rows[0]?.metrics ?? {})[0];
  const col = block.columns.find((c) => c.key === metricKey);
  const items = block.rows
    .map((r) => ({
      label: String(r.dimensions[dimKey ?? ""] ?? "Unattributed"),
      value: Number(r.metrics[metricKey ?? ""] ?? 0),
    }))
    .filter((i) => Number.isFinite(i.value))
    .sort((a, b) => b.value - a.value);
  return { items, format: col?.format, metricLabel: col?.label ?? "Value" };
}

// Bars are plain divs rather than a charting library: no new dependency, and a
// proportional bar is all these comparisons need.
function BarList({ block }: { block: ReportBlock }) {
  const { items, format, metricLabel } = shape(block);
  const max = Math.max(...items.map((i) => i.value), 1);
  const top = items.slice(0, 10);

  return (
    <div className="space-y-2">
      {top.map((i) => (
        <div key={i.label} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm">{i.label}</span>
          <span className="h-6 min-w-0 flex-1 overflow-hidden rounded bg-muted">
            <span
              className="block h-full rounded bg-primary"
              style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }}
              aria-hidden="true"
            />
          </span>
          <span className="w-28 shrink-0 text-right text-sm font-medium tabular-nums">
            {fmt(i.value, format)}
          </span>
        </div>
      ))}
      <p className="pt-1 text-xs text-muted-foreground">
        {metricLabel}
        {items.length > top.length ? ` — top ${top.length} of ${items.length}` : ""}
      </p>
    </div>
  );
}

function TableBlock({ block }: { block: ReportBlock }) {
  const { items, format } = shape(block);
  const total = items.reduce((sum, i) => sum + i.value, 0) || 1;
  return (
    <div className="overflow-hidden rounded-lg border">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
          <span className="min-w-0 flex-1 truncate text-sm">{i.label}</span>
          <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">
            {fmt(i.value, format)}
          </span>
          <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
            {Math.round((i.value / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function ClubReport({ blocks }: { blocks: ReportBlock[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {blocks.map((b) => (
        <section
          key={b.key}
          className="rounded-xl bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]"
        >
          <h3 className="text-sm font-semibold">{b.title}</h3>
          <p className="mb-3 text-xs text-muted-foreground">{b.caption}</p>
          {b.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No data for this period.
            </p>
          ) : b.viz === "table" ? (
            <TableBlock block={b} />
          ) : (
            <BarList block={b} />
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * Who the report is about. Options are BUSINESSES, not individual members, with
 * the director named in brackets — that is how the club thinks about who is
 * performing. Selecting one reruns every block scoped to that whole business,
 * covering all of its members rather than just the director.
 */
export function MemberPicker({
  businesses,
  value,
}: {
  businesses: { key: string; name: string; director: string }[];
  value: string;
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Showing</span>
      <select
        value={value}
        aria-label="Report scope"
        onChange={(e) => {
          // Read the live query string in the handler rather than useSearchParams,
          // which would force a Suspense boundary around this component.
          const next = new URLSearchParams(window.location.search);
          if (e.target.value === "all") next.delete("member");
          else next.set("member", e.target.value);
          router.push(`/admin/reports?${next.toString()}`);
        }}
        className="h-9 max-w-[16rem] truncate rounded-md border border-input bg-card px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="all">Club-wide (all businesses)</option>
        {businesses.map((b) => (
          <option key={b.key} value={b.key}>
            {b.name === b.director ? b.name : `${b.name} (${b.director})`}
          </option>
        ))}
      </select>
    </label>
  );
}
