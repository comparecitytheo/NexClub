import "@/lib/env-guard"; // normalize AUTH_URL before NextAuth reads it
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/server/validators/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getClientContext } from "@/server/request";

// A real bcrypt hash of a value nobody can supply, used only to spend the same
// time on the "no such user" path as on a genuine password check. Cost factor
// 10 matches every hash the app writes (invitations, reset, bootstrap, seed).
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",

    // INACTIVITY TIMEOUT — 1 hour.
    //
    // `maxAge` is how long a session survives without being renewed, and
    // `updateAge: 0` renews it on every request. Together those give a ROLLING
    // hour: the clock resets each time someone uses the CRM, and only starts
    // running down when they stop.
    //
    // Without `updateAge: 0` this would be an ABSOLUTE hour and would sign
    // people out mid-task, an hour after login, however busy they were —
    // which is why the two settings belong together.
    maxAge: 60 * 60, // seconds
    updateAge: 0,
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const lowered = email.toLowerCase();

        // RATE LIMIT. Login was the one public auth endpoint without one —
        // forgot-password, reset-password and invitation accept all had it, so
        // credential stuffing simply went through the front door instead.
        // Limited on BOTH axes on purpose: per-IP stops one host spraying many
        // accounts, per-email stops a botnet grinding one account.
        const { ipAddress } = getClientContext(request);
        const perIp = rateLimit(`login:ip:${ipAddress ?? "unknown"}`, 10, 60_000);
        const perEmail = rateLimit(`login:email:${lowered}`, 5, 60_000);
        if (!perIp.ok || !perEmail.ok) return null;

        const user = await prisma.user.findUnique({ where: { email: lowered } });

        // TIMING. When no user was found this returned immediately, while a real
        // account ran a bcrypt compare — measured at ~78ms on cost factor 10.
        // That gap is trivially readable over a network and tells an attacker
        // exactly which addresses belong to club members, which is the useful
        // half of the work. Burn an equivalent compare against a throwaway hash
        // so both paths cost the same.
        if (!user || !user.hashedPassword || !user.isActive || user.deletedAt) {
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }

        const valid = await bcrypt.compare(password, user.hashedPassword);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatarUrl ?? undefined,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
});
