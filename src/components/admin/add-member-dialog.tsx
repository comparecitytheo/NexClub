"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserRole } from "@prisma/client";
import { createMemberSchema } from "@/server/validators/admin";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type CreateMemberInput = z.infer<typeof createMemberSchema>;

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** What a Super Admin may create here. SUPER_ADMIN is deliberately absent —
 *  promoting someone that far is a separate, confirmed action on the member. */
const ROLES: { value: UserRole; label: string }[] = [
  { value: "ADMIN" as UserRole, label: "Business admin" },
  { value: "SALES_REP" as UserRole, label: "Member" },
];

/**
 * Add a member directly, with no invitation and no email anywhere in the flow.
 *
 * The club asked for this because invitation emails stopped reaching people and
 * they could not create an account. The Super Admin sets the first password and
 * hands it over; the member changes it from Profile settings whenever they like.
 *
 * The invite route still exists beside this one — both options, as asked.
 */
export function AddMemberDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const form = useForm<CreateMemberInput>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "SALES_REP" as UserRole,
      isActive: true,
      businessName: "",
      password: "",
    },
  });

  async function onSubmit(values: CreateMemberInput) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not add the member.");
        return;
      }
      toast.success(
        `${values.name} can sign in now with the password you set. Pass it on to them.`,
        { duration: 8000 }
      );
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Add a member directly</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
          Close
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        No invitation is sent. The account works straight away with the password you set below —
        give it to the member, and they can change it from Profile settings.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full name <span className="text-rose-500">*</span></FormLabel>
                <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email <span className="text-rose-500">*</span></FormLabel>
                <FormControl><Input type="email" autoComplete="off" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="businessName" render={({ field }) => (
              <FormItem>
                <FormLabel>Business name</FormLabel>
                <FormControl>
                  <Input placeholder="Their business" {...field} value={field.value ?? ""} />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Joins the existing business of that name, or starts a new one.
                </p>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel>Role <span className="text-rose-500">*</span></FormLabel>
                <FormControl>
                  <select className={selectClass} value={field.value} onChange={field.onChange}>
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel>First password <span className="text-rose-500">*</span></FormLabel>
              <FormControl>
                <Input
                  type="text"
                  autoComplete="new-password"
                  placeholder="At least 8 characters, with a capital and a number"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              {/* Shown rather than masked on purpose: the Super Admin has to read
                  it out or copy it to the member, and cannot do that blind. */}
              <p className="text-xs text-muted-foreground">
                Visible so you can pass it on. The member can change it once they are in.
              </p>
              <FormMessage />
            </FormItem>
          )} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add member"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
