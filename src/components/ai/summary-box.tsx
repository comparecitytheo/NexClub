"use client";
import { useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { EntityType } from "@prisma/client";
import { Button } from "@/components/ui/button";

export function SummaryBox({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");

  async function run() {
    setBusy(true);
    const res = await fetch("/api/ai/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not generate a summary.");
      return;
    }
    setSummary(data.summary ?? "");
  }

  async function copy() {
    await navigator.clipboard.writeText(summary);
    toast.success("Copied.");
  }

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={run} disabled={busy}>
        <Sparkles className="h-4 w-4" /> {busy ? "Summarising…" : summary ? "Regenerate" : "Summarise"}
      </Button>
      {summary && (
        <div className="rounded-lg bg-muted/30 p-3 text-sm border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <p className="whitespace-pre-wrap">{summary}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={copy}>
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
        </div>
      )}
    </div>
  );
}
