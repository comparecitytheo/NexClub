import Image from "next/image";
import type { ReportBlock } from "@/components/admin/club-report";

/**
 * The printed report — a document in its own right, not the screen on paper.
 *
 * The dashboard is built for interrogation: hover a bar, change the range, drill
 * in. A printout can do none of that, so this is laid out as a STATEMENT
 * instead. Figures are set large and aligned on a common right edge so the eye
 * can compare them down a column; sections are numbered because a reader
 * working through a document needs to know where they are; rules are hairlines
 * rather than boxes, because a page of cards reads as a screenshot.
 *
 * Palette and face are the CRM's, so it is recognisably the same product.
 */

const money = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
const num = (n: number) => new Intl.NumberFormat("en-AU").format(n);
/** dd/mm/yyyy for the heading — compact enough to sit inline with the title. */
const shortDay = (d: Date) =>
  new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
const day = (d: Date) =>
  new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric" }).format(d);

/** First non-label column is a block's headline metric. */
function metricKey(b: ReportBlock) {
  return b.columns.find((c) => !["name", "label", "month"].includes(c.key))?.key ?? null;
}
function totalOf(blocks: ReportBlock[], key: string) {
  const b = blocks.find((x) => x.key === key);
  const m = b && metricKey(b);
  if (!b || !m) return null;
  return b.rows.reduce((n, r) => n + (Number(r.metrics[m]) || 0), 0);
}
/** A block's own heading and caption, so the PDF says what the screen says. */
function wordingOf(blocks: ReportBlock[], key: string, fallback: string) {
  const b = blocks.find((x) => x.key === key);
  return { title: b?.title ?? fallback, blurb: b?.caption };
}

function rowsOf(blocks: ReportBlock[], key: string, limit = 10) {
  const b = blocks.find((x) => x.key === key);
  const m = b && metricKey(b);
  if (!b || !m) return [];
  return b.rows
    .map((r) => ({
      label: String(Object.values(r.dimensions)[0] ?? "—"),
      value: Number(r.metrics[m]) || 0,
    }))
    .sort((a, z) => z.value - a.value)
    .slice(0, limit);
}

/**
 * The report palette, matching the on-screen builder so a printed chart and the
 * screen it came from read as the same report. Brand burgundy leads; the rest
 * are chosen to stay distinguishable in greyscale as well as colour.
 */
const PALETTE = ["#7B1E3A", "#2563eb", "#16a34a", "#f59e0b", "#8b5cf6"] as const;

/** Donut, drawn as explicit arc paths. */
function Donut({ rows }: { rows: { label: string; value: number }[] }) {
  const total = rows.reduce((t, r) => t + r.value, 0) || 1;
  const R = 64, r0 = 44, cx = 75, cy = 75;
  const pt = (radius: number, ang: number) =>
    `${(cx + radius * Math.cos(ang)).toFixed(3)} ${(cy + radius * Math.sin(ang)).toFixed(3)}`;

  let a = -Math.PI / 2;
  const segs = rows.map((row, i) => {
    const frac = row.value / total;
    const colour = PALETTE[i % PALETTE.length];
    // One segment covering everything would make start === end and draw nothing;
    // a full ring is the honest rendering there.
    if (frac >= 0.999) {
      return (
        <circle key={row.label} cx={cx} cy={cy} r={(R + r0) / 2}
          fill="none" stroke={colour} strokeWidth={R - r0} />
      );
    }
    const b = a + frac * 2 * Math.PI;
    const big = b - a > Math.PI ? 1 : 0;
    const d = `M ${pt(R, a)} A ${R} ${R} 0 ${big} 1 ${pt(R, b)} L ${pt(r0, b)} A ${r0} ${r0} 0 ${big} 0 ${pt(r0, a)} Z`;
    a = b;
    return <path key={row.label} d={d} fill={colour} />;
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 150 150" className="h-[150px] w-[150px] shrink-0" role="img" aria-label="Referral outcomes">
        {segs}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.label} className="flex items-center gap-2 text-[11px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            <span className="font-semibold tabular-nums">{num(r.value)}</span>
            <span className="w-12 text-right text-neutral-500 tabular-nums">
              {Math.round((r.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Figure({ label, value, note, tint }: { label: string; value: string; note?: string; tint?: string }) {
  return (
    /* The rule carries the colour rather than the number itself: a tinted
       figure is harder to read, but a marker above it ties the stat to its
       segment in the donut below. */
    <div className="border-t-[3px] pt-2" style={tint ? { borderTopColor: tint } : undefined}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      {/* Tabular numerals so figures line up digit for digit down the page. */}
      <p className="mt-1 text-[26px] font-extrabold leading-none tabular-nums text-neutral-900">{value}</p>
      {note ? <p className="mt-1 text-[10px] text-neutral-500">{note}</p> : null}
    </div>
  );
}

function Section({
  index,
  title,
  blurb,
  children,
}: {
  index: string;
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7 break-inside-avoid">
      <div className="flex items-baseline gap-3 border-b border-neutral-900 pb-1.5">
        {/* Numbered because the document IS a sequence — the reader is working
            through it, and a number tells them where they are. */}
        <span className="text-[10px] font-bold tabular-nums text-[color:hsl(var(--primary))]">{index}</span>
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-neutral-900">{title}</h2>
      </div>
      {blurb ? <p className="mt-1.5 text-[10px] text-neutral-500">{blurb}</p> : null}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Ranked({ rows, format, tint }: { rows: { label: string; value: number }[]; format: "money" | "count"; tint?: string }) {
  if (rows.length === 0) {
    return <p className="text-[11px] text-neutral-500">Nothing recorded in this period.</p>;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-neutral-200 last:border-0">
            <td className="w-[38%] py-1.5 pr-3 align-middle text-[11px] text-neutral-900">{r.label}</td>
            {/* A proportion bar rather than a chart: it survives greyscale
                printing and needs no legend. */}
            <td className="py-1.5 align-middle">
              <span className="block h-[5px] w-full bg-neutral-100">
                <span
                  className="block h-full"
                  style={{
                    width: `${Math.max(2, Math.round((r.value / max) * 100))}%`,
                    background: tint ?? PALETTE[0],
                  }}
                />
              </span>
            </td>
            <td className="w-[18%] py-1.5 pl-3 text-right align-middle text-[11px] font-semibold tabular-nums text-neutral-900">
              {format === "money" ? money(r.value) : num(r.value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ReportDocument({
  blocks,
  from,
  to,
  scope,
}: {
  blocks: ReportBlock[];
  from: Date;
  to: Date;
  /** Business name, or null for the whole club. */
  scope: string | null;
}) {
  const revenue = totalOf(blocks, "revenue.by_member") ?? 0;
  const sent = totalOf(blocks, "referral.sent") ?? 0;
  const received = totalOf(blocks, "referral.received") ?? 0;
  const perReferral = received > 0 ? Math.round(revenue / received) : 0;

  return (
    <article className="report-document hidden text-neutral-900 print:block">
      {/* Masthead ------------------------------------------------------- */}
        <header className="flex items-end justify-between">
          {/* Logo alone on the left. Title, period and scope stack on the right so
              they read as one block — what this is, when it covers, whose it is —
              rather than the period sitting apart from the scope it belongs to. */}
          <Image src="/report-logo.svg" alt="NEX Club" width={92} height={92} priority />
          <div className="pb-1 text-right">
            <h1 className="text-[22px] font-extrabold leading-none tracking-tight">NEX Report</h1>
            <p className="mt-1.5 text-[12px] font-semibold text-neutral-600">
              {day(from)} &ndash; {day(to)}
            </p>
            <p className="mt-0.5 text-[10px] text-neutral-500">
              {scope ?? "Club-wide, all businesses"}
            </p>
          </div>
        </header>

      <div className="mt-3 h-[3px] w-full bg-[color:hsl(var(--primary))]" />

      {/* Headline figures. Set as a band rather than cards: cards read as a
          screenshot of a dashboard, which is exactly what this is not. */}
      <div className="mt-5 grid grid-cols-4 gap-6 border-b border-neutral-200 pb-5">
        <Figure label="Revenue closed" value={money(revenue)} tint={PALETTE[0]} />
        <Figure label="Referrals received" value={num(received)} tint={PALETTE[1]} />
        <Figure label="Referrals sent" value={num(sent)} tint={PALETTE[2]} />
        <Figure
          label="Value per referral"
          value={perReferral ? money(perReferral) : "—"}
          tint={PALETTE[3]}
          note={received ? `across ${num(received)} received` : undefined}
        />
      </div>

      <Section index="01" {...wordingOf(blocks, "revenue.by_member", "Revenue by member")}>
        <Ranked rows={rowsOf(blocks, "revenue.by_member")} format="money" tint={PALETTE[0]} />
      </Section>

      <Section index="02" title="Referral flow" blurb="Who fed the club, and who received.">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Sent</p>
            <Ranked rows={rowsOf(blocks, "referral.sent", 10)} format="count" tint={PALETTE[2]} />
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Received</p>
            <Ranked rows={rowsOf(blocks, "referral.received", 10)} format="count" tint={PALETTE[1]} />
          </div>
        </div>
      </Section>

      <Section index="03" {...wordingOf(blocks, "revenue.by_industry", "Revenue by industry")}>
        <Ranked rows={rowsOf(blocks, "revenue.by_industry")} format="money" tint={PALETTE[3]} />
      </Section>

      <Section index="04" {...wordingOf(blocks, "revenue.by_month", "Month by month")}>
        <Ranked rows={rowsOf(blocks, "revenue.by_month", 12)} format="money" tint={PALETTE[4]} />
      </Section>

      <Section index="05" {...wordingOf(blocks, "referral.status", "Referral outcomes")}>
        <Donut rows={rowsOf(blocks, "referral.status")} />
      </Section>

      <footer className="mt-8 flex items-center justify-between border-t border-neutral-200 pt-2 text-[9px] text-neutral-500">
        <span>NEX Club &middot; generated {day(new Date())}</span>
        <span>Figures cover {day(from)} to {day(to)}</span>
      </footer>
    </article>
  );
}
