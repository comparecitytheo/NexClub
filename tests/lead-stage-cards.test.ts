import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { summariseLeadStages, LEAD_STATUS_ORDER, LEAD_STATUS_LABELS } from "@/lib/labels";
import { LeadStageCards } from "@/components/dashboard/lead-stage-cards";

// Fixtures mirror prisma.lead.groupBy(["status"]) output: { status, count }.
// individual = the viewer's own business; club = every business combined.
const individualGroups = [
  { status: "NEW", count: 4 },
  { status: "CONTACTED", count: 3 },
  { status: "IN_PROGRESS", count: 2 },
  { status: "CLOSED_WON", count: 5 },
  { status: "CLOSED_LOST", count: 1 },
] as const; // total 15
const clubGroups = [
  { status: "NEW", count: 40 },
  { status: "CONTACTED", count: 22 },
  { status: "IN_PROGRESS", count: 17 },
  { status: "CLOSED_WON", count: 44 },
  { status: "CLOSED_LOST", count: 19 },
] as const; // total 142

describe("summariseLeadStages", () => {
  it("returns all five Kanban stages in canonical order with canonical labels", () => {
    const { stages } = summariseLeadStages([...individualGroups]);
    expect(stages).toHaveLength(LEAD_STATUS_ORDER.length);
    expect(stages.map((s) => s.label)).toEqual(LEAD_STATUS_ORDER.map((s) => LEAD_STATUS_LABELS[s]));
  });

  it("maps every stage to its count and defaults a missing stage to 0", () => {
    const { stages } = summariseLeadStages([{ status: "NEW", count: 7 }]);
    const byLabel = Object.fromEntries(stages.map((s) => [s.label, s.value]));
    expect(byLabel[LEAD_STATUS_LABELS.NEW]).toBe("7");
    expect(byLabel[LEAD_STATUS_LABELS.CONTACTED]).toBe("0");
    expect(byLabel[LEAD_STATUS_LABELS.CLOSED_LOST]).toBe("0");
  });

  it("reconciles: total always equals the sum of the stage counts", () => {
    const indiv = summariseLeadStages([...individualGroups]);
    const club = summariseLeadStages([...clubGroups]);
    expect(indiv.total).toBe(15);
    expect(club.total).toBe(142);
    expect(indiv.stages.reduce((n, s) => n + Number(s.value), 0)).toBe(indiv.total);
    expect(club.stages.reduce((n, s) => n + Number(s.value), 0)).toBe(club.total);
  });
});

describe("LeadStageCards", () => {
  const data = {
    individual: summariseLeadStages([...individualGroups]),
    club: summariseLeadStages([...clubGroups]),
  };
  const html = renderToStaticMarkup(createElement(LeadStageCards, { data }));

  it("renders the individual business breakdown: every stage and the individual total", () => {
    for (const s of LEAD_STATUS_ORDER) expect(html).toContain(LEAD_STATUS_LABELS[s]);
    for (const s of data.individual.stages) expect(html).toContain(`>${s.value}<`);
    expect(html).toContain(`>${data.individual.total}<`); // 15
  });

  it("renders the club-wide card: every stage and the aggregated club total", () => {
    expect(html).toContain(`>${data.club.total}<`); // 142
    for (const s of data.club.stages) expect(html).toContain(`>${s.value}<`);
  });

  it("renders identically for a member and a super admin (no role gating)", () => {
    // The page builds this view-model the same way for every role and hands it
    // to one shared component that takes no role prop, so the markup a member
    // sees is byte-for-byte the markup a super admin sees.
    const asMember = renderToStaticMarkup(createElement(LeadStageCards, { data }));
    const asSuperAdmin = renderToStaticMarkup(createElement(LeadStageCards, { data }));
    expect(asSuperAdmin).toBe(asMember);
  });
});
