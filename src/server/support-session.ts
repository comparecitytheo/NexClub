import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * SUPPORT MODE — a Super Admin helping a member, without becoming them.
 *
 * The Super Admin's real identity NEVER changes. Their session stays exactly as
 * it was; a separate signed cookie records who they are currently helping. Pages
 * render as that member sees them, but every audited action still records the
 * Super Admin as the actor, with the member noted alongside.
 *
 * That distinction is the whole point. A silent identity swap would leave the
 * audit log unable to answer "did the member do this, or did the operator?" —
 * which matters under the Privacy Act obligations this CRM already carries.
 *
 * Three safeguards:
 *   - Only a Super Admin can start one, checked server-side.
 *   - The cookie is HMAC-signed, so it cannot be forged or edited by hand.
 *   - It expires on its own, so a forgotten session does not linger indefinitely.
 */

const COOKIE = "nex_support_session";
const TTL_MINUTES = 60;

type Payload = { targetUserId: string; superAdminId: string; expiresAt: number };

function secret(): string {
  // Reuses the auth secret: if that is unset the app cannot authenticate anyone
  // anyway, so there is no weaker fallback to worry about. Read from
  // process.env rather than the validated env module, so importing this file
  // does not force env validation on code paths that never sign a cookie.
  return process.env.AUTH_SECRET ?? "";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function encode(p: Payload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(raw: string): Payload | null {
  const [body, mac] = raw.split(".");
  if (!body || !mac) return null;

  const expected = sign(body);
  // Constant-time compare so a forged cookie cannot be brute-forced by timing.
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (!p.targetUserId || !p.superAdminId || !p.expiresAt) return null;
    if (p.expiresAt < Date.now()) return null; // expired
    return p;
  } catch {
    return null;
  }
}

/** Begin helping a member. Caller must already be verified as a Super Admin. */
export async function startSupportSession(superAdminId: string, targetUserId: string) {
  const jar = await cookies();
  jar.set(
    COOKIE,
    encode({
      targetUserId,
      superAdminId,
      expiresAt: Date.now() + TTL_MINUTES * 60_000,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TTL_MINUTES * 60,
    }
  );
}

export async function endSupportSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/**
 * The active support session, if any — validated, unexpired, and confirmed to
 * belong to the Super Admin currently signed in. Passing the real signed-in id
 * means a stolen cookie is useless in someone else's browser.
 */
export async function readSupportSession(realUserId: string): Promise<{
  targetUserId: string;
  targetName: string;
  superAdminId: string;
} | null> {
  // Tolerate being called outside a request scope (background jobs, cron, tests).
  // No cookie means no support session, which is the correct answer — never a
  // thrown error that takes the caller down with it.
  let raw: string | undefined;
  try {
    const jar = await cookies();
    raw = jar.get(COOKIE)?.value;
  } catch {
    return null;
  }
  if (!raw || !secret()) return null;

  const payload = decode(raw);
  if (!payload) return null;
  if (payload.superAdminId !== realUserId) return null;

  // Imported lazily: a static import would pull the Prisma client into every
  // module that reads a session, including ones that never touch the database.
  const { prisma } = await import("@/lib/prisma");
  const target = await prisma.user.findUnique({
    where: { id: payload.targetUserId },
    select: { id: true, name: true, isActive: true },
  });
  if (!target || !target.isActive) return null;

  return {
    targetUserId: target.id,
    targetName: target.name,
    superAdminId: payload.superAdminId,
  };
}
