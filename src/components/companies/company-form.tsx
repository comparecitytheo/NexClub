"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Values = {
  name: string;
  industry?: string;
  website?: string;
  employeeCount?: string;
  revenue?: string;
  address?: string;
  notes?: string;
};

type Props = { initial?: Partial<Values>; id?: string };

export function CompanyForm({ initial, id }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ defaultValues: { ...initial } });

  async function onSubmit(values: Values) {
    setLoading(true);
    const res = await fetch(id ? `/api/companies/${id}` : "/api/companies", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not save the company.");
      return;
    }
    toast.success(id ? "Company updated." : "Company created.");
    router.push("/companies");
    router.refresh();
  }

  async function onDelete() {
    if (!id || !confirm("Delete this company?")) return;
    setDeleting(true);
    const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Could not delete the company.");
      return;
    }
    toast.success("Company deleted.");
    router.push("/companies");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Company name</Label>
          <Input id="name" {...register("name", { required: "Required" })} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Input id="industry" {...register("industry")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input id="website" {...register("website")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employeeCount">Employees</Label>
          <Input id="employeeCount" type="number" min={0} {...register("employeeCount")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="revenue">Annual revenue (AUD)</Label>
          <Input id="revenue" type="number" min={0} step="1000" {...register("revenue")} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" {...register("address")} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={4} {...register("notes")} />
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
          <Button type="button" variant="outline" onClick={() => router.push("/companies")}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : id ? "Save changes" : "Create company"}
          </Button>
        </div>
      </div>
    </form>
  );
}
