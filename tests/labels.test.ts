import { describe, it, expect } from "vitest";
import {
  LEAD_STATUS_ORDER,
  LEAD_STATUS_LABELS,
  DEAL_STAGE_ORDER,
  DEAL_STAGE_LABELS,
  TASK_PRIORITY_ORDER,
  TASK_PRIORITY_LABELS,
  ACTIVITY_TYPE_LABELS,
} from "@/lib/labels";

describe("label maps", () => {
  it("orders the lead pipeline with closed stages last", () => {
    expect(LEAD_STATUS_ORDER).toHaveLength(5);
    expect(LEAD_STATUS_ORDER[0]).toBe("NEW");
    expect(LEAD_STATUS_ORDER.at(-1)).toBe("CLOSED_LOST");
  });
  it("labels every lead status", () => {
    for (const s of LEAD_STATUS_ORDER) expect(LEAD_STATUS_LABELS[s]).toBeTruthy();
  });
  it("orders and labels every deal stage", () => {
    expect(DEAL_STAGE_ORDER).toHaveLength(6);
    for (const s of DEAL_STAGE_ORDER) expect(DEAL_STAGE_LABELS[s]).toBeTruthy();
  });
  it("orders task priority high to low", () => {
    expect(TASK_PRIORITY_ORDER).toEqual(["HIGH", "MEDIUM", "LOW"]);
    for (const p of TASK_PRIORITY_ORDER) expect(TASK_PRIORITY_LABELS[p]).toBeTruthy();
  });
  it("labels activity types", () => {
    expect(ACTIVITY_TYPE_LABELS.CALL).toBe("Call");
    expect(ACTIVITY_TYPE_LABELS.MEETING).toBe("Meeting");
  });
});
