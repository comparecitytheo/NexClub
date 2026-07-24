import { getAdminMetrics } from "@/server/metrics";
import { BarCard } from "./bar-card";
import { TrendCard } from "./trend-card";
import { TeamActivity } from "./team-activity";

export async function AdminDashboard({ organizationId }: { organizationId: string }) {
  const m = await getAdminMetrics(organizationId);

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <BarCard title="Leads by status" data={m.leadStatusData} format="number" />
      </div>

      <TrendCard title="Activity — last 14 days" data={m.activityTrend} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <TeamActivity organizationId={organizationId} isAdmin />
        <section className="rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <h3 className="mb-4 text-sm font-semibold">Member leaderboard</h3>
          {m.leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Member</th>
                    <th className="py-2 pr-4 font-medium">Sent leads (this month)</th>
                    <th className="py-2 pr-4 font-medium">Leads received</th>
                    <th className="py-2 font-medium">Closed / won</th>
                  </tr>
                </thead>
                <tbody>
                  {m.leaderboard.map((row, i) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">
                        <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                        {row.name}
                      </td>
                      <td className="py-2 pr-4 font-semibold text-primary">{row.sentThisMonth}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.received}</td>
                      <td className="py-2 text-muted-foreground">{row.wonCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
