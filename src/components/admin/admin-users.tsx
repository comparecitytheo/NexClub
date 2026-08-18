"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserPlus, Search } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { ROLE_LABELS, ROLE_OPTIONS } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { InviteMemberDialog } from "@/components/admin/invite-member-dialog";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type Row = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  businessName: string | null;
  chapterName: string | null;
  createdAt: string;
  pendingSetup: boolean;
};

export function AdminUsers() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Row[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    try {
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [q, role, status, page]);

  // Joins the CRM-wide refresh; this list fetches its own data.
  useRefreshListener(load);

  // Debounce filter/page changes into one request.
  const first = useRef(true);
  useEffect(() => {
    const t = setTimeout(load, first.current ? 0 : 250);
    first.current = false;
    return () => clearTimeout(t);
  }, [load]);

  // Any filter change resets to page 1 (the page control sets page directly).
  const filter =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => filter(setQ)(e.target.value)} placeholder="Search name or email" className="h-9 w-full pl-8" />
        </div>
        <select className={selectClass} value={role} onChange={(e) => filter(setRole)(e.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <select className={selectClass} value={status} onChange={(e) => filter(setStatus)(e.target.value)} aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <Button className="ml-auto" onClick={() => setShowCreate((s) => !s)}>
          <UserPlus className="h-4 w-4" /> Invite member
        </Button>
      </div>

      {showCreate && <InviteMemberDialog onClose={() => setShowCreate(false)} onCreated={load} />}

      <div className="overflow-hidden rounded-xl bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <div className="hidden items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:flex">
          <span className="flex-1">Member</span>
          <span className="w-32 shrink-0">Role</span>
          <span className="w-24 shrink-0">Status</span>
          <span className="w-24 shrink-0 text-right">Joined</span>
        </div>
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Couldn&apos;t load members.{" "}
            <button onClick={load} className="font-medium text-primary hover:underline">Retry</button>
          </p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No members match these filters.</p>
        ) : (
          <ul>
            {rows.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-primary">{u.name}</Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email}{u.businessName ? ` · ${u.businessName}` : ""}{u.chapterName ? ` · ${u.chapterName}` : ""}
                  </p>
                </div>
                <span className="w-32 shrink-0 text-sm">{ROLE_LABELS[u.role]}</span>
                <span className="w-24 shrink-0">
                  {u.pendingSetup ? (
                    <Badge variant="secondary">Pending</Badge>
                  ) : u.isActive ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-500" />Active</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" />Inactive</span>
                  )}
                </span>
                <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{formatDate(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} member{total === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
          <span className="text-xs">Page {page} of {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
