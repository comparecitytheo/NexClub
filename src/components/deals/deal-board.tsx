"use client";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { DealStage } from "@prisma/client";
import { DEAL_STAGE_ORDER, DEAL_STAGE_LABELS, DEAL_STAGE_DOT } from "@/lib/labels";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { DealCard, type BoardDeal } from "./deal-card";

function DraggableCard({ deal, disabled }: { deal: BoardDeal; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id, disabled });
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
      <DealCard deal={deal} />
    </div>
  );
}

function Column({
  stage,
  deals,
  canMove,
}: {
  stage: DealStage;
  deals: BoardDeal[];
  canMove: (deal: BoardDeal) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = deals.reduce((sum, d) => sum + d.value, 0);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl bg-muted/30 transition-shadow border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]",
        isOver && "ring-2 ring-primary/40"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", DEAL_STAGE_DOT[stage])} />
          <span className="text-sm font-semibold">{DEAL_STAGE_LABELS[stage]}</span>
          <span className="text-xs text-muted-foreground">{deals.length}</span>
        </div>
        {total > 0 && <span className="text-xs text-muted-foreground">{formatCurrency(total)}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {deals.map((d) => (
          <DraggableCard key={d.id} deal={d} disabled={!canMove(d)} />
        ))}
        {deals.length === 0 && <p className="px-1 py-8 text-center text-xs text-muted-foreground">Nothing here yet</p>}
      </div>
    </div>
  );
}

export function DealBoard({
  initialDeals,
  currentUserId,
  isAdmin,
}: {
  initialDeals: BoardDeal[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [deals, setDeals] = useState<BoardDeal[]>(initialDeals);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const canMove = (deal: BoardDeal) => isAdmin || deal.ownerId === currentUserId;

  const grouped = useMemo(() => {
    const visible = query
      ? deals.filter((d) =>
          `${d.name} ${d.companyName ?? ""} ${d.contactName ?? ""}`.toLowerCase().includes(query.toLowerCase())
        )
      : deals;
    const map = {} as Record<DealStage, BoardDeal[]>;
    for (const s of DEAL_STAGE_ORDER) map[s] = [];
    for (const d of visible) (map[d.stage] ??= []).push(d);
    for (const s of DEAL_STAGE_ORDER) map[s].sort((a, b) => a.boardPosition - b.boardPosition);
    return map;
  }, [deals, query]);

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) ?? null : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const dealId = String(active.id);
    const target = over.id as DealStage;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === target) return;
    if (!canMove(deal)) return;

    const previous = deals;
    const position = deals.filter((d) => d.stage === target).length;
    setDeals((ds) => ds.map((d) => (d.id === dealId ? { ...d, stage: target, boardPosition: position } : d)));

    const res = await fetch(`/api/deals/${dealId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: target, boardPosition: position }),
    });
    if (!res.ok) {
      setDeals(previous);
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not move the deal.");
    }
  }

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search deals…"
        className="max-w-xs"
      />
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {DEAL_STAGE_ORDER.map((s) => (
            <Column key={s} stage={s} deals={grouped[s]} canMove={canMove} />
          ))}
        </div>
        <DragOverlay>
          {activeDeal ? (
            <div className="w-72 rotate-1">
              <DealCard deal={activeDeal} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
