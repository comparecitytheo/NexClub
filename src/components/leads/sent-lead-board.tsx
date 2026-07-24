"use client";
import { useMemo, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, LayoutGrid, List } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { leadMatchesQuery } from "@/lib/lead-search";
import type { LeadStatus } from "@prisma/client";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { SentLeadCard, type SentBoardLead } from "./sent-lead-card";
import { ColumnHeader } from "./column-header";
import { SentLeadPanel } from "./sent-lead-panel";
import { SentLeadList } from "./sent-lead-list";

// The Sent board mirrors the recipient's pipeline: the columns are the shared
// LeadStatus stages — identical to the My Leads board in both Kanban and List —
// and each card sits in the stage the recipient has moved the lead to. Because
// only the recipient can advance a lead through the pipeline
// (see /api/leads/[id]/status), this board is read-only: the sender opens a
// lead but does not drag it. When the recipient moves a lead it shows up in the
// matching column on the next load here, and the sender is notified in the bell.

function Column({
  status,
  leads,
  onOpen,
}: {
  status: LeadStatus;
  leads: SentBoardLead[];
  onOpen: (id: string) => void;
}) {
  const total = leads.reduce((s, l) => s + (l.valueEstimate ?? 0), 0);
  return (
    <div className="kanban-scroll flex h-full min-w-[280px] flex-1 flex-col rounded-xl bg-muted border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <ColumnHeader
        bg={LEAD_STATUS_COLORS[status].bg}
        fg={LEAD_STATUS_COLORS[status].text}
        label={LEAD_STATUS_LABELS[status]}
        count={leads.length}
        total={total}
      />
      <div className="flex flex-col gap-2 p-2">
        {leads.map((l) => (
          <SentLeadCard key={l.id} lead={l} onOpen={() => onOpen(l.id)} />
        ))}
        {leads.length === 0 && <p className="px-1 py-8 text-center text-xs text-muted-foreground">Nothing here yet</p>}
      </div>
    </div>
  );
}

export function SentLeadBoard({
  initialLeads,
  members,
  currentUserId,
}: {
  initialLeads: SentBoardLead[];
  members: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [leads, setLeads] = useState<SentBoardLead[]>(initialLeads);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  // Kanban | List display toggle, mirroring the My Leads board. Kept under its
  // own key so each board remembers its own view independently. Kanban default.
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sent-leads-view-mode");
      if (saved === "list" || saved === "kanban") setViewMode(saved);
    } catch {
      /* localStorage unavailable — keep the Kanban default */
    }
  }, []);
  function chooseView(mode: "kanban" | "list") {
    setViewMode(mode);
    try {
      localStorage.setItem("sent-leads-view-mode", mode);
    } catch {
      /* ignore persistence failure */
    }
  }

  // The open lead lives in the URL (?lead=<id>) rather than local state, so the
  // router owns it: tapping any nav tab — including the tab you're already on,
  // which clears the param — changes the URL and dismisses this panel, and the
  // browser/Android Back button closes it too.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("lead");

  const filtered = useMemo(
    () => leads.filter((l) => leadMatchesQuery(l, debouncedQuery)),
    [leads, debouncedQuery]
  );

  const grouped = useMemo(() => {
    const map = {} as Record<LeadStatus, SentBoardLead[]>;
    for (const s of LEAD_STATUS_ORDER) map[s] = [];
    for (const l of filtered) (map[l.status] ??= []).push(l);
    return map;
  }, [filtered]);

  const total = leads.length;

  function openPanel(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lead", id);
    router.push(`${pathname}?${params.toString()}`); // open as full-screen, URL-backed
  }
  // Close button clears the ?lead param via replace() so it doesn't stack an
  // extra history entry.
  function closePanel() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lead");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {!selectedId && (
        <>
          <div className="flex w-full shrink-0 flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, company, email, phone…"
                aria-label="Search leads"
                className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="inline-flex rounded-lg bg-card p-0.5 border border-muted-foreground/80 shadow-[0_6px_20px_rgba(0,0,0,0.16)]" role="group" aria-label="View as grid or list">
                <button
                  type="button"
                  onClick={() => chooseView("kanban")}
                  aria-pressed={viewMode === "kanban"}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    viewMode === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => chooseView("list")}
                  aria-pressed={viewMode === "list"}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
            </div>
          </div>

          {total === 0 ? (
            <div className="rounded-xl bg-card p-10 text-center border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
              <p className="text-sm font-medium">You haven&apos;t sent any leads yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use Send a Lead to refer an opportunity to another member — it&apos;ll show up here.
              </p>
            </div>
          ) : viewMode === "kanban" ? (
            <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto rounded-xl bg-card p-3 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
              {LEAD_STATUS_ORDER.map((s) => (
                <Column key={s} status={s} leads={grouped[s]} onOpen={openPanel} />
              ))}
            </div>
          ) : (
            <SentLeadList leads={filtered} onOpen={openPanel} />
          )}
        </>
      )}

      {selectedId && (
        <SentLeadPanel
          leadId={selectedId}
          members={members}
          currentUserId={currentUserId}
          onClose={closePanel}
          onBump={(field) =>
            setLeads((ls) =>
              ls.map((l) =>
                l.id === selectedId
                  ? {
                      ...l,
                      taskCount: l.taskCount + (field === "task" ? 1 : 0),
                      commentCount: l.commentCount + (field === "comment" ? 1 : 0),
                    }
                  : l
              )
            )
          }
          onValue={(value) => setLeads((ls) => ls.map((l) => (l.id === selectedId ? { ...l, valueEstimate: value } : l)))}
        />
      )}
    </div>
  );
}
