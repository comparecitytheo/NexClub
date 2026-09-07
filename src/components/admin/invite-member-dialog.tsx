"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createInvitationSchema, type CreateInvitationInput } from "@/server/validators/invitation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

// Sentinel value for the final "Add new industry" option in the dropdown.
const ADD_NEW = "__add_new_industry__";

// Invite form. One step — filling the fields and clicking "Confirm and Send"
// dispatches the invite immediately (no preview). Client + server share
// createInvitationSchema; the server is the source of truth and also decides the
// invited role + business scope from the signed-in caller.
//
// When `lockedBusinessName` is set (business-admin flow) the business is fixed to
// the admin's own and shown read-only. The server enforces that scope regardless
// of what's submitted.
export function InviteMemberDialog({
  onClose,
  onCreated,
  lockedBusinessName,
}: {
  onClose: () => void;
  onCreated: () => void;
  lockedBusinessName?: string;
}) {
  const [sending, setSending] = useState(false);
  const [industries, setIndustries] = useState<string[]>([]);
  const [industryMode, setIndustryMode] = useState<"pick" | "new">("pick");

  const form = useForm<CreateInvitationInput>({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: {
      businessName: lockedBusinessName ?? "",
      contactPerson: "",
      email: "",
      mobileNumber: "",
      industry: "",
    },
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/industries");
        const d = await r.json();
        if (Array.isArray(d?.industries)) setIndustries(d.industries);
      } catch {
        /* the dropdown still lets the admin add a new industry */
      }
    })();
  }, []);

  async function onSubmit(values: CreateInvitationInput) {
    setSending(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fe = data.fieldErrors as Record<string, string[]> | undefined;
        if (fe) {
          for (const [k, msgs] of Object.entries(fe)) {
            form.setError(k as keyof CreateInvitationInput, { message: msgs?.[0] ?? "Invalid value" });
          }
        }
        toast.error(data.error ?? "Could not send the invitation.");
        return;
      }
      // The invitation row is created either way; `sent` says whether the email
      // left. Saying "sent" when it did not is how an undelivered invitation
      // turned into a fortnight of blaming the invitee's spam folder.
      if (data.sent === false) {
        toast.error(
          `Invitation created, but the email to ${values.email} could not be sent. ` +
            `Use Resend to try again, or add the member directly.`,
          { duration: 10000 }
        );
      } else {
        toast.success(`Invitation sent to ${values.email}.`);
      }
      onCreated();
      onClose();
    } finally {
      setSending(false);
    }
  }

  const industryValue = form.watch("industry") ?? "";
  const heading = lockedBusinessName ? "Invite a team member" : "Invite a member";

  return (
    <div className="space-y-4 rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{heading}</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField control={form.control} name="businessName" render={({ field }) => (
              <FormItem>
                <FormLabel>Business name <span className="text-rose-500">*</span></FormLabel>
                <FormControl>
                  <Input {...field} readOnly={!!lockedBusinessName} className={lockedBusinessName ? "bg-muted/40" : undefined} />
                </FormControl>
                {lockedBusinessName ? (
                  <p className="text-xs text-muted-foreground">Members you invite join your business.</p>
                ) : null}
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="contactPerson" render={({ field }) => (
              <FormItem>
                <FormLabel>Contact person <span className="text-rose-500">*</span></FormLabel>
                <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email <span className="text-rose-500">*</span></FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="mobileNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone number <span className="text-rose-500">*</span></FormLabel>
                <FormControl><Input placeholder="0412 345 678 or +61412345678" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormItem className="sm:col-span-2">
              <FormLabel>Industry <span className="text-rose-500">*</span></FormLabel>
              <select
                className={selectClass}
                value={industryMode === "new" ? ADD_NEW : industryValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === ADD_NEW) {
                    setIndustryMode("new");
                    form.setValue("industry", "", { shouldValidate: false });
                    form.clearErrors("industry");
                  } else {
                    setIndustryMode("pick");
                    form.setValue("industry", v, { shouldValidate: true });
                  }
                }}
              >
                <option value="" disabled>Select an industry</option>
                {industries.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
                <option value={ADD_NEW}>+ Add new industry</option>
              </select>
              {industryMode === "new" ? (
                <Input
                  className="mt-2"
                  autoFocus
                  placeholder="New industry name"
                  value={industryValue}
                  onChange={(e) => form.setValue("industry", e.target.value, { shouldValidate: true })}
                />
              ) : null}
              {form.formState.errors.industry ? (
                <p className="text-sm font-medium text-destructive">{form.formState.errors.industry.message}</p>
              ) : null}
            </FormItem>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={sending}>{sending ? "Sending…" : "Confirm and Send"}</Button>
            <Button type="button" variant="ghost" onClick={onClose} disabled={sending}>Cancel</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
