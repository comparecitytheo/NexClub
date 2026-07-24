import type { NotificationType, EntityType, AuditAction } from "@prisma/client";

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  TASK_ASSIGNED: "Task assigned",
  TASK_OVERDUE: "Task overdue",
  TASK_DUE_TODAY: "Task due today",
  DEAL_UPDATED: "Deal updated",
  LEAD_ASSIGNED: "New lead",
  LEAD_STATUS_CHANGE: "Lead status",
  LEAD_COMMENT: "New comment",
  MENTIONED_IN_NOTE: "Mentioned",
};

// Per-type accent: a dot color + a matching label color so each alert type is
// distinguishable at a glance. Semantics: red = overdue/urgent, amber = due
// today, blue = new lead, violet = comment, emerald = deal progress, sky = lead
// status, teal = task assigned, fuchsia = mention. Full literal class strings so
// Tailwind's content scanner keeps them (same approach as AUDIT_ACTION_BADGE).
export const NOTIFICATION_COLORS: Record<NotificationType, { dot: string; label: string }> = {
  TASK_OVERDUE: { dot: "bg-red-500", label: "text-red-600" },
  TASK_DUE_TODAY: { dot: "bg-amber-500", label: "text-amber-600" },
  TASK_ASSIGNED: { dot: "bg-teal-500", label: "text-teal-600" },
  LEAD_ASSIGNED: { dot: "bg-blue-500", label: "text-blue-600" },
  LEAD_STATUS_CHANGE: { dot: "bg-sky-500", label: "text-sky-600" },
  LEAD_COMMENT: { dot: "bg-violet-500", label: "text-violet-600" },
  DEAL_UPDATED: { dot: "bg-emerald-500", label: "text-emerald-600" },
  MENTIONED_IN_NOTE: { dot: "bg-fuchsia-500", label: "text-fuchsia-600" },
};

// Deep-link target for a notification's linked entity.
export function entityHref(type?: EntityType | null, id?: string | null): string | null {
  if (!type || !id) return null;
  const seg = type === "LEAD" ? "leads" : type === "CONTACT" ? "contacts" : type === "COMPANY" ? "companies" : "deals";
  return `/${seg}/${id}`;
}

type NotificationRef = {
  type: NotificationType;
  entityType?: EntityType | null;
  entityId?: string | null;
};

// Centralizes type -> route logic for notifications so every item resolves to a
// destination and new types are easy to add. Order of preference:
//   1. the stored entity deep-link (lead / contact / company / deal), then
//   2. a type-based fallback to the most relevant section when the entity ref is
//      missing or unresolvable.
// Always returns a string and never throws, so it is safe on malformed data.
export function getNotificationHref(n: NotificationRef): string {
  const entity = entityHref(n.entityType, n.entityId);
  if (entity) return entity;

  switch (n.type) {
    // Task notifications store their *linked record* (handled above), not the
    // task id, so with no linked record the tasks list is the safe destination.
    // Deep-linking to a specific task would need the task id persisted on the
    // notification — see the delivery note.
    case "TASK_ASSIGNED":
    case "TASK_OVERDUE":
    case "TASK_DUE_TODAY":
      return "/tasks";
    // These are always created with a LEAD entity, so a missing ref is
    // unexpected: warn, then fall back to the leads list rather than crash.
    case "LEAD_ASSIGNED":
    case "LEAD_STATUS_CHANGE":
    case "LEAD_COMMENT":
      warnMissingEntity(n);
      return "/leads";
    case "DEAL_UPDATED":
      warnMissingEntity(n);
      return "/deals";
    // Mentions live on a parent record (carried as the entity above); without it
    // there is no dedicated list, so land on the generic notifications page.
    case "MENTIONED_IN_NOTE":
    default:
      warnMissingEntity(n);
      return "/notifications";
  }
}

function warnMissingEntity(n: NotificationRef): void {
  if (typeof console !== "undefined") {
    console.warn(
      `[notifications] could not resolve a deep-link for type=${n.type} ` +
        `(entityType=${n.entityType ?? "null"}, entityId=${n.entityId ?? "null"}); using a fallback route.`
    );
  }
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  LOGIN: "Signed in",
  LOGOUT: "Signed out",
  ASSIGN: "Assigned",
  STATUS_CHANGE: "Status change",
  EXPORT: "Exported",
};

export const AUDIT_ACTION_BADGE: Record<AuditAction, string> = {
  CREATE: "bg-emerald-100 text-emerald-800",
  UPDATE: "bg-sky-100 text-sky-800",
  DELETE: "bg-rose-100 text-rose-800",
  LOGIN: "bg-slate-100 text-slate-700",
  LOGOUT: "bg-slate-100 text-slate-700",
  ASSIGN: "bg-teal-100 text-teal-800",
  STATUS_CHANGE: "bg-amber-100 text-amber-800",
  // Data leaving the system — deliberately distinct so it stands out on review.
  EXPORT: "bg-fuchsia-100 text-fuchsia-800",
};

// Audit logs store entityType as a model name string ("Lead", "Deal", ...).
export function auditEntityHref(entityType: string, id?: string | null): string | null {
  if (!id) return null;
  const map: Record<string, string> = { Lead: "leads", Contact: "contacts", Company: "companies", Deal: "deals", Task: "tasks" };
  const seg = map[entityType];
  return seg ? `/${seg}/${id}` : null;
}
