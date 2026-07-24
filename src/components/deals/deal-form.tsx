"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { DealStage } from "@prisma/client";
import { DEAL_STAGE_LABELS, DEAL_STAGE_ORDER } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = { id: string; name: string };

type Values = {
  name: string;
  companyId?: string;
  contactId?: string;
  value?: string;
  stage: DealStage;
  probability?: string;
  expectedCloseDate?: string;
};

type Props = { companies: Option[]; contacts: Option[]; initial?: Partial<Values>; id?: string };

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function DealForm({ companies, contacts, initial, id }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ defaultValues: { stage: DealStage.PROSPECTING, ...initial } });

  async function onSubmit(values: Values) {
    setLoading(true);
    const res = await fetch(id ? `/api/deals/${id}` : "/api/deals", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not save the deal.");
      return;
    }
    toast.success(id ? "Deal updated." : "Deal created.");
    router.push("/deals");
    router.refresh();
  }

  async function onDelete() {
    if (!id || !confirm("Delete this deal?")) return;
    setDeleting(true);
    const res = await fetch(`/api/deals/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Could not delete the deal.");
      return;
    }
    toast.success("Deal deleted.");
    router.push("/deals");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Deal name</Label>
        <Input id="name" {...register("name", { required: "Required" })} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companyId">Company</Label>
          <select id="companyId" className={selectClass} {...register("companyId")}>
            <option value="">— None —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactId">Contact</Label>
          <select id="contactId" className={selectClass} {...register("contactId")}>
            <option value="">— None —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="value">Value (AUD)</Label>
          <Input id="value" type="number" min={0} step="500" {...register("value")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="probability">Probability (%)</Label>
          <Input id="probability" type="number" min={0} max={100} {...register("probability")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stage">Stage</Label>
          <select id="stage" className={selectClass} {...register("stage")}>
            {DEAL_STAGE_ORDER.map((s) => (
              <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="expectedCloseDate">Expected close</Label>
          <Input id="expectedCloseDate" type="date" {...register("expectedCloseDate")} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          {id && (
            <Button type="button" variant="destructive" onClick={onDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/deals")}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : id ? "Save changes" : "Create deal"}
          </Button>
        </div>
      </div>
    </form>
  );
}
