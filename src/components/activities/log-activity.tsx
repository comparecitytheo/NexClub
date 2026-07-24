"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActivityType, EntityType } from "@prisma/client";
import { ACTIVITY_TYPE_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function LogActivity({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const router = useRouter();
  const [type, setType] = useState<ActivityType>("NOTE");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!subject.trim()) {
      toast.error("Add a short summary.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, subject, body, entityType, entityId }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not log activity.");
      return;
    }
    toast.success("Activity logged.");
    setSubject("");
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select className={selectClass + " max-w-[8rem]"} value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
          {Object.values(ActivityType).map((t) => (
            <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What happened?" />
      </div>
      <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details (optional)" />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? "Logging…" : "Log activity"}
        </Button>
      </div>
    </div>
  );
}
