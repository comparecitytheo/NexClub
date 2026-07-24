"use client";
import { CalendarClock } from "lucide-react";
import { LeadStatus, LeadSource, LeadPriority } from "@prisma/client";
import { LEAD_SOURCE_LABELS, LEAD_PRIORITY_META } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Badge } from "@/components/ui/badge";

export type BoardLead = {
  id: string;
  contactName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  valueEstimate: number | null;
  notes: string | null;
  status: LeadStatus;
  source: LeadSource;
  followUpDate: string | null;
  boardPosition: number;
  ownerId: string;
  ownerName: string;
  referrerId: string;
  referrerName: string;
  referrerAvatarUrl: string | null;
  priority?: LeadPriority;
};

export function LeadCard({ lead, currentUserId, onOpen }: { lead: BoardLead; currentUserId: string; onOpen?: () => void }) {
  const mine = lead.ownerId === currentUserId;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg bg-card p-3 text-left transition-shadow hover:shadow-md border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium leading-tight">{lead.contactName}</span>
      </div>

      {lead.company && <p className="mt-0.5 text-xs text-muted-foreground">{lead.company}</p>}

      {lead.notes && (
        <p className="mt-1 text-xs leading-snug text-muted-foreground line-clamp-2">{lead.notes}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="text-[10px]">{LEAD_SOURCE_LABELS[lead.source]}</Badge>
        {lead.priority && lead.priority !== "LOW" && (
          <span
            style={{ backgroundColor: LEAD_PRIORITY_META[lead.priority].bg, color: LEAD_PRIORITY_META[lead.priority].text }}
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
          >
            {LEAD_PRIORITY_META[lead.priority].label}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-md bg-blue-50 px-2 py-1.5">
        <MemberAvatar userId={lead.referrerId} name={lead.referrerName} avatarUrl={lead.referrerAvatarUrl} className="h-6 w-6" />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-blue-700/70">Sent from</p>
          <p className="truncate text-xs font-medium text-blue-900">{lead.referrerName}</p>
        </div>
      </div>

      {lead.followUpDate && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          {formatDate(lead.followUpDate)}
        </div>
      )}

      {!mine && (
        <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-amber-600">Referred out</p>
      )}
    </button>
  );
}
