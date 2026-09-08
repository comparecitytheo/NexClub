"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BusinessLogo } from "@/components/shared/business-logo";

export type BusinessRow = {
  id: string;
  name: string;
  industry: string | null;
  memberCount: number;
  logoUserId: string | null;
  /** Address parts, all optional — many members are sole traders. */
  addressLine1: string | null;
  addressLine2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  chapterId: string | null;
  chapterName: string | null;
};

/**
 * Create, edit and delete the businesses in the club.
 *
 * Super Admin only: a business name is how everyone else identifies that member,
 * so it is not something one member changes for the rest. The server renames the
 * business and updates every member's copy of the name in one transaction, so a
 * rename can never land half-applied.
 *
 * Deleting detaches the members rather than removing them — they stay in the
 * club with no business — which is why the confirmation says so explicitly.
 */
export function BusinessManager({ initial }: { initial: BusinessRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Address is edited alongside the name in the same inline row.
  type Addr = { addressLine1: string; addressLine2: string; suburb: string; state: string; postcode: string };
  const EMPTY_ADDR: Addr = { addressLine1: "", addressLine2: "", suburb: "", state: "", postcode: "" };
  const [addr, setAddr] = useState<Addr>(EMPTY_ADDR);
  const [chapterId, setChapterId] = useState("");
  // Loaded when an editor opens, so the page does not pay for it otherwise.
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([]);
  const setAddrField = (k: keyof Addr) => (v: string) => setAddr((a) => ({ ...a, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(t) || (r.industry ?? "").toLowerCase().includes(t)
    );
  }, [q, rows]);

  function startEdit(row: BusinessRow) {
    setEditing(row.id);
    setDraft(row.name);
    // Seed from the row so an untouched field saves unchanged rather than blank.
    setChapterId(row.chapterId ?? "");
    if (chapters.length === 0) {
      fetch("/api/admin/chapters")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setChapters(d.items ?? []))
        .catch(() => setChapters([]));
    }
    setAddr({
      addressLine1: row.addressLine1 ?? "",
      addressLine2: row.addressLine2 ?? "",
      suburb: row.suburb ?? "",
      state: row.state ?? "",
      postcode: row.postcode ?? "",
    });
  }

  async function save(row: BusinessRow) {
    const name = draft.trim();
    if (!name) {
      setEditing(null);
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/businesses/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, chapterId, ...addr }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not rename the business.");
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, name } : r)));
    setEditing(null);
    toast.success(`Renamed to ${name}.`);
    router.refresh();
  }

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const res = await fetch("/api/admin/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not add that business.");
      return;
    }
    setRows((rs) =>
      [
        ...rs,
        {
          id: data.id,
          name: data.name,
          industry: data.industry ?? null,
          memberCount: 0,
          logoUserId: null,
          addressLine1: null,
          addressLine2: null,
          suburb: null,
          state: null,
          postcode: null,
          chapterId: null,
          chapterName: null,
        },
      ].sort((a, b) => a.name.localeCompare(b.name))
    );
    setNewName("");
    setShowCreate(false);
    toast.success(`${data.name} added.`);
    router.refresh();
  }

  async function remove(row: BusinessRow) {
    // Members are detached, not deleted, so the warning has to say so plainly —
    // "delete this business" reads like it takes the people with it.
    const warning =
      row.memberCount > 0
        ? `Delete ${row.name}?\n\nIts ${row.memberCount} member${row.memberCount === 1 ? "" : "s"} will stay in the club but will no longer belong to a business.`
        : `Delete ${row.name}?\n\nIt has no members.`;
    if (!confirm(warning)) return;

    setBusy(true);
    const res = await fetch(`/api/admin/businesses/${row.id}?confirm=true`, { method: "DELETE" });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not delete that business.");
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    toast.success(
      data.membersDetached > 0
        ? `${row.name} deleted. ${data.membersDetached} member${data.membersDetached === 1 ? "" : "s"} no longer belong to a business.`
        : `${row.name} deleted.`
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Same toolbar shape as Members and Chapters: full-width search, create
          button on the right, form in a panel below. A business used to be
          created only as a side effect of naming one on a member; it can now be
          set up in advance, typically to put it in a chapter before its first
          member arrives. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search businesses"
            className="h-9 w-full pl-8"
          />
        </div>
        <Button className="ml-auto" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" /> New business
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-lg bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">New business</h3>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <Label htmlFor="business-name">Business name</Label>
          <Input
            id="business-name"
            value={newName}
            autoFocus
            placeholder="e.g. Shire Plumbing"
            className="mt-1.5"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") setShowCreate(false);
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Members are added to it from the Members tab. Its chapter and address
            can be set here once it exists.
          </p>
          <div className="mt-3 flex justify-end">
            <Button disabled={busy || !newName.trim()} onClick={add}>
              Add business
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <p className="rounded-xl bg-card p-10 text-center text-sm text-muted-foreground border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          No businesses yet.
        </p>
      )}

    {rows.length > 0 && (
    <div className="overflow-hidden rounded-xl bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div className="flex items-center gap-3 border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="min-w-0 flex-1">Business</span>
        <span className="hidden w-40 shrink-0 sm:block">Industry</span>
          <span className="hidden w-32 shrink-0 sm:block">Chapter</span>
        <span className="w-24 shrink-0">Members</span>
        <span className="w-32 shrink-0" />
      </div>

      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <BusinessLogo name={row.name} logoUserId={row.logoUserId} className="h-8 w-8" />
            {editing === row.id ? (
                <>
              <Input
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void save(row);
                  }
                  if (e.key === "Escape") setEditing(null);
                }}
                className="max-w-xs"
                />
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Input placeholder="Street address" value={addr.addressLine1} onChange={(e) => setAddrField("addressLine1")(e.target.value)} />
                  <Input placeholder="Unit / level (optional)" value={addr.addressLine2} onChange={(e) => setAddrField("addressLine2")(e.target.value)} />
                  <Input placeholder="Suburb" value={addr.suburb} onChange={(e) => setAddrField("suburb")(e.target.value)} />
                  {/* Chapter is set here rather than as an always-visible
                      dropdown in the list: it is a detail of the business, and
                      an inline control invites accidental changes. */}
                  <select
                    value={chapterId}
                    onChange={(e) => setChapterId(e.target.value)}
                    aria-label="Chapter"
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">No chapter</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="State" value={addr.state} onChange={(e) => setAddrField("state")(e.target.value)} />
                    <Input placeholder="Postcode" value={addr.postcode} onChange={(e) => setAddrField("postcode")(e.target.value)} />
                  </div>
                </div>
                </>
            ) : (
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{row.name}</span>
                {/* Short form only — the full address lives in the edit view
                    rather than crowding the list. */}
                {row.suburb || row.state ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {[row.suburb, row.state].filter(Boolean).join(", ")}
                  </span>
                ) : null}
              </span>
            )}
          </span>

          <span className="hidden w-40 shrink-0 truncate text-sm text-muted-foreground sm:block">
            {row.industry ?? "—"}
          </span>
            <span className="hidden w-32 shrink-0 truncate text-sm text-muted-foreground sm:block">{row.chapterName ?? "—"}</span>
          <span className="w-24 shrink-0 text-sm text-muted-foreground">{row.memberCount}</span>

          <span className="flex w-32 shrink-0 justify-end gap-1">
            {editing === row.id ? (
              <>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => save(row)}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => startEdit(row)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <button
                  type="button"
                  aria-label={`Delete ${row.name}`}
                  title="Delete business"
                  disabled={busy}
                  onClick={() => remove(row)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-rose-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </span>
        </div>
      ))}
    </div>
    )}
    </div>
  );
}
