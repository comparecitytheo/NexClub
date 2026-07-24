"use client";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { DealStage } from "@prisma/client";
import { formatCurrency, formatDate } from "@/lib/format";

export type BoardDeal = {
  id: string;
  name: string;
  value: number;
  stage: DealStage;
  probability: number;
  expectedCloseDate: string | null;
  boardPosition: number;
  companyName: string | null;
  contactName: string | null;
  ownerId: string;
  ownerName: string;
};

export function DealCard({ deal }: { deal: BoardDeal }) {
  const subtitle = deal.companyName ?? deal.contactName;
  return (
    <div className="rounded-lg bg-card p-3 transition-shadow hover:shadow-md border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/deals/${deal.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          className="font-medium leading-tight hover:text-primary"
        >
          {deal.name}
        </Link>
        <span className="shrink-0 text-sm font-semibold text-primary">{formatCurrency(deal.value)}</span>
      </div>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{deal.probability}% chance</span>
        {deal.expectedCloseDate && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {formatDate(deal.expectedCloseDate)}
          </span>
        )}
      </div>
    </div>
  );
}
