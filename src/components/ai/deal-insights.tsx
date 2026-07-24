"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Insights = { health: string; summary: string; risks: string[]; nextActions: string[] };

const HEALTH: Record<string, { label: string; cls: string }> = {
  strong: { label: "Strong", cls: "bg-emerald-100 text-emerald-800" },
  moderate: { label: "Moderate", cls: "bg-amber-100 text-amber-800" },
  at_risk: { label: "At risk", cls: "bg-rose-100 text-rose-800" },
};

export function DealInsights({ dealId }: { dealId: string }) {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Insights | null>(null);

  async function run() {
    setBusy(true);
    const res = await fetch(`/api/deals/${dealId}/insights`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(d.error ?? "Could not generate insights.");
      return;
    }
    setData(d);
  }

  const health = data ? HEALTH[data.health] ?? HEALTH.moderate : null;

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={run} disabled={busy}>
        <Sparkles className="h-4 w-4" /> {busy ? "Analysing…" : data ? "Refresh insights" : "Generate insights"}
      </Button>
      {data && (
        <div className="space-y-3 text-sm">
          {health && <span className={cn("inline-block rounded-md px-2 py-0.5 text-xs font-semibold", health.cls)}>{health.label}</span>}
          {data.summary && <p className="text-muted-foreground">{data.summary}</p>}
          {data.risks.length > 0 && (
            <div>
              <p className="font-medium">Risks</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {data.risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          {data.nextActions.length > 0 && (
            <div>
              <p className="font-medium">Next actions</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {data.nextActions.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
