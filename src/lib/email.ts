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
    // No SMTP configured — log the message so flows work in development.
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

  await transport.sendMail({ from: smtp.from || "no-reply@valetcrm.app", to, subject, html });
}
