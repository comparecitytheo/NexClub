import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const PAGE = readFileSync(join(process.cwd(), "src/app/(dashboard)/admin/reports/page.tsx"), "utf8");
const DOC = readFileSync(join(process.cwd(), "src/components/admin/report-document.tsx"), "utf8");
const BUTTON = readFileSync(join(process.cwd(), "src/components/admin/download-report-button.tsx"), "utf8");
const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/**
 * The PDF is a document, not the screen printed out.
 *
 * The dashboard is built to be interrogated — hover a bar, change the range.
 * Paper can do none of that, so the printed version is laid out as a statement:
 * headline figures, then numbered sections with ranked tables.
 */
describe("the printed output is purpose-built", () => {
  it("renders its own document rather than the screen", () => {
    expect(PAGE).toMatch(/<ReportDocument blocks=\{blocks\} from=\{from\} to=\{to\} scope=\{who\} \/>/);
  });

  it("hides the interactive report on paper", () => {
    // Otherwise both would print, one after the other.
    expect(PAGE).toMatch(/<div className="print:hidden">\s*<ClubReport/);
  });

  it("the document exists only in print", () => {
    expect(DOC).toMatch(/hidden text-neutral-900 print:block/);
  });
});

describe("the masthead", () => {
  it("puts the logo left and the title block right", () => {
    expect(DOC).toMatch(/src="\/report-logo\.svg"/);
    expect(DOC).toMatch(/>NEX Report<\/h1>/);
    // Title, period and scope stack together on the right, so the period is not
    // separated from the scope it belongs to.
    expect(DOC).toMatch(/<div className="pb-1 text-right">/);
    const title = DOC.indexOf(">NEX Report</h1>");
    const period = DOC.indexOf("{day(from)} &ndash; {day(to)}");
    const scope = DOC.indexOf('{scope ?? "Club-wide, all businesses"}');
    expect(title).toBeLessThan(period);
    expect(period).toBeLessThan(scope);
  });

  it("ships the logo file", () => {
    expect(existsSync(join(process.cwd(), "public/report-logo.svg"))).toBe(true);
  });

  it("names the scope, so a filed copy is not ambiguous", () => {
    expect(DOC).toMatch(/Club-wide, all businesses/);
  });
});

describe("it reads as a report, not a dashboard", () => {
  it("leads with headline figures", () => {
    for (const f of ["Revenue closed", "Referrals received", "Referrals sent", "Value per referral"]) {
      expect(DOC).toContain(f);
    }
  });

  it("derives value per referral rather than reprinting a chart", () => {
    expect(DOC).toMatch(/received > 0 \? Math\.round\(revenue \/ received\) : 0/);
  });

  it("uses numbered sections with real headings", () => {
    for (const t of ["Revenue by member", "Referral flow", "Revenue by industry", "Month by month", "Referral outcomes"]) {
      expect(DOC).toContain(t);
    }
    expect(DOC).toMatch(/index="01"/);
  });

  it("aligns figures on tabular numerals", () => {
    // So they compare digit for digit down a column.
    expect(DOC).toMatch(/tabular-nums/);
  });

  it("uses proportion bars that survive greyscale printing", () => {
    expect(DOC).toMatch(/Math\.max\(2, Math\.round\(\(r\.value \/ max\) \* 100\)\)/);
  });

  it("says so plainly when a period is empty", () => {
    expect(DOC).toMatch(/Nothing recorded in this period\./);
  });
});

describe("it keeps the CRM's identity", () => {
  it("uses the same palette as the on-screen report builder", () => {
    // The chart colours are deliberately literal, not theme tokens: they must
    // match the builder's own palette so a printed chart and the screen it came
    // from read as one report. Burgundy leads, matching the brand.
    expect(DOC).toMatch(/const PALETTE = \["#7B1E3A", "#2563eb", "#16a34a", "#f59e0b", "#8b5cf6"\]/);
  });

  it("gives every section its own colour from that palette", () => {
    // Each ranked list and each headline figure is tied to a palette entry, so
    // a section is identifiable at a glance and matches the donut's language.
    expect(DOC.match(/tint=\{PALETTE\[\d\]\}/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
  });

  it("the download button follows the theme too", () => {
    expect(BUTTON).not.toMatch(/variant="outline"/);
    expect(BUTTON).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});

describe("the print stylesheet clears the shell", () => {
  it("hides everything and re-shows only the document", () => {
    // Enumerating what to hide kept leaking — a card here, a tab strip there,
    // each fix missing the next. This inverts it, so nothing new can slip in.
    const block = CSS.slice(CSS.indexOf("@media print"));
    expect(block).toMatch(/body \* \{\s*visibility: hidden/);
    expect(block).toMatch(/\.report-document,\s*\.report-document \* \{\s*visibility: visible/);
  });

  it("strips card shadows, which print as grey bands", () => {
    const block = CSS.slice(CSS.indexOf("@media print"));
    expect(block).toMatch(/\.report-document \* \{\s*box-shadow: none/);
  });

  it("the document carries the class the print rule targets", () => {
    expect(DOC).toMatch(/className="report-document hidden text-neutral-900 print:block"/);
  });

  it("flattens the layout so the document fills the sheet", () => {
    expect(CSS).toMatch(/max-width: none !important/);
  });

  it("forces background colours, or bars print white", () => {
    expect(CSS).toMatch(/print-color-adjust: exact/);
  });

  it("adds no PDF dependency", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const lib of ["jspdf", "pdfkit", "puppeteer", "html2canvas", "@react-pdf/renderer"]) {
      expect(deps[lib]).toBeUndefined();
    }
  });
});


describe("the PDF omits nothing the screen shows", () => {
  it("covers every block the page renders", () => {
    const onScreen = [...PAGE.matchAll(/key: "([a-z]+\.[a-z_]+)"/g)].map((m) => m[1]);
    for (const key of new Set(onScreen)) {
      expect(DOC).toContain(key);
    }
  });

  it("shows at least as many rows as the screen does", () => {
    // The screen caps at 10 and lets you drill in for the rest; paper cannot
    // drill, so the PDF must never show fewer.
    const limits = [...DOC.matchAll(/rowsOf\(blocks, "[a-z.]+"(?:, (\d+))?\)/g)]
      .map((m) => Number(m[1] ?? 10));
    for (const n of limits) expect(n).toBeGreaterThanOrEqual(10);
  });

  it("takes its headings from the blocks, so wording cannot drift", () => {
    // The page rewords these when a single business is selected; hardcoding
    // them here produced a club-wide heading on a single-business report.
    expect(DOC).toMatch(/function wordingOf/);
    expect(DOC).toMatch(/\{\.\.\.wordingOf\(blocks, "revenue\.by_member"/);
  });
});



describe("the saved file name carries the period", () => {
  it("names the file from the selected range", () => {
    // Browsers take the default PDF name from document.title, so it is swapped
    // for the print and restored afterwards.
    expect(BUTTON).toMatch(/document\.title = `NEX Report \$\{from\} - \$\{to\}`/);
  });

  it("puts the title back, whichever way the dialog closes", () => {
    // Otherwise the browser tab reads "NEX Report ..." for the rest of the session.
    expect(BUTTON).toMatch(/window\.addEventListener\("afterprint", restore\)/);
    expect(BUTTON).toMatch(/setTimeout\(restore, 3000\)/);
  });

  it("avoids slashes, which are path separators", () => {
    expect(PAGE).toMatch(/\.replace\(\/\\\/\/g, "\."\)/);
  });
});


describe("the donut", () => {
  it("renders referral outcomes as a ring, not another bar list", () => {
    // Outcomes is a share-of-total question; a ring answers it better than a
    // ranked list, and it matches the builder's Donut view.
    expect(DOC).toMatch(/<Donut rows=\{rowsOf\(blocks, "referral\.status"\)\} \/>/);
  });

  it("draws explicit arc paths rather than dash offsets", () => {
    // Dash patterns around a shared circle leave a hairline seam where two
    // segments meet, which showed on the last segment in the builder.
    expect(DOC).toMatch(/const d = `M \$\{pt\(R, a\)\} A/);
  });

  it("draws a full ring when one outcome is everything", () => {
    // start === end would otherwise draw nothing at all.
    expect(DOC).toMatch(/if \(frac >= 0\.999\)/);
  });

  it("has a legend with counts and percentages", () => {
    expect(DOC).toMatch(/Math\.round\(\(r\.value \/ total\) \* 100\)/);
  });
});
