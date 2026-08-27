"use client";
import { MessageSquare, CheckSquare } from "lucide-react";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { LEAD_PRIORITY_META } from "@/lib/labels";
import type { LeadStatus, LeadPriority } from "@prisma/client";

export type SentBoardLead = {
  id: string;
  contactName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  valueEstimate: number | null;
  notes: string | null;
  status: LeadStatus;
  priority?: LeadPriority | null;
  followUpDate: string | null;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  taskCount: number;
  commentCount: number;
};

export function SentLeadCard({ lead, onOpen }: { lead: SentBoardLead; onOpen?: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg bg-card p-3 text-left transition-shadow hover:shadow-md border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-tight">{lead.contactName}</p>
      </div>
      {lead.company && <p className="mt-0.5 text-xs text-muted-foreground">{lead.company}</p>}

      {lead.notes && (
        <p className="mt-1 text-xs leading-snug text-muted-foreground line-clamp-2">{lead.notes}</p>
      )}

      <div className="mt-3 flex items-center gap-2 rounded-md bg-violet-50 px-2 py-1.5">
        <MemberAvatar userId={lead.ownerId} name={lead.ownerName} avatarUrl={lead.ownerAvatarUrl} className="h-6 w-6" />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-violet-700/70">Sent to</p>
          <p className="truncate text-xs font-medium text-violet-900">{lead.ownerName}</p>
        </div>
      </div>

      {lead.priority && lead.priority !== "LOW" && (
        <div className="mt-2">
          <span
            style={{ backgroundColor: LEAD_PRIORITY_META[lead.priority].bg, color: LEAD_PRIORITY_META[lead.priority].text }}
            className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
          >
            {LEAD_PRIORITY_META[lead.priority].label}
          </span>
        </div>
      )}

      {(lead.taskCount > 0 || lead.commentCount > 0) && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          {lead.taskCount > 0 && (
            <span className="inline-flex items-center gap-1"><CheckSquare className="h-3 w-3" />{lead.taskCount}</span>
          )}
          {lead.commentCount > 0 && (
            <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{lead.commentCount}</span>
          )}
        </div>
      )}
    </button>
  );
}
