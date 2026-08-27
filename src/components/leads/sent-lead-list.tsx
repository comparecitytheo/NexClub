"use client";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_STATUS_ORDER } from "@/lib/labels";
import { LeadListView, type LeadListRow } from "./lead-list-view";
import type { SentBoardLead } from "./sent-lead-card";

// List view for the Sent Leads board. Renders the SAME shared LeadListView as
// the My Leads board so the two stay visually identical; only the data and the
// "person" column differ — here it shows who each lead was Sent to.
export function SentLeadList({
  leads,
  onOpen,
  loading,
}: {
  leads: SentBoardLead[];
  onOpen: (id: string) => void;
  loading?: boolean;
}) {
  // Order to mirror the Kanban: by the recipient's pipeline stage, then name.
  const rows: LeadListRow[] = [...leads]
    .sort(
      (a, b) =>
        LEAD_STATUS_ORDER.indexOf(a.status) - LEAD_STATUS_ORDER.indexOf(b.status) ||
        a.contactName.localeCompare(b.contactName)
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
      personName: lead.ownerName,
      followUpDate: lead.followUpDate,
      createdAt: lead.createdAt,
    }));

  const stageOptions = LEAD_STATUS_ORDER.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }));

  return (
    <LeadListView
      rows={rows}
      personLabel="Sent to"
      ariaLabel="Sent leads"
      onOpen={onOpen}
      loading={loading}
      stageOptions={stageOptions}
      storageKey="sent-leads-stage-filter"
    />
  );
}
