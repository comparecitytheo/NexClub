"use client";
import { BusinessLogo } from "@/components/shared/business-logo";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import type { UserRole } from "@prisma/client";
import { assignableTiers, canManageRole, isSuperAdmin, tierOf, TIER_LABELS, TIER_ROLE, type Tier } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/shared/member-avatar";

type Member = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  businessName: string | null;
  chapterName: string | null;
  businessLogoUserId?: string | null;
  industry: string | null;
  avatarUrl: string | null;
};

export function MembersTable({ members: initial, currentUserId, currentUserRole }: { members: Member[]; currentUserId: string; currentUserRole: UserRole }) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initial);
  const [pending, setPending] = useState<string | null>(null);
  const tiers = assignableTiers(currentUserRole);

  async function patch(id: string, data: Partial<Pick<Member, "role" | "isActive">>, optimistic: (m: Member) => Member) {
    const prev = members;
    setMembers((ms) => ms.map((m) => (m.id === id ? optimistic(m) : m)));
    setPending(id);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setPending(null);
    if (!res.ok) {
      setMembers(prev);
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Update failed.");
      return;
    }
    toast.success("Member updated.");
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this member? They will lose access to the club.")) return;
    const prev = members;
    setMembers((ms) => ms.filter((m) => m.id !== id));
    setPending(id);
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    setPending(null);
    if (!res.ok) {
      setMembers(prev);
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not remove member.");
      return;
    }
    toast.success("Member removed.");
    router.refresh();
  }

  return (
    <div className="overflow-x-auto rounded-lg bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Member</th>
            <th className="px-4 py-3 font-medium">Business</th>
            <th className="px-4 py-3 font-medium">Chapter</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const isSelf = m.id === currentUserId;
            const busy = pending === m.id;
            // Can the signed-in actor act on this member's tier? Admins cannot
            // manage Super Admins; this drives both the role control and the
            // activate/remove buttons.
            const manageable = canManageRole(currentUserRole, m.role);
            return (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <MemberAvatar userId={m.id} name={m.name} avatarUrl={m.avatarUrl} className="h-10 w-10" />
                    <div className="min-w-0">
                      <div className="font-medium">
                        {m.name}
                        {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {/* The business shown the same way it is everywhere else:
                      its logo, or initials in a tinted square. */}
                  {m.businessName ? (
                    <span className="flex items-center gap-2">
                      <BusinessLogo
                        name={m.businessName}
                        logoUserId={m.businessLogoUserId ?? null}
                        className="h-7 w-7"
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{m.businessName}</span>
                        {m.industry && (
                          <span className="block truncate text-xs">{m.industry}</span>
                        )}
                      </span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                  <td className="px-4 py-3">{m.chapterName ?? "\u2014"}</td>
                <td className="px-4 py-3">
                  {manageable ? (
                    <select
                      disabled={busy}
                      value={tierOf(m.role)}
                      onChange={(e) => {
                        const role = TIER_ROLE[e.target.value as Tier];
                        patch(m.id, { role }, (mm) => ({ ...mm, role }));
                      }}
                      className="rounded-md border border-input bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                    >
                      {tiers.map((t) => (
                        <option key={t} value={t}>
                          {TIER_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge variant="secondary">{TIER_LABELS[tierOf(m.role)]}</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {m.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {/* The full editor already exists under Admin; this is the
                        way in from the screen people actually browse. Super
                        Admin only — nobody else may edit another member. */}
                    {isSuperAdmin(currentUserRole) && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/users/${m.id}`} aria-label={`Edit ${m.name}`}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || isSelf || !manageable}
                      onClick={() => patch(m.id, { isActive: !m.isActive }, (mm) => ({ ...mm, isActive: !mm.isActive }))}
                    >
                      {m.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="destructive" size="sm" disabled={busy || isSelf || !manageable} onClick={() => remove(m.id)}>
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
