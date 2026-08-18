import type { EntityType, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";
import { env } from "@/lib/env";
import { entityHref } from "@/lib/notifications";
import { unsubscribeToken } from "@/lib/unsubscribe";

// Single dispatcher for member notifications. Every caller goes through `notify`,
// which writes the in-app rows and then fans the same event out to email so the
// two channels can never drift. Email is best-effort and never blocks the write.
//
// There is no queue/worker in this project, so the async primitive here is the
// same fire-and-forget promise the lead routes already use for outbound mail.

/** Fallback deep-link base, matching the URL the lead emails already used. */
export const DEFAULT_APP_URL = "https://portal.nexclub.com.au";

/** Absolute URL for an in-app path, so email links land on the right screen. */
export function appUrl(path: string): string {
  const base = (env.AUTH_URL ?? DEFAULT_APP_URL).replace(/\/+$/, "");
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

/** Escape user-supplied text before it goes into an HTML email body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Unique recipient list with the actor removed — nobody is notified about their
 * own action, and a user who qualifies twice for one event only gets one row
 * (and therefore one email).
 */
export function dedupeRecipients(
  ids: (string | null | undefined)[],
  actorId?: string | null
): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (actorId && id === actorId) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export type EmailEligibleUser = {
  email: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  emailNotificationsEnabled: boolean;
  hashedPassword: string | null;
};

/** A user is emailable only with an address, an active account, and the flag on. */
export function canEmail(user: EmailEligibleUser): boolean {
  return (
    Boolean(user.email) &&
    user.isActive &&
    user.deletedAt === null &&
    user.emailNotificationsEnabled &&
    // Proof the address belongs to them. `emailVerified` is never written
    // anywhere in this codebase, so gating on it would block every email;
    // a set password is the real signal, because setting one requires opening
    // the tokenised invitation link sent to that address. It also stops us
    // emailing invited accounts that were never activated.
    user.hashedPassword !== null
  );
}

export type NotificationEmailContext = {
  recipientName?: string | null;
  actorName?: string | null;
  leadName?: string | null;
  taskTitle?: string | null;
  excerpt?: string | null;
  fromStage?: string | null;
  toStage?: string | null;
  count?: number | null;
};

function shell(
  greetingName: string | null | undefined,
  inner: string,
  href: string,
  unsubscribeHref?: string
): string {
  const hi = greetingName ? `<p>Hi ${escapeHtml(greetingName)},</p>` : "";
  // Sender identification and a working unsubscribe, as the Spam Act expects.
  const footer =
    `<hr style="border:none;border-top:1px solid #e6e6e8;margin:24px 0 12px">` +
    `<p style="font-size:12px;color:#6b7280;margin:0">` +
    `Sent by NEX Club.` +
    (unsubscribeHref
      ? ` <a href="${unsubscribeHref}">Unsubscribe from notification emails</a>.`
      : "") +
    `</p>`;
  // Nodemailer sends UTF-8 by default, but a few clients trust the document over
  // the header — without this an emoji in a lead note can arrive as mojibake.
  const charset = `<meta charset="utf-8">`;
  return `${charset}${hi}${inner}<p><a href="${href}">Open it in NEX Club</a></p>${footer}`;
}

/**
 * Per-event subject + body. Each type gets its own copy and context so the email
 * says something specific rather than "you have a notification".
 */
export function buildNotificationEmail(
  type: NotificationType,
  ctx: NotificationEmailContext,
  href: string,
  unsubscribeHref?: string
): { subject: string; html: string } {
  const actor = ctx.actorName ? escapeHtml(ctx.actorName) : "Someone";
  const lead = ctx.leadName ? escapeHtml(ctx.leadName) : "a lead";
  const task = ctx.taskTitle ? escapeHtml(ctx.taskTitle) : "a task";
  const excerpt = ctx.excerpt ? escapeHtml(ctx.excerpt) : "";

  switch (type) {
    case "TASK_ASSIGNED":
      return {
        subject: `New task assigned: ${ctx.taskTitle ?? "task"}`,
        html: shell(
          ctx.recipientName,
          `<p>${actor} assigned you a task.</p><p><strong>${task}</strong></p>`,
          href,
          unsubscribeHref
        ),
      };
    case "TASK_DUE_TODAY":
      return {
        subject: `Task due today: ${ctx.taskTitle ?? "task"}`,
        html: shell(ctx.recipientName, `<p><strong>${task}</strong> is due today.</p>`, href, unsubscribeHref),
      };
    case "TASK_OVERDUE":
      return {
        subject: `Task overdue: ${ctx.taskTitle ?? "task"}`,
        html: shell(ctx.recipientName, `<p><strong>${task}</strong> is now overdue.</p>`, href, unsubscribeHref),
      };
    case "LEAD_ASSIGNED": {
      const many = (ctx.count ?? 1) > 1;
      return {
        subject: many
          ? `${ctx.count} new leads from ${ctx.actorName ?? "a member"}`
          : `New lead from ${ctx.actorName ?? "a member"}: ${ctx.leadName ?? ""}`.trim(),
        html: shell(
          ctx.recipientName,
          many
            ? `<p>${actor} assigned you ${ctx.count} new leads in NEX Club.</p>`
            : `<p>${actor} assigned you a new lead in NEX Club.</p><p><strong>${lead}</strong></p>`,
          href,
          unsubscribeHref
        ),
      };
    }
    case "LEAD_STATUS_CHANGE":
      return {
        subject: `Lead update: ${ctx.leadName ?? "your lead"}${ctx.toStage ? ` is now ${ctx.toStage}` : ""}`,
        html: shell(
          ctx.recipientName,
          `<p>${actor} moved the lead you referred — <strong>${lead}</strong> —` +
            (ctx.fromStage && ctx.toStage
              ? ` from <strong>${escapeHtml(ctx.fromStage)}</strong> to <strong>${escapeHtml(ctx.toStage)}</strong>.</p>`
              : ctx.toStage
                ? ` to <strong>${escapeHtml(ctx.toStage)}</strong>.</p>`
                : ` to a new stage.</p>`),
          href,
          unsubscribeHref
        ),
      };
    case "LEAD_COMMENT":
      return {
        subject: `${ctx.actorName ?? "Someone"} commented on ${ctx.leadName ?? "a lead"}`,
        html: shell(
          ctx.recipientName,
          `<p>${actor} commented on <strong>${lead}</strong>.</p>` +
            (excerpt ? `<blockquote>${excerpt}</blockquote>` : ""),
          href,
          unsubscribeHref
        ),
      };
    case "MENTIONED_IN_NOTE":
      return {
        subject: `${ctx.actorName ?? "Someone"} mentioned you${ctx.leadName ? ` on ${ctx.leadName}` : ""}`,
        html: shell(
          ctx.recipientName,
          `<p>${actor} mentioned you${ctx.leadName ? ` on <strong>${lead}</strong>` : ""}.</p>` +
            (excerpt ? `<blockquote>${excerpt}</blockquote>` : ""),
          href,
          unsubscribeHref
        ),
      };
    case "EVENT_CREATED":
      return {
        subject: `New club event: ${ctx.taskTitle ?? "event"}`,
        html: shell(
          ctx.recipientName,
          `<p>${actor} added a new club event.</p><p><strong>${task}</strong></p>` +
            (excerpt ? `<p>${excerpt}</p>` : ""),
          href,
          unsubscribeHref
        ),
      };
    case "EVENT_RESCHEDULED":
      return {
        subject: `Rescheduled: ${ctx.taskTitle ?? "club event"}`,
        html: shell(
          ctx.recipientName,
          `<p>A club event has changed.</p><p><strong>${task}</strong></p>` +
            (excerpt ? `<p>${excerpt}</p>` : "") +
            `<p>Please check the new time and update your RSVP if you need to.</p>`,
          href,
          unsubscribeHref
        ),
      };
    case "EVENT_CANCELLED":
      return {
        subject: `Cancelled: ${ctx.taskTitle ?? "club event"}`,
        html: shell(
          ctx.recipientName,
          `<p>A club event has been cancelled.</p><p><strong>${task}</strong></p>` +
            (excerpt ? `<p>${excerpt}</p>` : ""),
          href,
          unsubscribeHref
        ),
      };
    case "EVENT_RSVP_REMINDER":
      return {
        subject: `Are you coming? ${ctx.taskTitle ?? "club event"}`,
        html: shell(
          ctx.recipientName,
          `<p>You have not responded to this club event yet.</p><p><strong>${task}</strong></p>` +
            (excerpt ? `<p>${excerpt}</p>` : "") +
            `<p>Let the club know whether you can make it.</p>`,
          href,
          unsubscribeHref
        ),
      };
    case "DEAL_UPDATED":
    default:
      return {
        subject: "Update in NEX Club",
        html: shell(ctx.recipientName, `<p>${actor} updated something you follow.</p>`, href, unsubscribeHref),
      };
  }
}

export type NotifyInput = {
  organizationId: string;
  recipientIds: (string | null | undefined)[];
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: EntityType | null;
  entityId?: string | null;
  /** Extra context for the email template (lead name, excerpt, stages, ...). */
  email?: NotificationEmailContext;
};

/**
 * Create the in-app notification(s) and mirror the event to email.
 * Returns the recipients actually notified (deduped, actor removed).
 */
export async function notify(input: NotifyInput): Promise<string[]> {
  const recipients = dedupeRecipients(input.recipientIds, input.actorId);
  if (recipients.length === 0) return [];

  await prisma.notification.createMany({
    data: recipients.map((recipientId) => ({
      organizationId: input.organizationId,
      recipientId,
      actorId: input.actorId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    })),
  });

  // Mirror to email without blocking the caller (no queue in this project).
  void dispatchEmails(input, recipients).catch(() => {});

  return recipients;
}

async function dispatchEmails(input: NotifyInput, recipients: string[]): Promise<void> {
  const users = await prisma.user.findMany({
    where: { id: { in: recipients } },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      deletedAt: true,
      emailNotificationsEnabled: true,
      hashedPassword: true, // only to prove address ownership; never returned
    },
  });

  const href = appUrl(entityHref(input.entityType, input.entityId) ?? "/notifications");

  for (const user of users) {
    if (!canEmail(user)) {
      console.warn(`[notify] skipping email for user ${user.id} (${input.type})`);
      continue;
    }
    const unsubscribeHref = appUrl(
      `/api/notifications/unsubscribe?u=${encodeURIComponent(user.id)}&t=${unsubscribeToken(user.id)}`
    );
    const { subject, html } = buildNotificationEmail(
      input.type,
      { ...input.email, recipientName: user.name },
      href,
      unsubscribeHref
    );
    await sendMail({ to: user.email as string, subject, html }).catch(() => {
      console.warn(`[notify] email failed for user ${user.id} (${input.type})`);
    });
  }
}
