"use client";
import { CalendarClock } from "lucide-react";
import { LeadStatus, LeadSource, LeadPriority } from "@prisma/client";
import { LEAD_PRIORITY_META } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { MemberAvatar } from "@/components/shared/member-avatar";

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
  ownerBusinessName: string | null;
  /** When the lead was created. Shown as secondary detail on card + list. */
  createdAt: string;
  ownerAvatarUrl: string | null;
  referrerId: string;
  referrerName: string;
  referrerAvatarUrl: string | null;
  referrerBusinessName: string | null;
  priority?: LeadPriority;
  // Deletion trail. Only populated on the Deleted view; undefined elsewhere.
  deletedOn?: string | null;
  deletedByName?: string | null;
  statusBeforeDelete?: LeadStatus | null;
  archivedAt?: string | null;
};

export function LeadCard({
  lead,
  // Kept in the signature: callers still pass it, and it will be needed again
  // if the card ever varies by viewer. Unused since the "Referred out" line
  // was removed.
  currentUserId: _currentUserId,
  onOpen,
  showBothParties,
}: {
  lead: BoardLead;
  currentUserId: string;
  onOpen?: () => void;
  /** On the All view a card can be either direction, so show sender AND receiver. */
  showBothParties?: boolean;
}) {

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
        <MemberAvatar userId={lead.referrerId} name={lead.referrerName} avatarUrl={lead.referrerAvatarUrl} className="h-10 w-10" />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-blue-700/70">Sent from</p>
          <p className="truncate text-xs font-medium text-blue-900">{lead.referrerName}</p>
          {lead.referrerBusinessName && (
            <p className="truncate text-[10px] text-blue-700/70">{lead.referrerBusinessName}</p>
          )}
        </div>
      </div>

      {/* All view mixes both directions, so the receiver is shown too — otherwise
          a card gives no clue whether the lead came to you or went out from you. */}
      {showBothParties && (
        <div className="mt-1.5 flex items-center gap-2 rounded-md bg-violet-50 px-2 py-1.5">
          <MemberAvatar userId={lead.ownerId} name={lead.ownerName} avatarUrl={lead.ownerAvatarUrl} className="h-10 w-10" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-violet-700/70">Sent to</p>
            <p className="truncate text-xs font-medium text-violet-900">{lead.ownerName}</p>
            {lead.ownerBusinessName && (
              <p className="truncate text-[10px] text-violet-700/70">{lead.ownerBusinessName}</p>
            )}
          </div>
        </div>
      )}

      {lead.followUpDate && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          {formatDate(lead.followUpDate)}
        </div>
      )}



      {/* Last element on the card, so it sits under everything else including
          the priority marker. Muted and smallest — the quietest thing here. */}
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Created {formatDateTime(lead.createdAt)}
      </p>
    </button>
  );
}
