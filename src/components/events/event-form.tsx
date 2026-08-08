"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type EventFormValues = {
  id: string;
  title: string;
  description: string;
  location: string;
  /** ISO strings; converted to the datetime-local format the inputs need. */
  startsAt: string;
  endsAt: string;
};

/** ISO -> "YYYY-MM-DDTHH:mm" in the browser's zone, which datetime-local wants. */
function toLocalInput(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Super Admin only. One form for both jobs: with `initial` it edits that event,
// without it creates a new one. Sharing the form means the two can never drift
// apart in validation or layout.
export function EventForm({ initial }: { initial?: EventFormValues }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    location: initial?.location ?? "",
    startsAt: toLocalInput(initial?.startsAt ?? ""),
    endsAt: toLocalInput(initial?.endsAt ?? ""),
  });

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setBusy(true);
    const res = await fetch(editing ? `/api/events/${initial!.id}` : "/api/events", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        // datetime-local has no timezone; interpret it in the browser's zone.
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : "",
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? `Could not ${editing ? "save" : "create"} the event.`);
      return;
    }
    // Editing does not re-notify the club — members were told when it was
    // published, and a corrected typo should not email everyone again.
    toast.success(editing ? "Event updated." : "Event created. The club has been notified.");
    router.push("/events");
    router.refresh();
  }

  const ready = form.title.trim().length >= 3 && form.startsAt !== "";

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <div>
          <Label htmlFor="ev-title">Event title</Label>
          <Input
            id="ev-title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Members' networking breakfast"
            className="mt-1.5"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ev-start">Starts</Label>
            <Input
              id="ev-start"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="ev-end">Ends (optional)</Label>
            <Input
              id="ev-end"
              type="datetime-local"
              value={form.endsAt}
              min={form.startsAt || undefined}
              onChange={(e) => set("endsAt", e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="ev-location">Location</Label>
          <Input
            id="ev-location"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="e.g. The Establishment, Sydney CBD"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="ev-desc">Description</Label>
          <Textarea
            id="ev-desc"
            rows={4}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What is it, who should come, anything they need to bring."
            className="mt-1.5"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {editing
            ? "Members already know about this event, so saving changes does not notify them again."
            : "Publishing notifies every member of the club, in the app and by email."}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/events")}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy || !ready}>
          {busy ? (editing ? "Saving…" : "Publishing…") : editing ? "Save changes" : "Publish event"}
        </Button>
      </div>
    </div>
  );
}
