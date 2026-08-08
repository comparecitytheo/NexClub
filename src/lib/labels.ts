import type {
  LeadStatus,
  SentLeadStatus,
  LeadSource,
  LeadPriority,
  ContactStatus,
  DealStage,
  TaskStatus,
  TaskPriority,
  ActivityType,
} from "@prisma/client";

// Single source of truth for lead-priority display (label + colours).
// Used by the Send-a-Lead form buttons and the priority badge on lead cards.
export const LEAD_PRIORITY_ORDER: LeadPriority[] = ["LOW", "MEDIUM", "HIGH", "NEEDED_YESTERDAY"];

export const LEAD_PRIORITY_META: Record<LeadPriority, { label: string; bg: string; text: string }> = {
  LOW: { label: "Low", bg: "#39ff14", text: "#155724" },
  MEDIUM: { label: "Medium", bg: "#fbbf24", text: "#78350f" },
  HIGH: { label: "High", bg: "#f97316", text: "#ffffff" },
  NEEDED_YESTERDAY: { label: "Needed Yesterday", bg: "#ef4444", text: "#ffffff" },
};

// Board columns. DELETED is deliberately NOT here — no "Deleted" column is
// rendered; the value exists only as a status a lead can transition into.
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "NEW", "CONTACTED", "IN_PROGRESS", "CLOSED_WON", "CLOSED_LOST",
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  IN_PROGRESS: "In Progress",
  CLOSED_WON: "Successful",
  CLOSED_LOST: "Lost",
  DELETED: "Deleted",
};

// Build a Kanban-stage breakdown for a set of leads. `groups` is the raw output
// shape of prisma.lead.groupBy(["status"]) (the same source the boards and the
// dashboard metrics use), mapped onto LEAD_STATUS_ORDER + LEAD_STATUS_LABELS so
// the breakdown's stages, order and labels always match the Kanban exactly.
// `total` is the sum of the stage counts, so a breakdown always reconciles to
// its own total — for any scope (one business, or club-wide).
export function summariseLeadStages(
  groups: { status: LeadStatus; count: number }[],
): { total: number; stages: { label: string; value: string; color: string }[] } {
  const byStatus = new Map(groups.map((g) => [g.status, g.count]));
  const stages = LEAD_STATUS_ORDER.map((s) => ({
    label: LEAD_STATUS_LABELS[s],
    value: String(byStatus.get(s) ?? 0),
    // Kanban column colour for this stage, so a dashboard count always matches
    // the board. Derived from LEAD_STATUS_COLORS, so new statuses inherit it.
    color: LEAD_STATUS_COLORS[s].bg,
  }));
  const total = groups.reduce((sum, g) => sum + g.count, 0);
  return { total, stages };
}

// ---- Pipeline stage colours (single source of truth) -----------------------
// Both LeadStatus (My Leads) and SentLeadStatus (Sent Leads) map onto the SAME
// five pipeline stages, so stage colour is driven by the stage itself, never by
// which page/board it appears on — the two views always match for a given stage.
//
// Suggested hex codes (modern UI palette). Adjust HERE to retune everywhere at
// once (Kanban headers + List dots + detail badges, on both pages):
//   New          purple  bg #7c3aed / text #ffffff
//   Contacted    blue    bg #2563eb / text #ffffff
//   In Progress  yellow  bg #facc15 / text #000000   (black-on-yellow ~11:1)
//   Closed/Won   green   bg #15803d / text #ffffff   (readable green, not fluoro)
//   Lost         red     bg #dc2626 / text #ffffff
export type LeadStage = "NEW" | "CONTACTED" | "IN_PROGRESS" | "CLOSED_WON" | "LOST";

export const STAGE_COLORS: Record<LeadStage, { bg: string; text: string }> = {
  NEW: { bg: "#7c3aed", text: "#ffffff" },
  CONTACTED: { bg: "#2563eb", text: "#ffffff" },
  // In Progress: changed from orange (#f97316 / white) to yellow on black.
  IN_PROGRESS: { bg: "#facc15", text: "#000000" },
  CLOSED_WON: { bg: "#15803d", text: "#ffffff" },
  LOST: { bg: "#dc2626", text: "#ffffff" },
};

// My Leads (LeadStatus) -> canonical stage.
export const LEAD_STATUS_STAGE: Record<LeadStatus, LeadStage> = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  IN_PROGRESS: "IN_PROGRESS",
  CLOSED_WON: "CLOSED_WON",
  CLOSED_LOST: "LOST",
  DELETED: "LOST",
};
// Resolved colours per LeadStatus value (references STAGE_COLORS, never literals).
export const LEAD_STATUS_COLORS: Record<LeadStatus, { bg: string; text: string }> = {
  NEW: STAGE_COLORS.NEW,
  CONTACTED: STAGE_COLORS.CONTACTED,
  IN_PROGRESS: STAGE_COLORS.IN_PROGRESS,
  CLOSED_WON: STAGE_COLORS.CLOSED_WON,
  CLOSED_LOST: STAGE_COLORS.LOST,
  DELETED: STAGE_COLORS.LOST,
};

// Outbound "Sent Leads" board. SentLeadStatus maps onto the same five pipeline
// stages as My Leads (see STAGE_COLORS), so the two boards share ONE stage
// palette — colour is driven by stage, not by which board it is shown on.
export const SENT_LEAD_STATUS_ORDER: SentLeadStatus[] = [
  "SENT", "VIEWED", "RESPONDED", "CONVERTED", "CLOSED",
];

export const SENT_LEAD_STATUS_LABELS: Record<SentLeadStatus, string> = {
  // Titles mirror the My Leads board (LEAD_STATUS_LABELS) exactly, positionally.
  // Only the display text changes — the underlying SentLeadStatus values
  // (SENT/VIEWED/RESPONDED/CONVERTED/CLOSED), ordering, dots and logic are unchanged.
  SENT: "New",
  VIEWED: "Contacted",
  RESPONDED: "In Progress",
  CONVERTED: "Successful",
  CLOSED: "Lost",
};

// Sent Leads (SentLeadStatus) -> canonical stage.
export const SENT_LEAD_STATUS_STAGE: Record<SentLeadStatus, LeadStage> = {
  SENT: "NEW",
  VIEWED: "CONTACTED",
  RESPONDED: "IN_PROGRESS",
  CONVERTED: "CLOSED_WON",
  CLOSED: "LOST",
};
// Resolved colours per SentLeadStatus value (shared STAGE_COLORS).
export const SENT_LEAD_STATUS_COLORS: Record<SentLeadStatus, { bg: string; text: string }> = {
  SENT: STAGE_COLORS.NEW,
  VIEWED: STAGE_COLORS.CONTACTED,
  RESPONDED: STAGE_COLORS.IN_PROGRESS,
  CONVERTED: STAGE_COLORS.CLOSED_WON,
  CLOSED: STAGE_COLORS.LOST,
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  REFERRAL: "Referral",
  WEBSITE: "Website",
  COLD_OUTREACH: "Cold Outreach",
  EVENT: "Event",
  SOCIAL: "Social",
  OTHER: "Other",
};

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  LEAD: "Lead",
  CUSTOMER: "Customer",
};

export const DEAL_STAGE_ORDER: DealStage[] = [
  "PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST",
];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  PROSPECTING: "Prospecting",
  QUALIFICATION: "Qualification",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Successful",
  CLOSED_LOST: "Closed Lost",
};

export const DEAL_STAGE_DOT: Record<DealStage, string> = {
  PROSPECTING: "bg-slate-400",
  QUALIFICATION: "bg-sky-400",
  PROPOSAL: "bg-teal-500",
  NEGOTIATION: "bg-amber-400",
  CLOSED_WON: "bg-emerald-500",
  CLOSED_LOST: "bg-rose-400",
};

// Default close probability suggested per stage.
export const DEAL_STAGE_PROBABILITY: Record<DealStage, number> = {
  PROSPECTING: 10,
  QUALIFICATION: 30,
  PROPOSAL: 50,
  NEGOTIATION: 75,
  CLOSED_WON: 100,
  CLOSED_LOST: 0,
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const TASK_PRIORITY_ORDER: TaskPriority[] = ["HIGH", "MEDIUM", "LOW"];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

// Badge classes per priority.
export const TASK_PRIORITY_BADGE: Record<TaskPriority, string> = {
  LOW: "bg-yellow-300 text-yellow-900",
  MEDIUM: "bg-orange-400 text-orange-950",
  HIGH: "bg-red-600 text-white",
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  NOTE: "Note",
  TASK: "Task",
};

export const RECURRENCE_OPTIONS = [
  { value: "NONE", label: "Does not repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
] as const;
