"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

type Row = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  contacts: number;
  deals: number;
};

export function CompaniesTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => rows.filter((r) => (q ? `${r.name} ${r.industry ?? ""}`.toLowerCase().includes(q.toLowerCase()) : true)),
    [rows, q]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies…" className="max-w-xs" />
        <span className="ml-auto text-sm text-muted-foreground">{filtered.length} of {rows.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg bg-card p-10 text-center text-sm text-muted-foreground border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          No companies yet. Add the businesses behind your contacts and deals.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Industry</th>
                <th className="px-4 py-3 font-medium">Contacts</th>
                <th className="px-4 py-3 font-medium">Deals</th>
                <th className="px-4 py-3 font-medium">Website</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/companies/${r.id}`} className="font-medium text-foreground hover:text-primary">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.industry ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.contacts}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.deals}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.website ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
