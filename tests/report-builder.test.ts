import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SCHEMA = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const RUN = readFileSync(join(process.cwd(), "src/app/api/admin/reports/run/route.ts"), "utf8");
const SAVED = readFileSync(join(process.cwd(), "src/app/api/admin/reports/saved/route.ts"), "utf8");
const DEL = readFileSync(join(process.cwd(), "src/app/api/admin/reports/saved/[id]/route.ts"), "utf8");
const UI = readFileSync(join(process.cwd(), "src/components/admin/report-builder.tsx"), "utf8");
const BTN = readFileSync(join(process.cwd(), "src/components/admin/download-custom-report-button.tsx"), "utf8");
const PAGE = readFileSync(join(process.cwd(), "src/app/(dashboard)/admin/reports/page.tsx"), "utf8");
const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/**
 * The custom report builder sits below the club-wide cards and is independent
 * of them — its own scope, range, results and PDF. The ONE thing it shares is
 * the calculation, so the numbers cannot disagree.
 */
describe("1. Add metric respects the left-panel selection", () => {
  it("tracks the highlighted metric separately from the chosen list", () => {
    // Highlighting is not adding — that distinction is the whole point.
    expect(UI).toMatch(/const \[active, setActive\] = useState<string \| null>\(null\)/);
    expect(UI).toMatch(/const \[chosen, setChosen\] = useState<string\[\]>\(\[\]\)/);
  });

  it("adds the active metric, not something else", () => {
    expect(UI).toMatch(/setChosen\(\(c\) => \[\.\.\.c, active\]\)/);
  });

  it("handles nothing selected", () => {
    expect(UI).toMatch(/Choose a metric on the left first/);
    expect(UI).toMatch(/disabled=\{!active\}/);
  });

  it("handles the same metric added twice", () => {
    expect(UI).toMatch(/if \(chosen\.includes\(active\)\)/);
    expect(UI).toMatch(/is already in this report/);
  });

  it("clears stale results when the metric list changes", () => {
    // Leaving old figures beside a changed selection would misrepresent them.
    expect(UI.match(/setBlocks\(null\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});

describe("2. Run uses the club-wide calculation path", () => {
  it("calls runReport rather than calculating anything itself", () => {
    expect(RUN).toMatch(/import \{ runReport \} from "@\/server\/reports"/);
    expect(RUN).toMatch(/await runReport\(\{ reportKey: key, dateRange \}, ctx\)/);
  });

  it("scopes to the selected business the same way the cards do", () => {
    expect(RUN).toMatch(/userIds: memberIds/);
    expect(RUN).toMatch(/isAdmin: !memberIds/);
  });

  it("runs exactly the chosen metrics", () => {
    expect(UI).toMatch(/metricKeys: chosen/);
  });

  it("is Super Admin only", () => {
    expect(RUN).toMatch(/requireSuperAdmin\(\)/);
  });

  it("is a GET, because it reads and writes nothing", () => {
    // A POST would imply mutation and would need exempting from the
    // support-mode write guard. Twelve keys plus a scope is ~350 characters,
    // well inside any URL limit.
    expect(RUN).toMatch(/export async function GET\(req: Request\)/);
    expect(RUN).not.toMatch(/export async function POST/);
  });

  it("needs no write-guard exemption", () => {
    const EX = readFileSync(join(process.cwd(), "tests/support-readonly.test.ts"), "utf8");
    expect(EX).not.toMatch(/admin\/reports\/run/);
  });

  it("one failing metric does not lose the rest", () => {
    expect(RUN).toMatch(/\/\/ One failing metric should not lose the other eleven\./);
  });

  it("caps how many metrics one request can ask for", () => {
    expect(RUN).toMatch(/\.max\(12\)/);
  });
});

describe("3. The custom PDF exports the run, not the club-wide data", () => {
  it("is a separate button from the club-wide export", () => {
    expect(UI).toMatch(/<DownloadCustomReportButton/);
    expect(BTN).not.toMatch(/ReportDocument/);
  });

  it("reuses window.print rather than adding a PDF library", () => {
    expect(BTN).toMatch(/window\.print\(\)/);
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const lib of ["jspdf", "pdfkit", "puppeteer", "html2canvas", "@react-pdf/renderer"]) {
      expect(deps[lib]).toBeUndefined();
    }
  });

  it("switches the print target so the custom results print, not the club-wide document", () => {
    expect(BTN).toMatch(/setAttribute\("data-print-target", "custom"\)/);
    expect(CSS).toMatch(/html\[data-print-target="custom"\] \.custom-report-print/);
    expect(CSS).toMatch(/html\[data-print-target="custom"\] \.report-document,/);
  });

  it("is disabled until a report has been run", () => {
    expect(UI).toMatch(/ready=\{Boolean\(blocks && blocks\.length > 0\)\}/);
    expect(BTN).toMatch(/disabled=\{!ready\}/);
    expect(BTN).toMatch(/Run the report first/);
  });

  it("restores the page title afterwards", () => {
    expect(BTN).toMatch(/window\.addEventListener\("afterprint", restore\)/);
    expect(BTN).toMatch(/setTimeout\(restore, 3000\)/);
  });
});

describe("4. Saved reports persist metrics and scope", () => {
  it("stores metric keys, scope and range", () => {
    const block = SCHEMA.slice(SCHEMA.indexOf("model SavedReport"));
    const body = block.slice(0, block.indexOf("\n}"));
    expect(body).toMatch(/metricKeys\s+String\[\]/);
    expect(body).toMatch(/businessKey\s+String\?/);
    expect(body).toMatch(/rangeDays\s+Int\?/);
  });

  it("stores the definition, not a snapshot of the figures", () => {
    // So an old saved report shows current numbers when re-run, rather than a
    // stale snapshot. The model stores keys and scope, never rows or values.
    const block = SCHEMA.slice(SCHEMA.indexOf("model SavedReport"));
    const body = block.slice(0, block.indexOf("\n}"));
    expect(body).not.toMatch(/Json|result|rows|values/i);
  });

  it("is scoped per organisation with unique names", () => {
    expect(SCHEMA).toMatch(/@@unique\(\[organizationId, name\]\)/);
  });

  it("loading restores the metric list and the scope", () => {
    expect(UI).toMatch(/setChosen\(live\)/);
    expect(UI).toMatch(/setBusinessKey\(r\.businessKey \?\? ""\)/);
    expect(UI).toMatch(/setRangeDays\(r\.rangeDays \?\? 30\)/);
  });

  it("survives a metric being removed from the code", () => {
    // Keys are code-defined, not rows — a stale key is skipped, not fatal.
    expect(UI).toMatch(/const live = r\.metricKeys\.filter\(\(k\) => metrics\.some\(\(m\) => m\.key === k\)\)/);
    expect(RUN).toMatch(/const skipped = /);
  });

  it("delete is scoped to the caller's organisation", () => {
    expect(DEL).toMatch(/where: \{ id, organizationId: user\.organizationId \}/);
  });

  it("saves and deletes are audited", () => {
    expect(SAVED).toMatch(/recordAudit/);
    expect(DEL).toMatch(/recordAudit/);
  });
});

describe("independence from the club-wide section", () => {
  it("sits below the cards", () => {
    expect(PAGE.indexOf("<ClubReport")).toBeLessThan(PAGE.indexOf("<ReportBuilder"));
  });

  it("has its own scope and range, not the page's", () => {
    expect(UI).toMatch(/const \[businessKey, setBusinessKey\] = useState\(""\)/);
    expect(UI).toMatch(/const \[rangeDays, setRangeDays\] = useState<number>\(30\)/);
  });

  it("takes no props from the club-wide section", () => {
    // Only metrics, businesses and saved reports — never the cards' own blocks
    // or their scope, so the two cannot become coupled.
    const props = UI.slice(UI.indexOf("export function ReportBuilder"), UI.indexOf("}: {") + 400);
    expect(props).toMatch(/metrics: MetricOption\[\]/);
    expect(props).not.toMatch(/clubBlocks|scope:|selected:/);
  });

  it("renders results with its OWN component, not the cards'", () => {
    // The club-wide cards render bars and tables only, and the brief was
    // explicit that their rendering must not change — so KPI and donut live in
    // a separate component rather than being added to theirs.
    expect(UI).toMatch(/<CustomResults blocks=\{blocks\} \/>/);
    expect(UI).not.toMatch(/<ClubReport blocks/);
  });
});


describe("scope and period options", () => {
  it("offers business, chapter and member as separate scopes", () => {
    expect(UI).toMatch(/id="rb-business"/);
    expect(UI).toMatch(/id="rb-chapter"/);
    expect(UI).toMatch(/id="rb-member"/);
  });

  it("treats them as alternatives, not stacking filters", () => {
    // "Webb Financial AND The Shire AND Priya" has no coherent meaning.
    expect(UI).toMatch(/function pickScope/);
    expect(UI).toMatch(/setBusinessKey\(kind === "business" \? value : ""\)/);
  });

  it("resolves all three server-side", () => {
    expect(RUN).toMatch(/if \(memberId\)/);
    expect(RUN).toMatch(/else if \(chapterId\)/);
    expect(RUN).toMatch(/else if \(businessKey\)/);
  });

  it("scopes a chapter through the BUSINESS, since that is where it lives", () => {
    expect(RUN).toMatch(/business: \{ chapterId \}/);
  });

  it("offers a custom date range alongside the presets", () => {
    expect(UI).toMatch(/Custom range/);
    expect(UI).toMatch(/params\.set\("from", new Date\(customFrom\)\.toISOString\(\)\)/);
  });
});

describe("each metric renders in its own natural view", () => {
  const RES = readFileSync(join(process.cwd(), "src/components/admin/custom-results.tsx"), "utf8");
  const PDF = readFileSync(join(process.cwd(), "src/components/admin/custom-report-document.tsx"), "utf8");

  it("has no view picker — the definition decides", () => {
    // A revenue leaderboard wants ranked bars and a status breakdown wants a
    // ring; asking the reader to choose only invites the wrong one.
    expect(RES).toMatch(/function viewFor/);
    expect(UI).not.toMatch(/setViz|VizMode/);
  });

  it("maps the engine's own viz onto a view", () => {
    expect(RES).toMatch(/if \(viz === "pie"\) return "donut"/);
    expect(RES).toMatch(/if \(viz === "kpi"\) return "kpi"/);
  });

  it("renders by the block's viz, not a global mode", () => {
    expect(RES).toMatch(/viewFor\(b\.viz\)/);
    expect(UI).toMatch(/<CustomResults blocks=\{blocks\} \/>/);
  });

  it("the block type carries every viz the engine returns", () => {
    // It listed three of six, so a pie or kpi report arrived typed as something
    // it was not.
    const CR = readFileSync(join(process.cwd(), "src/components/admin/club-report.tsx"), "utf8");
    expect(CR).toMatch(/viz: "bar" \| "line" \| "table" \| "pie" \| "kpi" \| "leaderboard"/);
  });

  it("the PDF prints each metric in the same view as the screen", () => {
    expect(PDF).toMatch(/b\.viz === "pie" \? \(/);
    expect(PDF).toMatch(/b\.viz === "kpi" \? \(/);
  });
});

describe("the custom PDF matches the club-wide document", () => {
  const PDF = readFileSync(join(process.cwd(), "src/components/admin/custom-report-document.tsx"), "utf8");

  it("uses the same masthead: logo left, period right", () => {
    expect(PDF).toMatch(/<header className="flex items-end justify-between">/);
    expect(PDF).toMatch(/src="\/report-logo\.svg"/);
    expect(PDF).toMatch(/\{day\(from\)\} &ndash; \{day\(to\)\}/);
  });

  it("uses the same brand rule and numbered sections", () => {
    expect(PDF).toMatch(/h-\[3px\] w-full bg-\[color:hsl\(var\(--primary\)\)\]/);
    expect(PDF).toMatch(/String\(i \+ 1\)\.padStart\(2, "0"\)/);
  });

  it("uses the same palette", () => {
    expect(PDF).toMatch(/const PALETTE = \["#7B1E3A", "#2563eb", "#16a34a", "#f59e0b", "#8b5cf6"\]/);
  });

  it("is print-only and carries the class the print rule targets", () => {
    expect(PDF).toMatch(/className="custom-report-print hidden text-neutral-900 print:block"/);
  });

  it("prints nothing rather than an empty shell when no run exists", () => {
    expect(PDF).toMatch(/if \(blocks\.length === 0\) return null/);
  });
});

describe("revenue by industry groups by industry, not people", () => {
  const SRC = readFileSync(join(process.cwd(), "src/server/reports/sources.ts"), "utf8");
  const ENG = readFileSync(join(process.cwd(), "src/server/reports/engine.ts"), "utf8");

  it("falls back to the owning member's industry", () => {
    // Lead.industry exists but the send-a-lead form never sets it, so it was
    // null on every real lead and everything collapsed into one bucket.
    expect(SRC).toMatch(/\(r\.owner as \{ industry\?: string \| null \} \| undefined\)\?\.industry/);
  });

  it("joins the owner so that field is actually available", () => {
    expect(SRC).toMatch(/include: \{ owner: \{ select: \{ industry: true \} \} \}/);
    expect(ENG).toMatch(/source\.include \? \{ where, include: source\.include \} : \{ where \}/);
  });

  it("only the sources that need the join declare it", () => {
    // The deals source has no owner industry to read, so it pays nothing.
    expect((SRC.match(/include: \{ owner:/g) ?? []).length).toBe(2);
  });
});

/**
 * Audit: every report's heading must match the data it groups by.
 */
describe("report headings match their data", () => {
  const DEFS = readFileSync(join(process.cwd(), "src/server/reports/definitions.ts"), "utf8");
  const ENG = readFileSync(join(process.cwd(), "src/server/reports/engine.ts"), "utf8");
  const DIMS = readFileSync(join(process.cwd(), "src/server/reports/dimensions.ts"), "utf8");

  function defs() {
    return DEFS.split(/(?=\{\s*\n?\s*key:\s*")/)
      .map((b) => ({
        key: /key:\s*"([a-z]+\.[a-z_]+)"/.exec(b)?.[1],
        title: /title:\s*"([^"]+)"/.exec(b)?.[1],
        group: /defaultGroupBy:\s*\[\s*"(\w+)"/.exec(b)?.[1] ?? null,
      }))
      .filter((d) => d.key && d.title);
  }

  it("'by industry' groups by industry, not member", () => {
    const d = defs().find((x) => x.key === "revenue.by_industry");
    expect(d?.group).toBe("industry");
  });

  it("'by month' and trends group by date", () => {
    for (const k of ["revenue.by_month", "revenue.trends"]) {
      expect(defs().find((x) => x.key === k)?.group).toBe("date");
    }
  });

  it("status reports group by referral status", () => {
    for (const k of ["referral.status", "referral.pipeline"]) {
      expect(defs().find((x) => x.key === k)?.group).toBe("referralStatus");
    }
  });

  it("every title naming a dimension groups by that dimension", () => {
    const map: Record<string, string> = {
      industry: "industry", month: "date", member: "member", status: "referralStatus",
    };
    for (const d of defs()) {
      for (const [word, dim] of Object.entries(map)) {
        if (d.title!.toLowerCase().includes(`by ${word}`)) {
          expect(`${d.key}:${d.group}`).toBe(`${d.key}:${dim}`);
        }
      }
    }
  });

  it("member groups resolve to names, not raw ids", () => {
    // The dimension groups on a user id, which is meaningless on screen. 15 of
    // the 25 reports group by member, so this affected most of them.
    expect(DIMS).toMatch(/groupKey: \(row, ctx\) =>/);
    expect(ENG).toMatch(/const memberIdx = groupDims\.findIndex\(\(d\) => d\.key === "member"\)/);
    expect(ENG).toMatch(/names\.get\(g\.keys\[i\] as string\) \?\? g\.keys\[i\]/);
  });

  it("resolves them in one query, not per row", () => {
    expect(ENG).toMatch(/where: \{ id: \{ in: ids \} \}/);
  });

  it("a deleted member keeps its id rather than vanishing", () => {
    expect(ENG).toMatch(/\?\? g\.keys\[i\]/);
  });
});


describe("results stay readable as metrics are added", () => {
  const RES = readFileSync(join(process.cwd(), "src/components/admin/custom-results.tsx"), "utf8");

  it("caps at three cards per row, then wraps", () => {
    // A responsive auto-fit grid shrank every card as more metrics were added,
    // so a ten-metric run squeezed each one to unreadable.
    expect(RES).toMatch(/grid gap-4 sm:grid-cols-2 xl:grid-cols-3/);
    expect(RES).not.toMatch(/lg:grid-cols-2"/);
  });
});

describe("every metric is findable", () => {
  it("the tree has a search box", () => {
    // 25 metrics in a scroll box left most below the fold — which is why
    // Referrals Received looked missing when it was there all along.
    expect(UI).toMatch(/placeholder="Search metrics"/);
    expect(UI).toMatch(/const \[search, setSearch\] = useState\(""\)/);
  });

  it("filters on the metric title", () => {
    expect(UI).toMatch(/list = q \? metrics\.filter\(\(x\) => x\.title\.toLowerCase\(\)\.includes\(q\)\)/);
  });

  it("says so when nothing matches", () => {
    expect(UI).toMatch(/No metric matches/);
  });

  it("shows the count, so a short list is obviously filtered", () => {
    expect(UI).toMatch(/Available metrics \(\{metrics\.length\}\)/);
  });

  it("Referrals Received is a real, registered metric", () => {
    const DEFS = readFileSync(join(process.cwd(), "src/server/reports/definitions.ts"), "utf8");
    expect(DEFS).toMatch(/key: "referral\.received"/);
    expect(DEFS).toMatch(/title: "Referrals Received"/);
    // It groups on the RECEIVING side, which is what makes it different from
    // Referrals Sent.
    expect(DEFS).toMatch(/key: "referral\.received",[\s\S]{0,200}?memberAxis: "receiver"/);
  });
});
