import type { Dimension } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const member: Dimension = {
  key: "member",
  label: "Member",
  sources: ["referrals", "revenue", "opportunities", "members", "activity"],
  // Which side of a referral to group on: givers for "generated", receivers for
  // "received"; defaults to receiver. Single-sided sources fall back to memberId.
  groupKey: (row, ctx) => (ctx.memberAxis === "giver" ? row.giverId : row.receiverId) ?? row.memberId,
};

const industry: Dimension = {
  key: "industry",
  label: "Industry",
  sources: ["referrals", "revenue", "members"],
  groupKey: (row) => row.industry,
};

const date: Dimension = {
  key: "date",
  label: "Date",
  sources: ["referrals", "revenue", "opportunities", "activity"],
  groupKey: (row, ctx) => {
    if (!row.date) return null;
    const d = row.date;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return ctx.dateGranularity === "day" ? `${y}-${m}-${String(d.getDate()).padStart(2, "0")}` : `${y}-${m}`;
  },
  formatKey: (k) => {
    if (typeof k !== "string") return String(k ?? "Unknown");
    const [y, m, day] = k.split("-");
    return day ? `${day} ${MONTHS[Number(m) - 1]} ${y}` : `${MONTHS[Number(m) - 1]} ${y}`;
  },
};

const referralStatus: Dimension = {
  key: "referralStatus",
  label: "Referral status",
  sources: ["referrals", "revenue"],
  groupKey: (row) => row.status,
};

const opportunityStage: Dimension = {
  key: "opportunityStage",
  label: "Opportunity stage",
  sources: ["opportunities"],
  groupKey: (row) => row.stage,
};

// Service Category is free-text (User.services) for now — see REPORTS.md. Only
// meaningful on the members source until a taxonomy exists.
const serviceCategory: Dimension = {
  key: "serviceCategory",
  label: "Service category",
  sources: ["members"],
  groupKey: (row) => row.service,
};

export const DIMENSIONS: Dimension[] = [
  member,
  industry,
  date,
  referralStatus,
  opportunityStage,
  serviceCategory,
];
