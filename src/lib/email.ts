import { Resend } from "resend";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { mergeSettings } from "@/server/admin/settings";

type Mail = { to: string; subject: string; html: string };

// Mirrors isStorageConfigured(): the app runs fine without Resend; sendMail()
// falls back to a console.log dev mode until this is set.
export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

let client: Resend | null = null;
function resendClient(): Resend {
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

// Resolve the "from" address from org settings when configured, otherwise
// fall back to env, otherwise a hardcoded default. A DB read failure quietly
// falls back so email never breaks the request.
async function resolveFrom(): Promise<string> {
  const fallback = env.EMAIL_FROM || "no-reply@valetcrm.app";
  try {
    const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { settings: true } });
    if (!org) return fallback;
    return mergeSettings(org.settings).email.from || fallback;
  } catch {
    return fallback;
  }
}

export async function sendMail({ to, subject, html }: Mail): Promise<void> {
  if (!isEmailConfigured()) {
    // No Resend API key configured — log the message so flows work in development.
    console.log(`\n[email:dev]\nTo: ${to}\nSubject: ${subject}\n${html}\n`);
    return;
  }

  const from = await resolveFrom();
  const { error } = await resendClient().emails.send({ from, to, subject, html });
  // The Resend SDK reports failures via a returned `error`, not a rejected
  // promise — throw so callers' existing try/catch (or lack thereof) behaves
  // the same as it did with nodemailer, instead of silently dropping the mail.
  if (error) throw new Error(error.message);
}
