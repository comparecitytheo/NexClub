import { MemberAvatar } from "@/components/shared/member-avatar";
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuditAction } from "@prisma/client";
import { AUDIT_ACTION_LABELS, AUDIT_ACTION_BADGE, auditEntityHref } from "@/lib/notifications";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRefreshListener } from "@/lib/use-refresh-listener";

export type AuditRow = {
  id: string;
  createdAt: string;
  actorName: string | null;
  actorId?: string | null;
  actorAvatarUrl?: string | null;
  ipAddress: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
};

const ENTITY_TYPES = ["Lead", "Contact", "Company", "Deal", "Task", "User"];

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function AuditTable({
  initial,
  initialTotal,
  initialTotalPages,
}: {
  initial: AuditRow[];
  initialTotal: number;
  initialTotalPages: number;
}) {
  const [rows, setRows] = useState<AuditRow[]>(initial);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [total, setTotal] = useState(initialTotal);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const skip = useRef(true);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (action) qs.set("action", action);
      if (entityType) qs.set("entityType", entityType);
      if (q) qs.set("q", q);
      const res = await fetch(`/api/audit?${qs.toString()}`);
      const data = await res.json();
      setRows(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  // Join the CRM-wide refresh: this view fetches its own data, so
  // router.refresh() alone would leave it stale.
  useRefreshListener(load);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, action, entityType, q]);

  // Debounce the search box so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          placeholder="Search who or record…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full sm:max-w-[220px]"
        />
        <select
          className={selectClass}
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All actions</option>
          {Object.values(AuditAction).map((a) => (
            <option key={a} value={a}>{AUDIT_ACTION_LABELS[a]}</option>
          ))}
        </select>
        <select
          className={selectClass}
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All records</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-muted-foreground">
          {loading ? "Loading…" : `${total} event${total === 1 ? "" : "s"}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg bg-card p-10 text-center text-sm text-muted-foreground border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          No audit events match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-card border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Record</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const href = auditEntityHref(r.entityType, r.entityId);
                const hasDiff = r.before != null || r.after != null;
                const isOpen = expanded === r.id;
                return (
                  <FragmentRow
                    key={r.id}
                    row={r}
                    href={href}
                    hasDiff={hasDiff}
                    isOpen={isOpen}
                    onToggle={() => setExpanded(isOpen ? null : r.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  row,
  href,
  hasDiff,
  isOpen,
  onToggle,
}: {
  row: AuditRow;
  href: string | null;
  hasDiff: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b last:border-0">
        <td className="px-4 py-3 align-top">
          <div>{formatRelative(row.createdAt)}</div>
          <div className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</div>
        </td>
        <td className="px-4 py-3 align-top text-muted-foreground">
          {row.actorName ? (
            <span className="flex items-center gap-2">
              <MemberAvatar
                userId={row.actorId ?? ""}
                name={row.actorName}
                avatarUrl={row.actorAvatarUrl ?? null}
                className="h-6 w-6"
              />
              <span className="truncate">{row.actorName}</span>
            </span>
          ) : (
            "System"
          )}
        </td>
        <td className="px-4 py-3 align-top text-xs text-muted-foreground">{row.ipAddress ?? "—"}</td>
        <td className="px-4 py-3 align-top">
          <span className={cn("inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold", AUDIT_ACTION_BADGE[row.action])}>
            {AUDIT_ACTION_LABELS[row.action]}
          </span>
        </td>
        <td className="px-4 py-3 align-top">
          {href ? (
            <Link href={href} className="font-medium hover:text-primary">{row.entityType}</Link>
          ) : (
            <span className="font-medium">{row.entityType}</span>
          )}
          {row.entityId && <div className="text-xs text-muted-foreground">{row.entityId.slice(0, 10)}…</div>}
        </td>
        <td className="px-4 py-3 text-right align-top">
          {hasDiff && (
            <button onClick={onToggle} className="text-xs text-primary hover:underline">
              {isOpen ? "Hide" : "Changes"}
            </button>
          )}
        </td>
      </tr>
      {isOpen && hasDiff && (
        <tr className="border-b bg-muted/30 last:border-0">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Before</p>
                <pre className="overflow-x-auto rounded-md border bg-card p-2 text-xs">{row.before ? JSON.stringify(row.before, null, 2) : "—"}</pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">After</p>
                <pre className="overflow-x-auto rounded-md border bg-card p-2 text-xs">{row.after ? JSON.stringify(row.after, null, 2) : "—"}</pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
