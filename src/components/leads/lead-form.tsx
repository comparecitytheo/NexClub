"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONSENT_STATEMENT, CONSENT_HINT } from "@/lib/consent";
import type { LeadPriority } from "@prisma/client";
import { LEAD_PRIORITY_META, LEAD_PRIORITY_ORDER } from "@/lib/labels";

type Member = { id: string; name: string };

type Values = {
  ownerId: string;
  contactName: string;
  phone?: string;
  email?: string;
  notes?: string;
};

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function LeadForm({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [priority, setPriority] = useState<LeadPriority>("LOW");
  const [consent, setConsent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ defaultValues: { ownerId: "" } });

  async function onSubmit(values: Values) {
    setLoading(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, priority, consentConfirmed: consent }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not send the lead.");
      return;
    }
    toast.success("Lead sent.");
    router.push("/leads/sent");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="contactName">Full Name</Label>
        <Input id="contactName" placeholder="Customer's full name" {...register("contactName", { required: "Required" })} />
        {errors.contactName && <p className="text-sm text-destructive">{errors.contactName.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Mobile Number</Label>
          <Input id="phone" type="tel" inputMode="tel" {...register("phone")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Note</Label>
        <Textarea id="notes" rows={4} placeholder="Any context that will help the recipient…" {...register("notes")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ownerId">Assign To</Label>
        <select id="ownerId" className={selectClass} {...register("ownerId", { required: "Choose a member" })}>
          <option value="" disabled>
            Choose a club member…
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.id === currentUserId ? " (me)" : ""}
            </option>
          ))}
        </select>
        {errors.ownerId && <p className="text-sm text-destructive">{errors.ownerId.message}</p>}
        <p className="text-xs text-muted-foreground">
          The lead is sent to this member&apos;s My Leads and they&apos;re notified by bell and email.
        </p>
      </div>

      {/* Priority selector — sits directly below Assign To */}
      <div className="space-y-2">
        <Label>Priority</Label>
        <div className="flex flex-wrap gap-2">
          {LEAD_PRIORITY_ORDER.map((value) => {
            const { label, bg, text } = LEAD_PRIORITY_META[value];
            const selected = priority === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPriority(value)}
                style={{ backgroundColor: bg, color: text }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-all",
                  selected
                    ? "font-bold ring-2 ring-offset-2 ring-black/40 scale-105 shadow-md"
                    : "font-medium opacity-75 hover:opacity-100"
                )}
                aria-pressed={selected}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Consent gate: a lead is a third party who never joined the club, so the
          sender confirms they may pass the details on. Recorded on the lead. */}
      <div className="rounded-lg bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <label htmlFor="consent" className="flex cursor-pointer items-start gap-3">
          <input
            id="consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            aria-describedby="consent-hint"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
          />
          <span className="text-sm">{CONSENT_STATEMENT}</span>
        </label>
        <p id="consent-hint" className="mt-2 pl-7 text-xs text-muted-foreground">
          {CONSENT_HINT}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/leads")}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !consent}>
          {loading ? "Sending…" : "Send lead"}
        </Button>
      </div>
    </form>
  );
}
