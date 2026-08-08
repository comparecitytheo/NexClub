"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type IndustryRow = { id: string | null; name: string; memberCount: number };

// Industries drive every dropdown and the directory filter. Rows with a null id
// are industries members typed themselves that were never added to the list —
// they can be formalised with one click so they behave like the rest.
export function IndustryManager({ initial }: { initial: IndustryRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setBusy(true);
    const res = await fetch("/api/admin/industries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not add the industry.");
      return;
    }
    setName("");
    toast.success(`${trimmed} added.`);
    router.refresh();
  }

  async function remove(row: IndustryRow) {
    if (!row.id) return;
    const warning =
      row.memberCount > 0
        ? `${row.name} is used by ${row.memberCount} member${row.memberCount === 1 ? "" : "s"}. They keep it on their profile, but it will no longer be offered. Continue?`
        : `Remove ${row.name} from the list?`;
    if (!confirm(warning)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/industries?id=${encodeURIComponent(row.id)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not remove the industry.");
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    toast.success(`${row.name} removed.`);
    router.refresh();
  }

  const unlisted = rows.filter((r) => r.id === null);

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <Label htmlFor="new-industry">Add an industry</Label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            id="new-industry"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add(name);
              }
            }}
            placeholder="e.g. Plumbing"
            className="max-w-xs"
          />
          <Button onClick={() => add(name)} disabled={busy || !name.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Appears immediately in the signup form, profile settings and the member
          directory filter. Matching is case-insensitive, so duplicates can&apos;t creep in.
        </p>
      </div>

      {unlisted.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            {unlisted.length} industry{unlisted.length === 1 ? "" : " entries"} typed by members
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            These are in use but were never added to the list. Add them so they can be
            managed like the rest.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unlisted.map((r) => (
              <Button key={r.name} size="sm" variant="outline" disabled={busy} onClick={() => add(r.name)}>
                <Plus className="h-3.5 w-3.5" /> {r.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <div className="flex items-center gap-3 border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className="min-w-0 flex-1">Industry</span>
          <span className="w-28 shrink-0">Members</span>
          <span className="w-20 shrink-0" />
        </div>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No industries yet.</p>
        ) : (
          rows.map((r) => (
            <div key={r.name} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {r.name}
                {r.id === null && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    Not on the list
                  </span>
                )}
              </span>
              <span className="w-28 shrink-0 text-sm text-muted-foreground">
                {r.memberCount}
              </span>
              <span className="flex w-20 shrink-0 justify-end">
                {r.id && (
                  <button
                    type="button"
                    onClick={() => remove(r)}
                    disabled={busy}
                    aria-label={`Remove ${r.name}`}
                    title="Remove from the list"
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
