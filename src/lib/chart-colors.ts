import { LeadStatus, DealStage } from "@prisma/client";

export const PRIMARY_HEX = "#7B1E3A";

export const LEAD_STATUS_HEX: Record<LeadStatus, string> = {
  NEW: "#94a3b8",
  CONTACTED: "#38bdf8",
  IN_PROGRESS: "#f97316",
  CLOSED_WON: "#10b981",
  CLOSED_LOST: "#fb7185",
  DELETED: "#94a3b8",
};

export const DEAL_STAGE_HEX: Record<DealStage, string> = {
  PROSPECTING: "#94a3b8",
  QUALIFICATION: "#38bdf8",
  PROPOSAL: "#14b8a6",
  NEGOTIATION: "#fbbf24",
  CLOSED_WON: "#10b981",
  CLOSED_LOST: "#fb7185",
};
