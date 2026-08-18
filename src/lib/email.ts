import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { mergeSettings } from "@/server/admin/settings";

type Mail = { to: string; subject: string; html: string };

// Resolve SMTP host/port/user/from from org settings when configured, otherwise
// fall back to env. The SMTP *password* is only ever read from env — it is never
// stored in the database. A DB read failure quietly falls back to env so email
// never breaks the request.
async function resolveSmtp() {
  const base = {
    host: env.EMAIL_SERVER_HOST ?? "",
    port: Number(env.EMAIL_SERVER_PORT ?? 587),
    user: env.EMAIL_SERVER_USER ?? "",
    from: env.EMAIL_FROM ?? "",
  };
  try {
    const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { settings: true } });
    if (!org) return base;
    const cfg = mergeSettings(org.settings).smtp;
    return {
      host: cfg.host || base.host,
      port: cfg.port || base.port,
      user: cfg.user || base.user,
      from: cfg.from || base.from,
    };
  } catch {
    return base;
  }
}

export async function sendMail({ to, subject, html }: Mail): Promise<void> {
  const smtp = await resolveSmtp();
  if (!smtp.host) {
    // In DEVELOPMENT, logging the message keeps flows working without SMTP.
    //
    // In PRODUCTION this must be loud. Returning quietly meant every email
    // silently vanished while every caller reported success — which is exactly
    // why lead notifications appeared not to fire. Throwing surfaces the
    // misconfiguration instead of hiding it; notify() already catches per
    // recipient, so one bad config cannot take down a request.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "EMAIL_SERVER_HOST is not configured — refusing to silently drop mail."
      );
    }
    console.log(`\n[email:dev]\nTo: ${to}\nSubject: ${subject}\n${html}\n`);
    return;
  }

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth:
      (smtp.user || env.EMAIL_SERVER_USER) && env.EMAIL_SERVER_PASSWORD
        ? { user: smtp.user || env.EMAIL_SERVER_USER || "", pass: env.EMAIL_SERVER_PASSWORD }
        : undefined,
  });

  // One retry. SMTP failures are often transient (a dropped connection, a brief
  // rate limit), and previously a single blip meant the member simply never
  // received the mail with nothing recorded anywhere.
  const message = { from: smtp.from || "no-reply@valetcrm.app", to, subject, html };
  try {
    await transport.sendMail(message);
  } catch (first) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      await transport.sendMail(message);
    } catch (second) {
      console.error(
        `[email] failed twice for ${to} ("${subject}"): ${String(second)} (first: ${String(first)})`
      );
      throw second;
    }
  }
}
