"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { Download, LayoutGrid, List, Search, Trash2 } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { leadMatchesQuery } from "@/lib/lead-search";
import { REFRESH_EVENT } from "@/components/shared/refresh-control";
import { LeadStatus } from "@prisma/client";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LeadCard, type BoardLead } from "./lead-card";
import { ColumnHeader } from "./column-header";
import { ReceivedLeadPanel } from "./received-lead-panel";
import { LeadList } from "./lead-list";

type View = "received" | "sent" | "all" | "deleted";

// Droppable columns are keyed with a board-scoped prefix (not the bare status
// string) so a column id can never collide with a draggable card id and the drop
// destination always resolves unambiguously to a stage within THIS board.
const COLUMN_PREFIX = "col:";
const columnId = (status: LeadStatus) => `${COLUMN_PREFIX}${status}`;
function statusFromDroppable(id: string | number): LeadStatus | null {
  const s = String(id);
  return s.startsWith(COLUMN_PREFIX) ? (s.slice(COLUMN_PREFIX.length) as LeadStatus) : null;
}

// Map an API lead (Decimal serialised as string, nested owner/referrer) into a flat BoardLead.
function normalise(l: Record<string, unknown>): BoardLead {
  const owner = (l.owner ?? {}) as { id?: string; name?: string; businessName?: string | null; avatarUrl?: string | null };
  const referrer = (l.referrer ?? {}) as { id?: string; name?: string; avatarUrl?: string | null; businessName?: string | null };
  const deletedBy = (l.deletedBy ?? null) as { name?: string } | null;
  return {
    id: String(l.id),
    contactName: String(l.contactName ?? ""),
    company: (l.company as string) ?? null,
    email: (l.email as string) ?? null,
    phone: (l.phone as string) ?? null,
    industry: (l.industry as string) ?? null,
    valueEstimate: l.valueEstimate == null ? null : Number(l.valueEstimate),
    notes: (l.notes as string) ?? null,
    status: l.status as LeadStatus,
    source: l.source as BoardLead["source"],
    followUpDate: (l.followUpDate as string) ?? null,
    boardPosition: Number(l.boardPosition ?? 0),
    ownerId: (l.ownerId as string) ?? owner.id ?? "",
    ownerName: owner.name ?? "",
    referrerId: (l.referrerId as string) ?? referrer.id ?? "",
    referrerName: referrer.name ?? "",
    referrerAvatarUrl: referrer.avatarUrl ?? null,
    createdAt: typeof l.createdAt === "string" ? l.createdAt : new Date(String(l.createdAt)).toISOString(),
    referrerBusinessName: referrer.businessName ?? null,
    ownerBusinessName: owner.businessName ?? null,
    ownerAvatarUrl: owner.avatarUrl ?? null,
    priority: l.priority as BoardLead["priority"],
    deletedOn: (l.deletedOn as string) ?? null,
    deletedByName: deletedBy?.name ?? null,
    statusBeforeDelete: (l.statusBeforeDelete as LeadStatus) ?? null,
    archivedAt: (l.archivedAt as string) ?? null,
  };
}

function DraggableCard({
  lead,
  currentUserId,
  disabled,
  onOpen,
  onDelete,
  showBothParties,
}: {
  lead: BoardLead;
  currentUserId: string;
  disabled: boolean;
  onOpen: () => void;
  onDelete?: (id: string) => void;
  showBothParties?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "relative touch-none",
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <LeadCard lead={lead} currentUserId={currentUserId} onOpen={onOpen} showBothParties={showBothParties} />
      {onDelete && (
        // Sibling of the card, not a child: the card itself is a <button>, so a
        // nested button would be invalid markup. stopPropagation on pointerdown
        // keeps the drag sensor from claiming the click.
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(lead.id);
          }}
          aria-label={`Delete ${lead.contactName}`}
          title="Delete lead"
          className="absolute right-1.5 top-1.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function Column({
  status,
  leads,
  currentUserId,
  canMove,
  canDelete,
  onOpen,
  onDelete,
  showBothParties,
}: {
  status: LeadStatus;
  leads: BoardLead[];
  currentUserId: string;
  canMove: (lead: BoardLead) => boolean;
  canDelete: (lead: BoardLead) => boolean;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  showBothParties?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
  const total = leads.reduce((sum, l) => sum + (l.valueEstimate ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "kanban-scroll flex h-full min-w-[280px] flex-1 flex-col rounded-xl bg-muted transition-shadow border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]",
        isOver && "ring-2 ring-primary/40"
      )}
    >
      <ColumnHeader
        bg={LEAD_STATUS_COLORS[status].bg}
        fg={LEAD_STATUS_COLORS[status].text}
        label={LEAD_STATUS_LABELS[status]}
        count={leads.length}
        total={total}
      />
      <div className="flex flex-col gap-2 p-2">
        {leads.map((l) => (
          <DraggableCard key={l.id} lead={l} currentUserId={currentUserId} disabled={!canMove(l)} onOpen={() => onOpen(l.id)} onDelete={canDelete(l) ? onDelete : undefined} showBothParties={showBothParties} />
        ))}
        {leads.length === 0 && (
          <p className="px-1 py-8 text-center text-xs text-muted-foreground">Nothing here yet</p>
        )}
      </div>
    </div>
  );
}

const VIEWS: { value: View; label: string }[] = [
  { value: "received", label: "Received" },
  { value: "sent", label: "Sent" },
  { value: "all", label: "All" },
  { value: "deleted", label: "Deleted" },
];

export function LeadBoard({
  initialLeads,
  currentUserId,
  isAdmin,
  isSuperAdmin,
  defaultView,
  members,
  rangeFrom,
  rangeTo,
}: {
  initialLeads: BoardLead[];
  currentUserId: string;
  isAdmin: boolean;
  /** Super Admins see every deleted lead on the Deleted tab, not just their own. */
  isSuperAdmin: boolean;
  defaultView: View;
  members: { id: string; name: string }[];
  /** Active date range, forwarded on refetch so the range survives a view switch. */
  rangeFrom: string;
  rangeTo: string;
}) {
  const [view, setView] = useState<View>(defaultView);
  const [leads, setLeads] = useState<BoardLead[]>(initialLeads);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // The open lead lives in the URL (?lead=<id>) rather than local state, so the
  // router owns it: tapping any nav tab — including the tab you're already on,
  // which clears the param — changes the URL and dismisses this panel, and the
  // browser/Android Back button closes it too. (Was local useState the router
  // couldn't see, so a same-route tab tap left the user stuck on the lead view.)
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("lead");
  // Real-time search. `query` updates the input immediately; `debouncedQuery`
  // (300ms behind) is what actually filters, so typing stays smooth.
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  // Kanban | List display toggle. Kanban is the default on first load; the
  // choice persists in localStorage (same pattern as the sidebar collapse pref).
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("leads-view-mode");
      if (saved === "list" || saved === "kanban") setViewMode(saved);
    } catch {
      /* localStorage unavailable — keep the Kanban default */
    }
  }, []);
  function chooseView(mode: "kanban" | "list") {
    setViewMode(mode);
    try {
      localStorage.setItem("leads-view-mode", mode);
    } catch {
      /* ignore persistence failure */
    }
  }
  const skipFetch = useRef(true);
  const suppressClick = useRef(false);
  // True while a refetch is in flight. A ref, not state, so the interval always
  // reads the current value and the guard never triggers a re-render.
  const inFlight = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (skipFetch.current) {
      skipFetch.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/leads?view=${view}&from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setLeads(((data.items as Record<string, unknown>[]) ?? []).map(normalise));
      })
      .catch(() => toast.error("Could not load leads."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, rangeFrom, rangeTo]);

  const canMove = (lead: BoardLead) => isAdmin || lead.ownerId === currentUserId;

  // Mirrors the server rule in DELETE /api/leads/[id]: only the member who sent
  // the referral, or an admin/super admin, may delete it. Receivers cannot.
  // Showing the control to anyone else would just produce a 403 on click.
  const canDelete = (lead: BoardLead) => isAdmin || lead.referrerId === currentUserId;

  const selectedLead = leads.find((l) => l.id === selectedId);

  // Reopen a deleted lead straight from the Deleted list. The server restores
  // the stage it held before deletion, so the row leaves this view.
  async function reopenLead(leadId: string) {
    const target = leads.find((l) => l.id === leadId);
    const was = target?.statusBeforeDelete ? LEAD_STATUS_LABELS[target.statusBeforeDelete] : "your pipeline";
    if (!confirm(`Reopen ${target?.contactName ?? "this lead"}? It returns to ${was}.`)) return;
    const res = await fetch(`/api/leads/${leadId}/reopen`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not reopen the lead.");
      return;
    }
    setLeads((ls) => ls.filter((l) => l.id !== leadId));
    toast.success("Lead reopened.");
    reload();
  }

  // Delete from the list. Deleting is a status transition on the server, not a
  // removal — the lead moves into DELETED status and is archived on the 1st.
  // The row is dropped locally for immediate feedback, then reconciled by the
  // reload so the board matches the server.
  async function deleteLead(leadId: string): Promise<boolean> {
    const target = leads.find((l) => l.id === leadId);
    if (!confirm(`Delete ${target?.contactName ?? "this lead"}? It moves to the archive and is not removed.`)) return false;
    const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not delete the lead.");
      return false;
    }
    setLeads((ls) => ls.filter((l) => l.id !== leadId));
    toast.success("Lead deleted.");
    reload();
    return true;
  }

  // Re-pull the board from the server. Shared by three callers: the drag
  // reconcile after a concurrent move, the auto-refresh interval, and the manual
  // Refresh button. It never touches `loading`, so the board refreshes in place —
  // no spinner flash, no scroll reset. A failed fetch is swallowed on purpose so
  // the last good board stays on screen; the next tick (or click) retries.
  const reload = useCallback(
    () => {
      // Skip while a previous fetch is still running so slow responses can never
      // queue up or overlap.
      if (inFlight.current) return;
      inFlight.current = true;
      fetch(`/api/leads?view=${view}&from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`)
        .then((r) => r.json())
        .then((data) => setLeads(((data.items as Record<string, unknown>[]) ?? []).map(normalise)))
        .catch(() => {
          /* keep the last good data on screen; the next refresh retries */
        })
        .finally(() => {
          inFlight.current = false;
        });
    },
    [view, rangeFrom, rangeTo]
  );

  // The header's RefreshControl owns the auto-refresh cadence and the manual button for the
  // whole app; this board just re-pulls its own data whenever that fires. Listening
  // rather than running a second timer keeps the board in step with the countdown
  // and avoids two competing intervals on this page. Removed on unmount.
  useEffect(() => {
    const onRefresh = () => reload();
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
  }, [reload]);

  // Filter across the shared lead-search fields. Runs over the leads already
  // loaded for the active view, so search composes with the view tabs.
  const filtered = useMemo(
    () => leads.filter((l) => leadMatchesQuery(l, debouncedQuery)),
    [leads, debouncedQuery]
  );

  const grouped = useMemo(() => {
    const map = {} as Record<LeadStatus, BoardLead[]>;
    for (const s of LEAD_STATUS_ORDER) map[s] = [];
    for (const l of filtered) (map[l.status] ??= []).push(l);
    for (const s of LEAD_STATUS_ORDER) map[s].sort((a, b) => a.boardPosition - b.boardPosition);
    return map;
  }, [filtered]);

  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null;

  function onDragStart(e: DragStartEvent) {
    suppressClick.current = true;
    setActiveId(String(e.active.id));
  }

  function openPanel(id: string) {
    if (suppressClick.current) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("lead", id);
    router.push(`${pathname}?${params.toString()}`); // open as full-screen, now URL-backed
  }
  // Close button keeps its existing behaviour (return to the list); it just clears
  // the ?lead param via replace() so it doesn't stack an extra history entry.
  function closePanel() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lead");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = e;
    if (!over) return;

    const leadId = String(active.id);
    // Only accept drops onto a column droppable that belongs to this board.
    const target = statusFromDroppable(over.id);
    if (!target) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === target) return;
    if (!canMove(lead)) {
      toast.error("You can only move leads assigned to you.");
      return;
    }

    const previous = leads;
    const position = leads.filter((l) => l.status === target).length;
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, status: target, boardPosition: position } : l)));

    const res = await fetch(`/api/leads/${leadId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: target, boardPosition: position, fromStatus: lead.status }),
    });
    if (!res.ok) {
      setLeads(previous);
      const d = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.error(d.error ?? "This lead was just moved by someone else.");
        reload(); // re-sync to the latest server state
      } else {
        toast.error(d.error ?? "Could not move the lead.");
      }
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {!selectedId && (
        <>
      {/* Sits directly beneath the page's "My Leads" heading and explains the
          active tab. -mt-4 pulls it up against the heading, since the page wraps
          its children in gap-6. */}
      <p className="-mt-2 shrink-0 text-sm text-muted-foreground">
        {view === "received"
          ? "Leads other members have sent to you."
          : view === "sent"
            ? "Leads you have referred out to other members."
            : view === "deleted"
              ? isSuperAdmin
                ? "Every deleted lead in the club, including archived."
                : "Leads you deleted, including archived."
              : "All of your leads, sent and received."}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {/* Fixed width, no flex-grow: a stretching search bar was what pushed
            the toggles apart. The auto margin lives on the view toggle below. */}
        <div className="relative w-full shrink-0 sm:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, email, phone…"
            aria-label="Search leads"
            className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        {/* Fixed-width slot: the loading label used to sit between the toggle
            and the search box, so it shoved them sideways every time a view
            switched. Reserving the space keeps the row completely still. */}
        <span className="w-14 shrink-0 text-xs text-muted-foreground" aria-live="polite">
          {loading ? "Loading…" : ""}
        </span>
        {view === "deleted" && isSuperAdmin && (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            {/* A file download, not a page navigation — Link would route it. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/leads/deleted/export">
              <Download className="h-4 w-4" /> Export CSV
            </a>
          </Button>
        )}
        {/* ml-auto puts every remaining pixel BEFORE this, so the view toggle
            and the grid/list toggle sit flush together on the right. */}
        <div className="inline-flex sm:ml-auto rounded-lg bg-card p-0.5 border border-muted-foreground/80 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              onClick={() => setView(v.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === v.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {/* Deleted is a record, not a pipeline — always a list, so the
              grid/list choice is hidden rather than shown doing nothing. */}
          {view !== "deleted" && (
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
          )}
        </div>
      </div>

      {viewMode === "kanban" && view !== "deleted" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto rounded-xl bg-card p-3 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          {LEAD_STATUS_ORDER.map((s) => (
            <Column key={s} status={s} leads={grouped[s]} currentUserId={currentUserId} canMove={canMove} canDelete={canDelete} onOpen={openPanel} onDelete={deleteLead} showBothParties={view === "all"} />
          ))}
        </div>
        <DragOverlay>
          {activeLead ? (
            <div className="w-72 rotate-1">
              <LeadCard lead={activeLead} currentUserId={currentUserId} showBothParties={view === "all"} />
            </div>
          ) : null}
        </DragOverlay>
        </DndContext>
      ) : (
        <LeadList
          leads={filtered}
          onOpen={openPanel}
          onDelete={deleteLead}
          deletedView={view === "deleted"}
          bothParties={view === "all"}
          onReopen={view === "deleted" ? reopenLead : undefined}
          canDelete={(id) => {
            // Nothing on the Deleted tab can be deleted again.
            if (view === "deleted") return false;
            const l = leads.find((x) => x.id === id);
            return l ? canDelete(l) : false;
          }}
          loading={loading}
        />
      )}
        </>
      )}

      {selectedId && (
        <ReceivedLeadPanel
          leadId={selectedId}
          members={members}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={closePanel}
          onDelete={
            // Undefined hides the control entirely for a member viewing a lead
            // sent TO them, who is not permitted to delete it.
            selectedLead && !canDelete(selectedLead)
              ? undefined
              : async (id: string) => {
                  // Close only once the delete succeeded, so a cancelled confirm
                  // or a failed request leaves the panel open.
                  if (await deleteLead(id)) closePanel();
                }
          }
          onStatus={(status) => {
            // A reopen fires this with a live status while the Deleted tab is
            // showing, so the row must leave the list rather than sit there with
            // a stage it no longer matches.
            if (view === "deleted" && status !== "DELETED") {
              setLeads((ls) => ls.filter((l) => l.id !== selectedId));
              reload();
              return;
            }
            setLeads((ls) => ls.map((l) => (l.id === selectedId ? { ...l, status, boardPosition: 0 } : l)));
          }}
          onValue={(value) =>
            setLeads((ls) => ls.map((l) => (l.id === selectedId ? { ...l, valueEstimate: value } : l)))
          }
        />
      )}
    </div>
  );
}
