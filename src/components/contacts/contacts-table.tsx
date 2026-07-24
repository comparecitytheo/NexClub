"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ContactStatus } from "@prisma/client";
import { CONTACT_STATUS_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  status: ContactStatus;
  company: { id: string; name: string } | null;
};

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const statusVariant: Record<ContactStatus, "success" | "muted" | "secondary" | "default"> = {
  ACTIVE: "success",
  INACTIVE: "muted",
  LEAD: "secondary",
  CUSTOMER: "default",
};

export function ContactsTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (status !== "ALL" && r.status !== status) return false;
        if (q) {
          const hay = `${r.firstName} ${r.lastName} ${r.email ?? ""} ${r.company?.name ?? ""}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [rows, q, status]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts…" className="max-w-xs" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="ALL">All statuses</option>
          {Object.values(ContactStatus).map((s) => (
            <option key={s} value={s}>
              {CONTACT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-muted-foreground">{filtered.length} of {rows.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg bg-card p-10 text-center text-sm text-muted-foreground border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          No contacts yet. Add your first contact to start building your book.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/contacts/${r.id}`} className="font-medium text-foreground hover:text-primary">
                      {r.firstName} {r.lastName}
                    </Link>
                    {r.jobTitle && <div className="text-xs text-muted-foreground">{r.jobTitle}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.company?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[r.status]}>{CONTACT_STATUS_LABELS[r.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
