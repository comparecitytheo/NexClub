"use client";
import type { ReportBlock } from "@/components/admin/club-report";

/**
 * Results for the custom builder, in whichever view mode is chosen.
 *
 * A separate component from ClubReport on purpose: the club-wide cards render
 * bars and tables only, and the brief was explicit that their rendering must not
 * change. This adds KPI and donut for the builder without touching them.
 *
 * The palette matches the printed report and the club-wide chart colours, so a
 * metric keeps its colour wherever it appears.
 */
const PALETTE = ["#7B1E3A", "#2563eb", "#16a34a", "#f59e0b", "#8b5cf6"] as const;

/**
 * Each metric declares its own natural view in the report definitions —
 * leaderboard, bar, kpi, pie or line. There is no picker: a revenue leaderboard
 * wants ranked bars and a status breakdown wants a ring, and asking the reader
 * to choose per report only invites the wrong one.
 */
function viewFor(viz: string): "bars" | "table" | "kpi" | "donut" {
  if (viz === "pie") return "donut";
  if (viz === "kpi") return "kpi";
  if (viz === "table") return "table";
  // bar, line and leaderboard all read best as ranked bars on this scale.
  return "bars";
}

const nf = new Intl.NumberFormat("en-AU");
const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

/** A block's first non-label column is its headline metric. */
function metricKeyOf(b: ReportBlock) {
  return b.columns.find((c) => !["name", "label", "month"].includes(c.key))?.key ?? null;
}
function isMoney(b: ReportBlock) {
  const k = metricKeyOf(b);
  const col = b.columns.find((c) => c.key === k);
  return /revenue|value|amount/i.test(`${col?.key ?? ""} ${col?.label ?? ""}`);
}
function rowsOf(b: ReportBlock) {
  const k = metricKeyOf(b);
  if (!k) return [];
  return b.rows
    .map((r) => ({
      label: String(Object.values(r.dimensions)[0] ?? "—"),
      value: Number(r.metrics[k]) || 0,
    }))
    .sort((a, z) => z.value - a.value);
}
const fmt = (n: number, m: boolean) => (m ? money.format(n) : nf.format(n));

function Bars({ block }: { block: ReportBlock }) {
  const rows = rowsOf(block).slice(0, 10);
  const max = Math.max(...rows.map((r) => r.value), 1);
  const m = isMoney(block);
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b last:border-0">
            <td className="w-[38%] py-1.5 pr-3 text-sm">{r.label}</td>
            <td className="py-1.5">
              <span className="block h-2 w-full rounded-sm bg-muted">
                <span
                  className="block h-full rounded-sm"
                  style={{
                    width: `${Math.max(2, Math.round((r.value / max) * 100))}%`,
                    background: PALETTE[0],
                  }}
                />
              </span>
            </td>
            <td className="w-[20%] py-1.5 pl-3 text-right text-sm font-semibold tabular-nums">
              {fmt(r.value, m)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Table({ block }: { block: ReportBlock }) {
  const m = isMoney(block);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {block.columns.map((c) => (
              <th key={c.key} className="py-1.5 pr-3 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.slice(0, 25).map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {block.columns.map((c) => {
                const v = r.dimensions[c.key] ?? r.metrics[c.key];
                const num = typeof v === "number";
                return (
                  <td
                    key={c.key}
                    className={num ? "py-1.5 pr-3 tabular-nums" : "py-1.5 pr-3"}
                  >
                    {num ? fmt(v as number, m) : String(v ?? "—")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ block }: { block: ReportBlock }) {
  const rows = rowsOf(block);
  const total = rows.reduce((t, r) => t + r.value, 0);
  const m = isMoney(block);
  return (
    <div>
      <p className="text-3xl font-extrabold tabular-nums">{fmt(total, m)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        across {nf.format(rows.length)} {rows.length === 1 ? "entry" : "entries"}
        {rows.length > 0 ? ` · top: ${rows[0].label} (${fmt(rows[0].value, m)})` : ""}
      </p>
    </div>
  );
}

function Donut({ block }: { block: ReportBlock }) {
  const rows = rowsOf(block).slice(0, 5);
  const total = rows.reduce((t, r) => t + r.value, 0) || 1;
  const m = isMoney(block);
  const R = 58, r0 = 40, cx = 68, cy = 68;
  const pt = (rad: number, ang: number) =>
    `${(cx + rad * Math.cos(ang)).toFixed(3)} ${(cy + rad * Math.sin(ang)).toFixed(3)}`;

  let a = -Math.PI / 2;
  const segs = rows.map((row, i) => {
    const frac = row.value / total;
    const colour = PALETTE[i % PALETTE.length];
    // A single segment covering everything makes start === end, which draws
    // nothing; a full ring is the honest rendering there.
    if (frac >= 0.999) {
      return (
        <circle key={row.label} cx={cx} cy={cy} r={(R + r0) / 2} fill="none"
          stroke={colour} strokeWidth={R - r0} />
      );
    }
    const b = a + frac * 2 * Math.PI;
    const big = b - a > Math.PI ? 1 : 0;
    const d = `M ${pt(R, a)} A ${R} ${R} 0 ${big} 1 ${pt(R, b)} L ${pt(r0, b)} A ${r0} ${r0} 0 ${big} 0 ${pt(r0, a)} Z`;
    a = b;
    return <path key={row.label} d={d} fill={colour} />;
  });

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data.</p>;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 136 136" className="h-32 w-32 shrink-0" role="img" aria-label={block.title}>
        {segs}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {rows.map((r, i) => (
          <li key={r.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            <span className="font-semibold tabular-nums">{fmt(r.value, m)}</span>
            <span className="w-10 text-right text-muted-foreground tabular-nums">
              {Math.round((r.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CustomResults({ blocks }: { blocks: ReportBlock[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {blocks.map((b) => (
        <section
          key={b.key}
          className="rounded-xl bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]"
        >
          <h3 className="mb-3 text-sm font-semibold">{b.title}</h3>
          {b.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No data for this period.
            </p>
          ) : viewFor(b.viz) === "table" ? (
            <Table block={b} />
          ) : viewFor(b.viz) === "kpi" ? (
            <Kpi block={b} />
          ) : viewFor(b.viz) === "donut" ? (
            <Donut block={b} />
          ) : (
            <Bars block={b} />
          )}
        </section>
      ))}
    </div>
  );
}
