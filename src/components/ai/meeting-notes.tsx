"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { EntityType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Result = { summary: string; actionItems: string[]; followUps: string[]; tasksCreated?: number };

export function MeetingNotes({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [createTasks, setCreateTasks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    if (!notes.trim()) {
      toast.error("Paste your notes first.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/ai/meeting-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, notes, createTasks }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(d.error ?? "Could not process the notes.");
      return;
    }
    setResult(d);
    toast.success(d.tasksCreated ? `Saved — created ${d.tasksCreated} task(s).` : "Saved to activity.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste raw meeting notes…" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={createTasks} onChange={(e) => setCreateTasks(e.target.checked)} />
          Create tasks from action items
        </label>
        <Button size="sm" onClick={run} disabled={busy}>
          <Sparkles className="h-4 w-4" /> {busy ? "Processing…" : "Summarise notes"}
        </Button>
      </div>
      {result && (
        <div className="space-y-3 rounded-lg bg-muted/30 p-3 text-sm border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          {result.summary && <p>{result.summary}</p>}
          {result.actionItems.length > 0 && (
            <div>
              <p className="font-medium">Action items</p>
              <ul className="mt-1 list-disc pl-5">{result.actionItems.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
          {result.followUps.length > 0 && (
            <div>
              <p className="font-medium">Follow-ups</p>
              <ul className="mt-1 list-disc pl-5">{result.followUps.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
