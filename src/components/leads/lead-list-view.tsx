"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LEAD_PRIORITY_META } from "@/lib/labels";
import { formatDate } from "@/lib/format";
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
  followUpDate: string | null;
};

export function LeadListView({
  rows,
  personLabel,
  ariaLabel,
  onOpen,
  loading,
  stageOptions,
  storageKey,
}: {
  rows: LeadListRow[];
  personLabel: string;
  ariaLabel: string;
  onOpen: (id: string) => void;
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
        <span className="w-32 shrink-0">Status</span>
        <span className="hidden w-28 shrink-0 sm:block">Priority</span>
        <span className="hidden w-36 shrink-0 lg:block">{personLabel}</span>
        <span className="hidden w-28 shrink-0 lg:block">Follow-up</span>
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
            <button
              key={row.id}
              type="button"
              onClick={() => onOpen(row.id)}
              aria-label={`${row.contactName}${row.company ? `, ${row.company}` : ""} — ${row.statusLabel}`}
              className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{row.contactName}</span>
                {row.company && <span className="block truncate text-xs text-muted-foreground">{row.company}</span>}
              </span>
              <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground md:block">
                {row.description || "—"}
              </span>
              <span className="w-32 shrink-0">
                <span
                  className="inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: row.statusBg, color: row.statusText }}
                >
                  {row.statusLabel}
                </span>
              </span>
              <span className="hidden w-28 shrink-0 sm:block">
                {row.priority && row.priority !== "LOW" ? (
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
              <span className="hidden w-36 shrink-0 truncate text-xs text-muted-foreground lg:block">{row.personName}</span>
              <span className="hidden w-28 shrink-0 text-xs text-muted-foreground lg:block">
                {row.followUpDate ? formatDate(row.followUpDate) : "—"}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
