"use client";
import type { ReportBlock } from "@/components/admin/club-report";

/**
 * How a custom report block is drawn.
 *
 * Four modes rather than one, because the same rows answer different questions:
 * bars compare, a table gives exact figures, a KPI gives the single total, and
 * a donut shows share of the whole. Everything is plain SVG and divs — no
 * charting library, matching how the club-wide cards already draw their bars.
 */
export type VizMode = "bars" | "table" | "kpi" | "donut";

/** Matches the report builder's palette so a chart reads the same everywhere. */
export const PALETTE = ["#7B1E3A", "#2563eb", "#16a34a", "#f59e0b", "#8b5cf6"] as const;

function metricKeyOf(block: ReportBlock) {
  return block.columns.find((c) => !["name", "label", "month"].includes(c.key))?.key ?? null;
}

function rowsOf(block: ReportBlock, limit = 10) {
  const key = metricKeyOf(block);
  if (!key) return [];
  return block.rows
    .map((r) => ({
      label: String(Object.values(r.dimensions)[0] ?? "—"),
      value: Number(r.metrics[key]) || 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

const isMoney = (block: ReportBlock) => block.key.startsWith("revenue.") || block.key.includes("value");

function fmt(n: number, money: boolean) {
  return money
    ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n)
    : new Intl.NumberFormat("en-AU").format(n);
}

export function BlockViz({ block, mode }: { block: ReportBlock; mode: VizMode }) {
  const rows = rowsOf(block);
  const money = isMoney(block);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No data for this metric in this period.</p>;
  }

  if (mode === "kpi") {
    // The single number the block adds up to — useful when the breakdown is
    // noise and only the total matters.
    const total = rows.reduce((t, r) => t + r.value, 0);
    return (
      <div>
        <p className="text-3xl font-extrabold tabular-nums">{fmt(total, money)}</p>
        <p className="text-xs text-muted-foreground">
          across {rows.length} {rows.length === 1 ? "entry" : "entries"}
        </p>
      </div>
    );
  }

  if (mode === "table") {
    return (
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b last:border-0">
              <td className="py-1.5 pr-3">{r.label}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{fmt(r.value, money)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (mode === "donut") {
    const total = rows.reduce((t, r) => t + r.value, 0) || 1;
    const R = 58, r0 = 40, cx = 68, cy = 68;
    const pt = (rad: number, ang: number) =>
      `${(cx + rad * Math.cos(ang)).toFixed(3)} ${(cy + rad * Math.sin(ang)).toFixed(3)}`;
    let a = -Math.PI / 2;
    const segs = rows.slice(0, 6).map((row, i) => {
      const frac = row.value / total;
      const colour = PALETTE[i % PALETTE.length];
      // A single segment covering everything makes start === end, which draws
      // nothing; a full ring is the honest rendering.
      if (frac >= 0.999) {
        return <circle key={row.label} cx={cx} cy={cy} r={(R + r0) / 2} fill="none" stroke={colour} strokeWidth={R - r0} />;
      }
      const b = a + frac * 2 * Math.PI;
      const big = b - a > Math.PI ? 1 : 0;
      const d = `M ${pt(R, a)} A ${R} ${R} 0 ${big} 1 ${pt(R, b)} L ${pt(r0, b)} A ${r0} ${r0} 0 ${big} 0 ${pt(r0, a)} Z`;
      a = b;
      return <path key={row.label} d={d} fill={colour} />;
    });
    return (
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 136 136" className="h-32 w-32 shrink-0" role="img" aria-label={block.title}>
          {segs}
        </svg>
        <ul className="min-w-0 flex-1 space-y-1">
          {rows.slice(0, 6).map((r, i) => (
            <li key={r.label} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className="font-semibold tabular-nums">{fmt(r.value, money)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // bars — the default, and the same proportional treatment the club-wide cards use
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-[38%] shrink-0 truncate">{r.label}</span>
          <span className="h-2 flex-1 rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${Math.max(2, Math.round((r.value / max) * 100))}%` }}
            />
          </span>
          <span className="w-24 shrink-0 text-right font-semibold tabular-nums">{fmt(r.value, money)}</span>
        </li>
      ))}
    </ul>
  );
}
