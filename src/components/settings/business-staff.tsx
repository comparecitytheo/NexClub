"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { InviteMemberDialog } from "@/components/admin/invite-member-dialog";

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
};

export type PendingStaff = {
  id: string;
  contactPerson: string;
  email: string;
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Director",
  MANAGER: "Manager",
  SALES_REP: "Staff",
  SUPPORT_AGENT: "Staff",
};

/**
 * Staff accounts for the signed-in admin's business.
 *
 * These are real logins, not the contact entries below — an invited person sets
 * a password and gets their own account. The server forces the invite to the
 * admin's OWN business and to the standard member role, so an admin cannot add
 * someone to another business or promote them.
 *
 * Anyone added here inherits this business name, which is what groups them onto
 * the same card in the member directory.
 */
export function BusinessStaff({
  businessName,
  staff,
  pending,
}: {
  businessName: string;
  staff: StaffMember[];
  pending: PendingStaff[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!businessName.trim()) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium">Staff accounts</div>
        <p className="text-xs text-muted-foreground">
          Add a business name above and save, then you can invite staff to it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Staff accounts</div>
          <p className="text-xs text-muted-foreground">
            People at {businessName} with their own login. They appear on your
            directory card under Staff.
          </p>
        </div>
        {!open && (
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add staff
          </Button>
        )}
      </div>

      {open && (
        <InviteMemberDialog
          lockedBusinessName={businessName}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}

      {staff.length === 0 && pending.length === 0 ? (
        <p className="text-xs text-muted-foreground">No staff accounts yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {staff.map((m) => (
            <div key={m.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
              <MemberAvatar
                userId={m.id}
                name={m.name}
                avatarUrl={m.avatarUrl}
                className="h-8 w-8 shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {ROLE_LABEL[m.role] ?? "Staff"}
              </span>
            </div>
          ))}
          {/* Invited but not yet signed up. Shown so an admin does not invite the
              same person twice while waiting for them to accept. */}
          {pending.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 border-b bg-muted/30 px-3 py-2 last:border-b-0"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Mail className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {p.contactPerson}
                <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Invited
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
