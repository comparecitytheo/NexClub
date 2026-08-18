"use client";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_STATUS_ORDER } from "@/lib/labels";
import { LeadListView, type LeadListRow } from "./lead-list-view";
import type { BoardLead } from "./lead-card";

// List view for the My Leads board. Normalises received leads into the shared
// LeadListView rows; the "person" column shows who each lead came From.
export function LeadList({
  leads,
  onOpen,
  onDelete,
  canDelete,
  deletedView,
  bothParties,
  onReopen,
  loading,
}: {
  leads: BoardLead[];
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  canDelete?: (id: string) => boolean;
  deletedView?: boolean;
  bothParties?: boolean;
  onReopen?: (id: string) => void;
  loading?: boolean;
}) {
  // Order mirrors the Kanban: by status column, then board position. Deleted
  // leads are excluded from LEAD_STATUS_ORDER (no board column), so sorting them
  // that way would give every row index -1; they sort by deletion date instead,
  // most recent first, matching the order the server returns.
  const rows: LeadListRow[] = [...leads]
    .sort((a, b) =>
      deletedView
        ? (b.deletedOn ?? "").localeCompare(a.deletedOn ?? "")
        : LEAD_STATUS_ORDER.indexOf(a.status) - LEAD_STATUS_ORDER.indexOf(b.status) ||
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
      // On the Deleted tab every row's status is DELETED, so the stage filter
      // matches the stage the lead held BEFORE deletion — which is what the
      // "Was" column shows and what a member would actually filter by.
      stageValue: deletedView ? (lead.statusBeforeDelete ?? lead.status) : lead.status,
      priority: lead.priority,
      valueEstimate: lead.valueEstimate,
      deletedOn: lead.deletedOn ?? null,
      deletedByName: lead.deletedByName ?? null,
      wasStatusLabel: lead.statusBeforeDelete ? LEAD_STATUS_LABELS[lead.statusBeforeDelete] : null,
      archivedAt: lead.archivedAt ?? null,
      personName: lead.referrerName,
      // Receiver — rendered as the second column on the All view.
      otherPersonName: lead.ownerName,
      followUpDate: lead.followUpDate,
      createdAt: lead.createdAt,
    }));

  const stageOptions = LEAD_STATUS_ORDER.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }));

  return (
    <LeadListView
      rows={rows}
      personLabel="From"
      ariaLabel="Leads"
      onOpen={onOpen}
      onDelete={onDelete}
      canDelete={canDelete}
      deletedView={deletedView}
      bothParties={bothParties}
      onReopen={onReopen}
      loading={loading}
      stageOptions={stageOptions}
      storageKey="leads-stage-filter"
    />
  );
}
