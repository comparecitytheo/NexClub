"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Search, LayoutGrid, List } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { leadMatchesQuery } from "@/lib/lead-search";
import { LeadStatus } from "@prisma/client";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { LeadCard, type BoardLead } from "./lead-card";
import { ColumnHeader } from "./column-header";
import { ReceivedLeadPanel } from "./received-lead-panel";
import { LeadList } from "./lead-list";

type View = "received" | "sent" | "all";

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
  const owner = (l.owner ?? {}) as { id?: string; name?: string };
  const referrer = (l.referrer ?? {}) as { id?: string; name?: string; avatarUrl?: string | null };
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
    priority: l.priority as BoardLead["priority"],
  };
}

function DraggableCard({
  lead,
  currentUserId,
  disabled,
  onOpen,
}: {
  lead: BoardLead;
  currentUserId: string;
  disabled: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none",
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <LeadCard lead={lead} currentUserId={currentUserId} onOpen={onOpen} />
    </div>
  );
}

function Column({
  status,
  leads,
  currentUserId,
  canMove,
  onOpen,
}: {
  status: LeadStatus;
  leads: BoardLead[];
  currentUserId: string;
  canMove: (lead: BoardLead) => boolean;
  onOpen: (id: string) => void;
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
          <DraggableCard key={l.id} lead={l} currentUserId={currentUserId} disabled={!canMove(l)} onOpen={() => onOpen(l.id)} />
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
];

export function LeadBoard({
  initialLeads,
  currentUserId,
  isAdmin,
  defaultView,
  members,
}: {
  initialLeads: BoardLead[];
  currentUserId: string;
  isAdmin: boolean;
  defaultView: View;
  members: { id: string; name: string }[];
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (skipFetch.current) {
      skipFetch.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/leads?view=${view}`)
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
  }, [view]);

  const canMove = (lead: BoardLead) => isAdmin || lead.ownerId === currentUserId;

  // Re-pull the board from the server (used to reconcile after a concurrent move).
  function reload() {
    fetch(`/api/leads?view=${view}`)
      .then((r) => r.json())
      .then((data) => setLeads(((data.items as Record<string, unknown>[]) ?? []).map(normalise)))
      .catch(() => {});
  }

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
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg bg-card p-0.5 border border-muted-foreground/80 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
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
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
        <div className="relative w-full max-w-xs">
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
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {view === "received" ? "Leads sent to you" : view === "sent" ? "Leads you referred out" : "Everything you can see"}
          </span>
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

      {viewMode === "kanban" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto rounded-xl bg-card p-3 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          {LEAD_STATUS_ORDER.map((s) => (
            <Column key={s} status={s} leads={grouped[s]} currentUserId={currentUserId} canMove={canMove} onOpen={openPanel} />
          ))}
        </div>
        <DragOverlay>
          {activeLead ? (
            <div className="w-72 rotate-1">
              <LeadCard lead={activeLead} currentUserId={currentUserId} />
            </div>
          ) : null}
        </DragOverlay>
        </DndContext>
      ) : (
        <LeadList leads={filtered} onOpen={openPanel} loading={loading} />
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
          onStatus={(status) =>
            setLeads((ls) => ls.map((l) => (l.id === selectedId ? { ...l, status, boardPosition: 0 } : l)))
          }
          onValue={(value) =>
            setLeads((ls) => ls.map((l) => (l.id === selectedId ? { ...l, valueEstimate: value } : l)))
          }
        />
      )}
    </div>
  );
}
