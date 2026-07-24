import type { DealStage } from "@prisma/client";

// When a deal enters a closed stage, stamp the close date and win flag; otherwise clear them.
export function closedFields(stage: DealStage): { closedAt: Date | null; isWon: boolean | null } {
  if (stage === "CLOSED_WON") return { closedAt: new Date(), isWon: true };
  if (stage === "CLOSED_LOST") return { closedAt: new Date(), isWon: false };
  return { closedAt: null, isWon: null };
}
