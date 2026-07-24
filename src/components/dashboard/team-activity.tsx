import Link from "next/link";
import { getRecentTeamActivity } from "@/server/audit";
import { AUDIT_ACTION_LABELS, AUDIT_ACTION_BADGE, auditEntityHref } from "@/lib/notifications";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

// Recent "who did what" feed shown to EVERY member on the dashboard. It reads
// the member-safe slice of the audit log (see getRecentTeamActivity — no IPs,
// logins or before/after payloads). Admins get a link through to the full
// forensic log at /audit; members just see the activity.
export async function TeamActivity({
  organizationId,
  isAdmin,
}: {
  organizationId: string;
  isAdmin: boolean;
}) {
  const items = await getRecentTeamActivity(organizationId);

  return (
    <section className="rounded-xl bg-card p-4 sm:p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Team activity</h2>
        {isAdmin && (
          <Link href="/audit" className="text-xs font-medium text-primary hover:underline">
            View full log
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No recent activity yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((a) => {
            const href = auditEntityHref(a.entityType, a.entityId);
            return (
              <li key={a.id} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "inline-block shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold",
                    AUDIT_ACTION_BADGE[a.action]
                  )}
                >
                  {AUDIT_ACTION_LABELS[a.action]}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{a.actorName ?? "Someone"}</span>
                  <span className="text-muted-foreground"> · </span>
                  {href ? (
                    <Link href={href} className="hover:text-primary">
                      {a.entityType}
                    </Link>
                  ) : (
                    <span>{a.entityType}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(a.createdAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
