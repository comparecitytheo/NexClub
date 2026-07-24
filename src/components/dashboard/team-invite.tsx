"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InviteMemberDialog } from "@/components/admin/invite-member-dialog";

// Business-admin dashboard invite. Reuses the exact super-admin invite dialog with
// the business fixed to the admin's own; the server scopes the invite to that
// business and forces the standard member role. Rendered only when the signed-in
// admin actually has a business (see AdminDashboard).
export function TeamInvite({ businessName }: { businessName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Your team</h3>
          <p className="text-sm text-muted-foreground">Invite members to {businessName}.</p>
        </div>
        {!open ? (
          <Button size="sm" onClick={() => setOpen(true)}>Invite a member</Button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-4">
          <InviteMemberDialog
            lockedBusinessName={businessName}
            onClose={() => setOpen(false)}
            onCreated={() => router.refresh()}
          />
        </div>
      ) : null}
    </section>
  );
}
