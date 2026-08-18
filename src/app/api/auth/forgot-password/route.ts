import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { forgotPasswordSchema } from "@/server/validators/auth";
import { generateToken, hashToken } from "@/lib/tokens";
import { rateLimit } from "@/lib/rate-limit";
import { getClientContext } from "@/server/request";
import { sendMail } from "@/lib/email";

const ONE_HOUR = 60 * 60 * 1000;

export async function POST(req: Request) {
  // Rate-limit reset requests per client so the endpoint can't be used to spam a
  // victim's inbox or probe for accounts.
  const { ipAddress } = getClientContext(req);
  const rl = rateLimit(`forgot-password:${ipAddress ?? "unknown"}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Only act for a real, active account — but always return success so the
  // endpoint can't be used to discover which emails are registered.
  if (user && user.isActive && !user.deletedAt) {
    const token = generateToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expires: new Date(Date.now() + ONE_HOUR) },
    });

    const base = env.AUTH_URL ?? "http://localhost:3000";
    const url = `${base}/reset-password?token=${token}`;
    await sendMail({
      to: email,
      subject: "Reset your NexLink password",
      html: `<p>We received a request to reset your password.</p><p><a href="${url}">Reset your password</a> (valid for 1 hour).</p><p>If you didn't request this, you can ignore this email.</p>`,
    }).catch((e) =>
      console.error("[email] forgot password send failed:", String(e))
    );
  }

  return NextResponse.json({ ok: true });
}
