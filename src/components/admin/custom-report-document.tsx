import Image from "next/image";
import type { ReportBlock } from "@/components/admin/club-report";

/**
 * The printed custom report.
 *
 * Deliberately the same document design as the club-wide export — masthead with
 * the logo left and period right, a brand rule, numbered sections with hairline
 * tables and proportion bars. A club owner should not be able to tell the two
 * apart at a glance; only the contents differ.
 *
 * Each metric prints in its own natural view, exactly as it appears on screen.
 */
const PALETTE = ["#7B1E3A", "#2563eb", "#16a34a", "#f59e0b", "#8b5cf6"] as const;

const nf = new Intl.NumberFormat("en-AU");
const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});
const day = (d: Date) =>
  new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric" }).format(d);

function metricKeyOf(b: ReportBlock) {
  return b.columns.find((c) => !["name", "label", "month"].includes(c.key))?.key ?? null;
}
function isMoney(b: ReportBlock) {
  const k = metricKeyOf(b);
  const col = b.columns.find((c) => c.key === k);
  return /revenue|value|amount/i.test(`${col?.key ?? ""} ${col?.label ?? ""}`);
}
function rowsOf(b: ReportBlock, limit = 10) {
  const k = metricKeyOf(b);
  if (!k) return [];
  return b.rows
    .map((r) => ({
      label: String(Object.values(r.dimensions)[0] ?? "—"),
      value: Number(r.metrics[k]) || 0,
    }))
    .sort((a, z) => z.value - a.value)
    .slice(0, limit);
}
const fmt = (n: number, m: boolean) => (m ? money.format(n) : nf.format(n));

function Ranked({ rows, m, tint }: { rows: { label: string; value: number }[]; m: boolean; tint: string }) {
  if (rows.length === 0) return <p className="text-[11px] text-neutral-500">Nothing recorded.</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-neutral-200 last:border-0">
            <td className="w-[38%] py-1.5 pr-3 text-[11px]">{r.label}</td>
            <td className="py-1.5">
              {/* A proportion bar rather than a chart: survives greyscale
                  printing and needs no legend. */}
              <span className="block h-[5px] w-full bg-neutral-100">
                <span className="block h-full"
                  style={{ width: `${Math.max(2, Math.round((r.value / max) * 100))}%`, background: tint }} />
              </span>
            </td>
            <td className="w-[18%] py-1.5 pl-3 text-right text-[11px] font-semibold tabular-nums">
              {fmt(r.value, m)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PrintDonut({ rows, m }: { rows: { label: string; value: number }[]; m: boolean }) {
  const total = rows.reduce((t, r) => t + r.value, 0) || 1;
  const R = 52, r0 = 36, cx = 60, cy = 60;
  const pt = (rad: number, ang: number) =>
    `${(cx + rad * Math.cos(ang)).toFixed(3)} ${(cy + rad * Math.sin(ang)).toFixed(3)}`;
  let a = -Math.PI / 2;
  const segs = rows.map((row, i) => {
    const frac = row.value / total;
    const colour = PALETTE[i % PALETTE.length];
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
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 120 120" className="h-[120px] w-[120px] shrink-0">{segs}</svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {rows.map((r, i) => (
          <li key={r.label} className="flex items-center gap-2 text-[10px]">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            <span className="font-semibold tabular-nums">{fmt(r.value, m)}</span>
            <span className="w-9 text-right text-neutral-500 tabular-nums">
              {Math.round((r.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CustomReportDocument({
  blocks,
  scope,
  from,
  to,
}: {
  blocks: ReportBlock[];
  scope: string | null;
  from: Date | null;
  to: Date | null;
}) {
  if (blocks.length === 0) return null;

  return (
    <article className="custom-report-print hidden text-neutral-900 print:block">
      {/* Masthead, matching the club-wide export. */}
      <header className="flex items-end justify-between">
        <Image src="/report-logo.svg" alt="NEX Club" width={92} height={92} priority />
        <div className="pb-1 text-right">
          <h1 className="text-[22px] font-extrabold leading-none tracking-tight">NEX Custom Report</h1>
          {from && to ? (
            <p className="mt-1.5 text-[12px] font-semibold text-neutral-600">
              {day(from)} &ndash; {day(to)}
            </p>
          ) : null}
          <p className="mt-0.5 text-[10px] text-neutral-500">{scope ?? "Club-wide, all businesses"}</p>
        </div>
      </header>

      <div className="mt-3 h-[3px] w-full bg-[color:hsl(var(--primary))]" />

      {blocks.map((b, i) => {
        const m = isMoney(b);
        const rows = rowsOf(b, b.viz === "pie" ? 5 : 10);
        const tint = PALETTE[i % PALETTE.length];
        const total = rows.reduce((t, r) => t + r.value, 0);
        return (
          <section key={b.key} className="mt-7 break-inside-avoid">
            <div className="flex items-baseline gap-3 border-b border-neutral-900 pb-1.5">
              <span className="text-[10px] font-bold tabular-nums" style={{ color: tint }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.08em]">{b.title}</h2>
            </div>
            <div className="mt-2.5">
              {/* Each metric prints in its own natural view, as on screen. */}
              {b.viz === "pie" ? (
                <PrintDonut rows={rows} m={m} />
              ) : b.viz === "kpi" ? (
                <div>
                  <p className="text-[26px] font-extrabold leading-none tabular-nums">{fmt(total, m)}</p>
                  <p className="mt-1 text-[10px] text-neutral-500">
                    across {nf.format(rows.length)} {rows.length === 1 ? "entry" : "entries"}
                  </p>
                </div>
              ) : (
                <Ranked rows={rows} m={m} tint={tint} />
              )}
            </div>
          </section>
        );
      })}

      <footer className="mt-8 flex items-center justify-between border-t border-neutral-200 pt-2 text-[9px] text-neutral-500">
        <span>NEX Club &middot; generated {day(new Date())}</span>
        <span>{blocks.length} metric{blocks.length === 1 ? "" : "s"}</span>
      </footer>
    </article>
  );
}
