"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SetPasswordForm } from "@/components/auth/set-password-form";

type Invite = { businessName: string; contactPerson: string; email: string; industry: string };
type LookupState =
  | { kind: "loading" }
  | { kind: "invalid"; reason: "invalid" | "expired" | "accepted" }
  | { kind: "ready"; invitation: Invite };

export function AcceptInvitationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<LookupState>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", reason: "invalid" });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data?.valid) setState({ kind: "ready", invitation: data.invitation });
        else setState({ kind: "invalid", reason: data?.reason ?? "invalid" });
      } catch {
        setState({ kind: "invalid", reason: "invalid" });
      }
    })();
  }, [token]);

  if (state.kind === "loading") {
    return <p className="text-sm text-muted-foreground">Checking your invitation…</p>;
  }

  if (state.kind === "invalid") {
    const msg =
      state.reason === "expired"
        ? "This invitation has expired. Ask an admin to resend it."
        : state.reason === "accepted"
          ? "This invitation has already been used. Try signing in instead."
          : "This invitation link is invalid.";
    return <p className="text-sm text-muted-foreground">{msg}</p>;
  }

  const inv = state.invitation;
  return (
    <div className="space-y-4">
      {/* Pre-filled, read-only invite details (invitation-specific). */}
      <div className="rounded-lg bg-muted/20 p-3 text-sm border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <DetailRow label="Business" value={inv.businessName} />
        <DetailRow label="Contact" value={inv.contactPerson} />
        <DetailRow label="Email" value={inv.email} />
        <DetailRow label="Industry" value={inv.industry} />
      </div>
      <SetPasswordForm
        submitIdleLabel="Activate account"
        submitPendingLabel="Setting up…"
        onSubmit={async (password) => {
          const res = await fetch("/api/invitations/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            toast.error(data.error ?? "Could not complete setup.");
            return;
          }
          toast.success("Your account is ready. Please sign in.");
          router.push("/login");
        }}
      />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
