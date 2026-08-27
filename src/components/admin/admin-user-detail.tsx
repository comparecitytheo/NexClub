"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, KeyRound, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { UserRole } from "@prisma/client";
import { ROLE_LABELS, ROLE_OPTIONS } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type Profile = {
  id: string; name: string; email: string; role: UserRole; isActive: boolean;
  businessName: string | null; industry: string | null; phone: string | null;
  services: string | null; bio: string | null;
  createdAt: string; pendingSetup: boolean;
  chapterId: string | null;
};
type Activity = {
  ownedLeads: number; referredLeads: number; ownedDeals: number; openTasks: number; createdTasks: number;
  recent: { id: string; action: string; entityType: string; entityId: string | null; createdAt: string }[];
};

export function AdminUserDetail({ userId }: { userId: string }) {
  const router = useRouter();
  // Editing a member's profile on their behalf. The fields are exactly the ones
  // the member can edit themselves, plus name — which they no longer can.
  type Draft = { name: string; industry: string; services: string; phone: string; bio: string; chapterId: string };
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState<Draft>({ name: "", industry: "", services: "", phone: "", bio: "", chapterId: "" });
  // Fetched when the editor opens, so the page does not pay for it otherwise.
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([]);
  const setField = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const [savingName, setSavingName] = useState(false);

  async function saveProfile() {
    const name = draft.name.trim();
    if (!name) return;
    setSavingName(true);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // Sends every field, so clearing one actually clears it. The server
      // ignores anything absent, and empty string means "clear".
      body: JSON.stringify({
        name,
        industry: draft.industry.trim(),
        services: draft.services.trim(),
        phone: draft.phone.trim(),
        bio: draft.bio.trim(),
        chapterId: draft.chapterId,
      }),
    });
    setSavingName(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not save this profile.");
      return;
    }
    setRenaming(false);
    toast.success("Profile updated.");
    router.refresh();
  }

  const [profile, setProfile] = useState<Profile | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [role, setRole] = useState<UserRole | "">("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null); // "role" | "deactivate" | "delete"
  const [resetUrl, setResetUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data.profile);
      setActivity(data.activity);
      setRole(data.profile.role);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function changeRole() {
    if (!profile || role === "" || role === profile.role) return;
    setBusy("role");
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, confirm: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Could not change role.");
      toast.success("Role updated.");
      setConfirm(null);
      load();
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(isActive: boolean) {
    setBusy("status");
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Could not update status.");
      toast.success(isActive ? "Member activated." : "Member deactivated.");
      setConfirm(null);
      load();
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword() {
    setBusy("reset");
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Could not send reset.");
      toast.success("Reset link sent.");
      setResetUrl(data.resetUrl ?? "");
    } finally {
      setBusy(null);
    }
  }

  async function del() {
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/users/${userId}?confirm=true`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Could not delete member.");
      toast.success("Member deleted.");
      router.push("/admin/users");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !profile)
    return (
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t load this member.{" "}
        <button onClick={load} className="font-medium text-primary hover:underline">Retry</button>
      </p>
    );

  return (
    <div className="space-y-4">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All members
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 rounded-xl bg-card p-5 lg:col-span-2 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              {/* Members rename themselves in profile settings; this covers the
                  cases they cannot — a typo at signup, or a legal name change. */}
              {renaming ? (
                <div className="w-full space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ap-name">Name</Label>
                    <Input
                      id="ap-name"
                      value={draft.name}
                      autoFocus
                      onChange={(e) => setField("name")(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Escape") setRenaming(false); }}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ap-industry">Industry</Label>
                      <Input id="ap-industry" value={draft.industry} onChange={(e) => setField("industry")(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ap-phone">Phone</Label>
                      <Input id="ap-phone" value={draft.phone} onChange={(e) => setField("phone")(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ap-chapter">Chapter</Label>
                    <select
                      id="ap-chapter"
                      value={draft.chapterId}
                      onChange={async (e) => {
                        if (e.target.value !== "__new__") {
                          setField("chapterId")(e.target.value);
                          return;
                        }
                        const name = prompt("New chapter name")?.trim();
                        if (!name) return;
                        const res = await fetch("/api/admin/chapters", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name }),
                        });
                        const d = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          toast.error(d.error ?? "Could not add that chapter.");
                          return;
                        }
                        // Add it to the list and select it, so the member can be
                        // saved straight away.
                        setChapters((cs) =>
                          [...cs, { id: d.chapter.id, name: d.chapter.name }].sort((a, b) =>
                            a.name.localeCompare(b.name)
                          )
                        );
                        setField("chapterId")(d.chapter.id);
                        toast.success(`${d.chapter.name} added.`);
                      }}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">No chapter</option>
                      {chapters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                      {/* Create without leaving the form. Only a Super Admin can
                          reach this page at all, and the POST is guarded server
                          side regardless — this is convenience, not the check. */}
                      <option value="__new__">+ Add a new chapter…</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ap-services">Services</Label>
                    <Textarea id="ap-services" rows={2} value={draft.services} onChange={(e) => setField("services")(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ap-bio">Bio</Label>
                    <Textarea id="ap-bio" rows={3} value={draft.bio} onChange={(e) => setField("bio")(e.target.value)} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The same fields the member edits in their own settings. The change is
                    recorded in the audit log against your account.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={saveProfile} disabled={savingName}>
                      {savingName ? "Saving…" : "Save profile"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{profile.name}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      // Seed every field so an untouched one saves unchanged
                      // rather than being blanked.
                      setDraft({
                        name: profile.name,
                        industry: profile.industry ?? "",
                        services: profile.services ?? "",
                        phone: profile.phone ?? "",
                        bio: profile.bio ?? "",
                        chapterId: profile.chapterId ?? "",
                      });
                      fetch("/api/admin/chapters")
                        .then((r) => (r.ok ? r.json() : { items: [] }))
                        .then((d) => setChapters(d.items ?? []))
                        .catch(() => setChapters([]));
                      setRenaming(true);
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Edit this member\u2019s profile"
                    title="Edit profile"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
            {profile.pendingSetup ? <Badge variant="secondary">Pending setup</Badge> : profile.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Role</dt><dd>{ROLE_LABELS[profile.role]}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Joined</dt><dd>{formatDate(profile.createdAt)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Business</dt><dd>{profile.businessName ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{profile.phone ?? "—"}</dd></div>
          </dl>
          {activity && (
            <div className="grid grid-cols-3 gap-3 border-t pt-3 text-center sm:grid-cols-5">
              <Stat label="Leads owned" value={activity.ownedLeads} />
              <Stat label="Referred" value={activity.referredLeads} />
              <Stat label="Deals" value={activity.ownedDeals} />
              <Stat label="Open tasks" value={activity.openTasks} />
              <Stat label="Tasks made" value={activity.createdTasks} />
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <h3 className="text-sm font-semibold">Manage</h3>

          <div className="space-y-2">
            {/* Support mode: see the CRM exactly as this member does. Read-only,
                and both entering and leaving are written to the audit log. */}
            {profile.role !== "SUPER_ADMIN" && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground">Support</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  onClick={async () => {
                    const res = await fetch("/api/admin/support", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId }),
                    });
                    const d = await res.json().catch(() => ({}));
                    if (!res.ok) return void toast.error(d.error ?? "Could not start support mode.");
                    toast.success(`Viewing the CRM as ${d.targetName}.`);
                    router.push("/leads");
                  }}
                >
                  View as this member
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">
                  See what they see, to diagnose access problems. Read-only.
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">Role</p>
            <div className="flex gap-2">
              <select className={`${selectClass} flex-1`} value={role} onChange={(e) => setRole(e.target.value as UserRole)} aria-label="Role">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              {confirm === "role" ? (
                <>
                  <Button size="sm" onClick={changeRole} disabled={busy === "role"}>Confirm</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
                </>
              ) : (
                <Button size="sm" variant="secondary" disabled={role === profile.role} onClick={() => setConfirm("role")}>Change</Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Status</p>
            {profile.isActive ? (
              confirm === "deactivate" ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => setStatus(false)} disabled={busy === "status"}>Confirm deactivate</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setConfirm("deactivate")}>Deactivate account</Button>
              )
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setStatus(true)} disabled={busy === "status"}>Activate account</Button>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Password</p>
            <Button size="sm" variant="secondary" onClick={resetPassword} disabled={busy === "reset"}>
              <KeyRound className="h-3.5 w-3.5" /> Send reset link
            </Button>
            {resetUrl && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-2 text-xs border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
                <span className="min-w-0 flex-1 truncate font-mono">{resetUrl}</span>
                <Button variant="ghost" size="sm" onClick={() => { void navigator.clipboard.writeText(resetUrl); toast.success("Copied."); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t pt-3">
            {confirm === "delete" ? (
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={del} disabled={busy === "delete"}>
                  <Trash2 className="h-3.5 w-3.5" /> Confirm delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => setConfirm("delete")}>
                <Trash2 className="h-3.5 w-3.5" /> Delete member
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">Deletion is a soft-delete — the account is disabled and hidden, not erased.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
