"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
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
  const [busy, setBusy] = useState(false);

  function startEdit(row: BusinessRow) {
    setEditing(row.id);
    setDraft(row.name);
  }

  async function save(row: BusinessRow) {
    const name = draft.trim();
    if (!name || name === row.name) {
      setEditing(null);
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/businesses/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
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
    <div className="overflow-hidden rounded-xl bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div className="flex items-center gap-3 border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="min-w-0 flex-1">Business</span>
        <span className="hidden w-40 shrink-0 sm:block">Industry</span>
        <span className="w-24 shrink-0">Members</span>
        <span className="w-24 shrink-0" />
      </div>

      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <BusinessLogo name={row.name} logoUserId={row.logoUserId} className="h-8 w-8" />
            {editing === row.id ? (
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
            ) : (
              <span className="truncate text-sm font-medium">{row.name}</span>
            )}
          </span>

          <span className="hidden w-40 shrink-0 truncate text-sm text-muted-foreground sm:block">
            {row.industry ?? "—"}
          </span>
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
  );
}
