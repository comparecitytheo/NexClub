"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { strongPassword } from "@/server/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Single source of truth for the create/reset password form UI + validation, so
// the accept-invitation and reset-password screens are identical by construction.
// Uses the shared password policy plus a client-only confirm-match check. Each
// caller supplies only the submit behaviour and the CTA label.
const setPasswordSchema = z
  .object({
    password: strongPassword,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
type SetPasswordValues = z.infer<typeof setPasswordSchema>;

export function SetPasswordForm({
  onSubmit,
  submitIdleLabel,
  submitPendingLabel,
}: {
  onSubmit: (password: string) => Promise<void> | void;
  submitIdleLabel: string;
  submitPendingLabel: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function handle(values: SetPasswordValues) {
    setSubmitting(true);
    try {
      await onSubmit(values.password);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handle)} className="space-y-4">
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Create password</FormLabel>
            <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
            <FormDescription>At least 8 characters, with upper, lower, and a number.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="confirmPassword" render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm password</FormLabel>
            <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? submitPendingLabel : submitIdleLabel}
        </Button>
      </form>
    </Form>
  );
}
