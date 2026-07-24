"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SetPasswordForm } from "@/components/auth/set-password-form";

// Presentation is shared with the accept-invitation screen via SetPasswordForm;
// only the reset-specific token handling, endpoint, and redirect live here.
export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  if (!token) {
    return <p className="text-sm text-muted-foreground">This reset link is missing its token. Request a new one.</p>;
  }

  return (
    <SetPasswordForm
      submitIdleLabel="Reset password"
      submitPendingLabel="Resetting…"
      onSubmit={async (password) => {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error ?? "Could not reset your password.");
          return;
        }
        toast.success("Password updated. Please sign in.");
        router.push("/login");
      }}
    />
  );
}
