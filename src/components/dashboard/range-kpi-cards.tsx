import { Inbox, Users, CalendarRange } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { ScopeKpi } from "@/server/metrics";
import { StatCard } from "./stat-card";

// Revenue + lead-conversion, each split into the viewer's own business and the
// whole club — the same two-scope pairing the lead cards above use, and the same
// visual language: Inbox + "Individual business" for the individual scope, Users
// + "All businesses combined" for the club. Order is metric-major so each row is
// one metric read across both scopes (Your vs Club revenue, then conversion),
// which is the comparison the cards exist to make. Unlike the lead cards, these
// numbers are scoped to the dashboard's date range; the caption names the active
// window so it's clear which control drives them.
export function RangeKpiCards({
  data,
  rangeLabel,
}: {
  data: { individual: ScopeKpi; club: ScopeKpi };
  rangeLabel: string;
}) {
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarRange className="h-4 w-4 shrink-0" />
        <span>
          Revenue and conversion for <span className="font-medium text-foreground">{rangeLabel}</span>
        </span>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <StatCard
          title="Your revenue"
          value={formatCurrency(data.individual.revenue)}
          hint="Individual business"
          icon={Inbox}
          tone="emerald"
          className="bg-white border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]"
        />
        <StatCard
          title="Club revenue"
          value={formatCurrency(data.club.revenue)}
          hint="All businesses combined"
          icon={Users}
          tone="emerald"
          className="bg-white border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]"
        />
        <StatCard
          title="Your conversion"
          value={pct(data.individual.conversion)}
          hint={`${data.individual.won} won of ${data.individual.received} received`}
          icon={Inbox}
          className="bg-white border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]"
        />
        <StatCard
          title="Club conversion"
          value={pct(data.club.conversion)}
          hint={`${data.club.won} won of ${data.club.received} received`}
          icon={Users}
          className="bg-white border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]"
        />
      </div>
    </div>
  );
}
