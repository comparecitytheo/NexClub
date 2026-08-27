"use client";
import { DateTimeField } from "@/components/shared/date-time-field";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LeadStatus, LeadSource } from "@prisma/client";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Member = { id: string; name: string };

export type LeadActionData = {
  id: string;
  contactName: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  valueEstimate: number | null;
  source: LeadSource;
  status: LeadStatus;
  followUpDate: string | null;
  notes: string | null;
  converted: boolean;
  ownerId: string;
};

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function LeadActions({
  lead,
  members,
  canEdit,
  canReassign,
  canDelete,
}: {
  lead: LeadActionData;
  members: Member[];
  canEdit: boolean;
  canReassign: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reassignTo, setReassignTo] = useState(lead.ownerId);

  // Local copy of editable fields.
  const [form, setForm] = useState({
    contactName: lead.contactName,
    company: lead.company ?? "",
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    industry: lead.industry ?? "",
    valueEstimate: lead.valueEstimate != null ? String(lead.valueEstimate) : "",
    source: lead.source,
    followUpDate: lead.followUpDate ? lead.followUpDate.slice(0, 10) : "",
    notes: lead.notes ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function changeStatus(status: LeadStatus) {
    if (status === lead.status) return;
    setBusy(true);
    const res = await fetch(`/api/leads/${lead.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, boardPosition: 0 }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not update status.");
      return;
    }
    toast.success("Status updated.");
    router.refresh();
  }

  async function saveDetails() {
    setBusy(true);
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not save changes.");
      return;
    }
    toast.success("Lead updated.");
    setEditing(false);
    router.refresh();
  }

  async function reassign() {
    if (reassignTo === lead.ownerId) return;
    setBusy(true);
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: reassignTo }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not reassign.");
      return;
    }
    toast.success("Lead reassigned.");
    router.refresh();
  }

  async function convert() {
    if (!confirm("Convert this lead into a contact, company, and deal?")) return;
    setBusy(true);
    const res = await fetch(`/api/leads/${lead.id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(d.error ?? "Could not convert the lead.");
      return;
    }
    toast.success("Lead converted to a deal.");
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this lead?")) return;
    setBusy(true);
    const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not delete the lead.");
      return;
    }
    toast.success("Lead deleted.");
    router.push("/leads");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          className={selectClass}
          value={lead.status}
          disabled={!canEdit || busy}
          onChange={(e) => changeStatus(e.target.value as LeadStatus)}
        >
          {LEAD_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {!canEdit && <p className="text-xs text-muted-foreground">Only the recipient can change the status.</p>}
      </div>

      {canEdit && (
        <div className="rounded-lg p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Details</h3>
            {!editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </div>

          {editing ? (
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="contactName">Contact name</Label>
                <Input id="contactName" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" value={form.company} onChange={(e) => set("company", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="industry">Industry</Label>
                  <Input id="industry" value={form.industry} onChange={(e) => set("industry", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="valueEstimate">Lead value (AUD)</Label>
                  <Input
                    id="valueEstimate"
                    type="number"
                    min={0}
                    step="500"
                    value={form.valueEstimate}
                    onChange={(e) => set("valueEstimate", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Counts towards revenue once this lead is Closed / Won.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="source">Source</Label>
                  <select id="source" className={selectClass} value={form.source} onChange={(e) => set("source", e.target.value as LeadSource)}>
                    {Object.values(LeadSource).map((s) => (
                      <option key={s} value={s}>
                        {LEAD_SOURCE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="followUpDate">Follow-up date</Label>
                  <DateTimeField id="followUpDate" value={form.followUpDate} onChange={(v) => set("followUpDate", v)} placeholder="Pick a follow-up date" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveDetails} disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Edit the contact, value, score, source, follow-up, and notes.</p>
          )}
        </div>
      )}

      {canReassign && (
        <div className="space-y-2">
          <Label htmlFor="reassign">Reassign to</Label>
          <div className="flex gap-2">
            <select id="reassign" className={selectClass} value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={reassign} disabled={busy || reassignTo === lead.ownerId}>
              Reassign
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        {canEdit && !lead.converted && (
          <Button onClick={convert} disabled={busy}>
            Convert to deal
          </Button>
        )}
        {lead.converted && <span className="text-sm font-medium text-emerald-600">Converted to a deal</span>}
        {canDelete && (
          <Button variant="destructive" className="ml-auto" onClick={remove} disabled={busy}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
