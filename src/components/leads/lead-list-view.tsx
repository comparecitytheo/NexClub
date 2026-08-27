"use client";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, RotateCcw, Trash2 } from "lucide-react";
import { LEAD_PRIORITY_META } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import type { LeadPriority } from "@prisma/client";

// Single source of truth for the leads list view, shared by BOTH the My Leads
// board (LeadList) and the Sent Leads board (SentLeadList). The two boards pass
// the same row shape; only the data source and the "person" column label differ
// (My Leads shows who a lead came From; Sent Leads shows who it was Sent to).
// Keeping the markup here means the two lists cannot drift apart again.
export type LeadListRow = {
  id: string;
  contactName: string;
  company: string | null;
  description: string | null;
  statusLabel: string;
  statusBg: string;
  statusText: string;
  stageValue: string;
  priority?: LeadPriority | null;
  valueEstimate: number | null;
  personName: string;
  /** The other party. Set on the All view so a row shows sender AND receiver. */
  otherPersonName?: string | null;
  followUpDate: string | null;
  /** When the lead was created. Shown as a secondary column. */
  createdAt: string;
  // Deleted view only.
  deletedOn?: string | null;
  deletedByName?: string | null;
  wasStatusLabel?: string | null;
  archivedAt?: string | null;
};

export function LeadListView({
  rows,
  personLabel,
  ariaLabel,
  onOpen,
  onDelete,
  canDelete,
  deletedView,
  bothParties,
  onReopen,
  loading,
  stageOptions,
  storageKey,
}: {
  rows: LeadListRow[];
  personLabel: string;
  ariaLabel: string;
  onOpen: (id: string) => void;
  /** When supplied, each row gets a delete action. Omit to render a read-only list. */
  onDelete?: (id: string) => void;
  /** Per-row permission. When it returns false the delete control is hidden. */
  canDelete?: (id: string) => boolean;
  /** Deleted tab: swaps Status/Priority/Follow-up for the deletion trail. */
  deletedView?: boolean;
  /** All view: show both the sender and the receiver instead of one person. */
  bothParties?: boolean;
  /** Deleted view: renders a Reopen action on each row. */
  onReopen?: (id: string) => void;
  loading?: boolean;
  stageOptions: { value: string; label: string }[];
  storageKey: string;
}) {
  // Stage filter (multi-select). Persisted in localStorage under a per-list key,
  // the same pattern the board uses for its view-mode pref. Empty = show all.
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setSelectedStages(parsed.filter((v): v is string => typeof v === "string"));
      }
    } catch {
      /* localStorage unavailable — keep the default (show all) */
    }
  }, [storageKey]);

  function toggleStage(value: string) {
    setSelectedStages((prev) => {
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore persistence failure */
      }
      return next;
    });
  }

  const filtered = useMemo(
    () => (selectedStages.length === 0 ? rows : rows.filter((r) => selectedStages.includes(r.stageValue))),
    [rows, selectedStages]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div className="flex shrink-0 items-center border-b px-4 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]"
            >
              Sort
              {selectedStages.length > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {selectedStages.length}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Filter by stage</DropdownMenuLabel>
            {stageOptions.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={selectedStages.includes(opt.value)}
                onCheckedChange={() => toggleStage(opt.value)}
                onSelect={(e) => e.preventDefault()}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
        aria-hidden="true"
      >
        <span className="min-w-0 flex-1">Lead</span>
        <span className="hidden min-w-0 flex-1 md:block">Description</span>
        {deletedView ? (
          <>
            <span className="w-32 shrink-0">Was</span>
            <span className="hidden w-32 shrink-0 sm:block">Deleted</span>
            <span className="hidden w-36 shrink-0 lg:block">Deleted by</span>
          </>
        ) : (
          <>
            <span className="w-32 shrink-0">Status</span>
            <span className="hidden w-28 shrink-0 sm:block">Priority</span>
            {bothParties ? (
              <>
                <span className="hidden w-32 shrink-0 lg:block">From</span>
                <span className="hidden w-32 shrink-0 lg:block">To</span>
              </>
            ) : (
              <span className="hidden w-36 shrink-0 lg:block">{personLabel}</span>
            )}
            {!bothParties && (
              <span className="hidden w-28 shrink-0 lg:block">Follow-up</span>
            )}
            <span className="hidden w-36 shrink-0 xl:block">Created</span>
          </>
        )}
        {/* Reserved so the row's action buttons, which sit outside the clickable
            content area, do not shift every heading out of line with its data. */}
        {/* Reserves the action column so every heading lines up with its data. The
              row's actions are w-28 (112px) with NO gap before them, while this
              header has gap-3 (12px) between children — so spacer + gap must come
              to 112px. w-28 here reserved 124px and pushed every heading 12px left. */}
          {(onDelete || onReopen) && <span className="w-[100px] shrink-0" />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" role="list" aria-label={ariaLabel}>
        {loading ? (
          <div className="flex h-full items-center justify-center p-10 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center p-10 text-center text-sm text-muted-foreground">
            No leads match your current filters.
          </div>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className="group flex w-full items-center border-b transition-colors last:border-b-0 hover:bg-accent"
            >
            <button
              type="button"
              onClick={() => onOpen(row.id)}
              aria-label={`${row.contactName}${row.company ? `, ${row.company}` : ""} — ${row.statusLabel}`}
              className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{row.contactName}</span>
                {row.company && <span className="block truncate text-xs text-muted-foreground">{row.company}</span>}
              </span>
              <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground md:block">
                {row.description || "—"}
              </span>
              <span className="w-32 shrink-0">
                {deletedView ? (
                  // The stage it held before deletion — "Deleted" on every row
                  // would carry no information.
                  <span className="text-xs text-muted-foreground">{row.wasStatusLabel ?? "—"}</span>
                ) : (
                  <span
                    className="inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: row.statusBg, color: row.statusText }}
                  >
                    {row.statusLabel}
                  </span>
                )}
              </span>
              <span className={cn("hidden shrink-0 sm:block", deletedView ? "w-32" : "w-28")}>
                {deletedView ? (
                  <span className="text-xs text-muted-foreground">
                    {row.deletedOn ? formatDate(row.deletedOn) : "—"}
                  </span>
                ) : row.priority && row.priority !== "LOW" ? (
                  <span
                    className="inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: LEAD_PRIORITY_META[row.priority].bg, color: LEAD_PRIORITY_META[row.priority].text }}
                  >
                    {LEAD_PRIORITY_META[row.priority].label}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </span>
              {bothParties ? (
                <>
                  <span className="hidden w-32 shrink-0 truncate text-xs text-muted-foreground lg:block">
                    {row.personName}
                  </span>
                  <span className="hidden w-32 shrink-0 truncate text-xs text-muted-foreground lg:block">
                    {row.otherPersonName ?? "—"}
                  </span>
                </>
              ) : (
                <span className="hidden w-36 shrink-0 truncate text-xs text-muted-foreground lg:block">
                  {deletedView ? (row.deletedByName ?? "Automatic") : row.personName}
                </span>
              )}
              {/* Archive is no longer surfaced — deleted leads live only on this
                  tab, so the archived date is an internal marker now. */}
              {!deletedView && !bothParties && (
                <span className="hidden w-28 shrink-0 text-xs text-muted-foreground lg:block">
                  {row.followUpDate ? formatDate(row.followUpDate) : "—"}
                </span>
              )}
              {/* Secondary detail: same muted styling as the other meta columns,
                  and the first to drop on narrow screens. */}
              {!deletedView && (
                <span className="hidden w-36 shrink-0 text-xs text-muted-foreground xl:block">
                  {formatDateTime(row.createdAt)}
                </span>
              )}
            </button>
            <div className="flex w-28 shrink-0 items-center justify-end gap-1 pr-2">
            {onReopen && (
              <button
                type="button"
                onClick={() => onReopen(row.id)}
                aria-label={`Reopen ${row.contactName}`}
                title={
                  row.wasStatusLabel
                    ? `Reopen — returns to ${row.wasStatusLabel}`
                    : "Reopen lead"
                }
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reopen</span>
              </button>
            )}
            {onDelete && (!canDelete || canDelete(row.id)) && (
              <button
                type="button"
                onClick={() => onDelete(row.id)}
                aria-label={`Delete ${row.contactName}`}
                title="Delete lead"
                className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
