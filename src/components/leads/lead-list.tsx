"use client";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_STATUS_ORDER } from "@/lib/labels";
import { LeadListView, type LeadListRow } from "./lead-list-view";
import type { BoardLead } from "./lead-card";

// List view for the My Leads board. Normalises received leads into the shared
// LeadListView rows; the "person" column shows who each lead came From.
export function LeadList({
  leads,
  onOpen,
  loading,
}: {
  leads: BoardLead[];
  onOpen: (id: string) => void;
  loading?: boolean;
}) {
  // Order to mirror the Kanban: by status column, then board position.
  const rows: LeadListRow[] = [...leads]
    .sort(
      (a, b) =>
        LEAD_STATUS_ORDER.indexOf(a.status) - LEAD_STATUS_ORDER.indexOf(b.status) ||
        a.boardPosition - b.boardPosition
    )
    .map((lead) => ({
      id: lead.id,
      contactName: lead.contactName,
      company: lead.company,
      description: lead.notes,
      statusLabel: LEAD_STATUS_LABELS[lead.status],
      statusBg: LEAD_STATUS_COLORS[lead.status].bg,
      statusText: LEAD_STATUS_COLORS[lead.status].text,
      stageValue: lead.status,
      priority: lead.priority,
      valueEstimate: lead.valueEstimate,
      personName: lead.referrerName,
      followUpDate: lead.followUpDate,
    }));

  const stageOptions = LEAD_STATUS_ORDER.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }));

  return (
    <LeadListView
      rows={rows}
      personLabel="From"
      ariaLabel="Leads"
      onOpen={onOpen}
      loading={loading}
      stageOptions={stageOptions}
      storageKey="leads-stage-filter"
    />
  );
}
