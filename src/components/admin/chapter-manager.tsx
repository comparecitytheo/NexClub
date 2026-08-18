"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ChapterRow = { id: string; name: string; businessCount: number };

// Add, rename and remove the club's chapters. Mirrors IndustryManager, except a
// chapter is a real record members are linked to — so renaming updates everyone
// automatically, and deleting is refused while anyone is still assigned.
export function ChapterManager({ initial }: { initial: ChapterRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => r.name.toLowerCase().includes(t)) : rows;
  }, [q, rows]);

  async function add() {
    const value = name.trim();
    if (!value) return;
    setBusy(true);
    const res = await fetch("/api/admin/chapters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not add that chapter.");
      return;
    }
    setRows((r) => [...r, { id: data.chapter.id, name: data.chapter.name, businessCount: 0 }]
      .sort((a, b) => a.name.localeCompare(b.name)));
    setName("");
    setShowCreate(false);
    toast.success(`${data.chapter.name} added.`);
    router.refresh();
  }

  async function rename(id: string) {
    const value = draft.trim();
    if (!value) return;
    setBusy(true);
    const res = await fetch(`/api/admin/chapters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not rename that chapter.");
      return;
    }
    setRows((r) =>
      r.map((c) => (c.id === id ? { ...c, name: value } : c)).sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditing(null);
    toast.success("Chapter renamed.");
    router.refresh();
  }

  async function remove(row: ChapterRow) {
    // The server refuses anyway; asking first avoids a pointless round trip and
    // explains why when members are still assigned.
    if (row.businessCount > 0) {
      toast.error(
        `${row.businessCount} member${row.businessCount === 1 ? " is" : "s are"} still in ${row.name}. Move them first.`
      );
      return;
    }
    if (!confirm(`Delete ${row.name}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/chapters/${row.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not delete that chapter.");
      return;
    }
    setRows((r) => r.filter((c) => c.id !== row.id));
    toast.success(`${row.name} deleted.`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Same shape as the Members screen: full-width search, create button on
          the right, form in a panel below. Kept identical so every admin tab
          behaves the same way. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chapters"
            className="h-9 w-full pl-8"
          />
        </div>
        <Button className="ml-auto" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" /> New chapter
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-lg bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">New chapter</h3>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <Label htmlFor="chapter-name">Chapter name</Label>
          <Input
            id="chapter-name"
            value={name}
            autoFocus
            placeholder="e.g. The Shire"
            className="mt-1.5"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") setShowCreate(false);
            }}
          />
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={add} disabled={busy || !name.trim()}>
              {busy ? "Adding…" : "Confirm and Add"}
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        {visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? "No chapters yet." : "No chapters match that search."}
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                {editing === row.id ? (
                  <>
                    <Input
                      value={draft}
                      autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") rename(row.id);
                        if (e.key === "Escape") setEditing(null);
                      }}
                    />
                    <Button size="sm" onClick={() => rename(row.id)} disabled={busy}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{row.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.businessCount} business{row.businessCount === 1 ? "" : "es"}
                    </span>
                    <button
                      type="button"
                      aria-label={`Rename ${row.name}`}
                      onClick={() => {
                        setEditing(row.id);
                        setDraft(row.name);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${row.name}`}
                      onClick={() => remove(row)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
