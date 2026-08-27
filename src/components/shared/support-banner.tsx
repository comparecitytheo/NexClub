"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

/**
 * Always-visible marker that a Super Admin is viewing as a member.
 *
 * Loud on purpose: the failure mode for support access is forgetting you are in
 * it and mistaking someone else's data for your own.
 */
export function SupportBanner({ viewingAs }: { viewingAs: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function leave() {
    setBusy(true);
    try {
      await fetch("/api/admin/support", { method: "DELETE" });
    } catch {
      // A dropped connection must not strand the operator. The button is the
      // only way out of support mode, so it always re-enables and always
      // refreshes: the server clears the cookie before it checks anything, so
      // a failed response does not mean the session survived.
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        Support mode — viewing the CRM as <strong>{viewingAs}</strong>. Read-only:
        changes are still recorded against your own account.
      </span>
      <button
        type="button"
        onClick={leave}
        disabled={busy}
        className="shrink-0 rounded-md bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-900 disabled:opacity-60"
      >
        {busy ? "Leaving…" : "Leave support mode"}
      </button>
    </div>
  );
}
