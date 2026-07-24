"use client";
import { useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { EntityType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const TONES: Array<[string, string]> = [
  ["professional", "Professional"],
  ["friendly", "Friendly"],
  ["concise", "Concise"],
  ["persuasive", "Persuasive"],
];

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function EmailWriter({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const [purpose, setPurpose] = useState("");
  const [tone, setTone] = useState("professional");
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  async function run() {
    if (!purpose.trim()) {
      toast.error("Say what the email is for.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/ai/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, purpose, tone }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(d.error ?? "Could not draft the email.");
      return;
    }
    setSubject(d.subject ?? "");
    setBody(d.body ?? "");
  }

  async function copy() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    toast.success("Copied.");
  }

  return (
    <div className="space-y-3">
      <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What's the email for? e.g. follow up after our call" />
      <div className="flex gap-2">
        <select className={selectClass} value={tone} onChange={(e) => setTone(e.target.value)}>
          {TONES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <Button size="sm" onClick={run} disabled={busy}>
          <Sparkles className="h-4 w-4" /> {busy ? "Drafting…" : "Draft email"}
        </Button>
      </div>
      {(subject || body) && (
        <div className="space-y-2 rounded-lg bg-muted/30 p-3 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          <Button variant="ghost" size="sm" onClick={copy}>
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
        </div>
      )}
    </div>
  );
}
