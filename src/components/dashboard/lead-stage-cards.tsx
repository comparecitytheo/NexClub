import { Inbox, Users } from "lucide-react";
import { StatCard } from "./stat-card";

// Shape produced by getLeadStageBreakdown(). Both scopes carry a total and a
// canonical-stage breakdown (label/value pairs ready for StatCard).
export type LeadStageData = {
  individual: { total: number; stages: { label: string; value: string; color: string }[] };
  club: { total: number; stages: { label: string; value: string; color: string }[] };
};

// Two cards shown side by side to EVERY role (no role prop, so the output cannot
// differ by permission). Card 1 = the viewer's own business; Card 2 = the whole
// club. They sit in an equal-width two-column grid (aligned tops, even gap) on
// sm+ and stack vertically on narrow screens. Both reuse StatCard's breakdown
// sub-list, so they match the other dashboard cards' typography and tokens.
export function LeadStageCards({ data }: { data: LeadStageData }) {
  return (
    <div className="grid items-start gap-4 sm:grid-cols-2">
      <StatCard
        title="Total leads"
        value={String(data.individual.total)}
        hint="Individual business"
        breakdown={data.individual.stages}
        icon={Inbox}
        className="bg-white border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]"
      />
      <StatCard
        title="Club-wide leads"
        value={String(data.club.total)}
        hint="All businesses combined"
        breakdown={data.club.stages}
        icon={Users}
        className="bg-white border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]"
      />
    </div>
  );
}
