"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
 * Rename the businesses in the club.
 *
 * Super Admin only: a business name is how everyone else identifies that member,
 * so it is not something one member changes for the rest. The server renames the
 * business and updates every member's copy of the name in one transaction, so a
 * rename can never land half-applied.
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

  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-card p-10 text-center text-sm text-muted-foreground border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        No businesses yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Same toolbar shape as Members and Chapters. There is no "New business"
          button because a business has no create endpoint — one is created when
          a member is invited with a business name, so the button lives on the
          Members tab. Adding an empty business with nobody in it would be a
          record that cannot do anything. */}
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
      </div>

    <div className="overflow-hidden rounded-xl bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div className="flex items-center gap-3 border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="min-w-0 flex-1">Business</span>
        <span className="hidden w-40 shrink-0 sm:block">Industry</span>
          <span className="hidden w-32 shrink-0 sm:block">Chapter</span>
        <span className="w-24 shrink-0">Members</span>
        <span className="w-24 shrink-0" />
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

          <span className="flex w-24 shrink-0 justify-end gap-1">
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
              <Button size="sm" variant="ghost" onClick={() => startEdit(row)}>
                <Pencil className="h-3.5 w-3.5" /> Rename
              </Button>
            )}
          </span>
        </div>
      ))}
    </div>
    </div>
  );
}
