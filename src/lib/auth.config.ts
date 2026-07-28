import type { NextAuthConfig } from "next-auth";

// Paths under these prefixes require a session.
const PROTECTED_PREFIXES = ["/dashboard", "/leads", "/contacts", "/companies", "/deals", "/tasks", "/members", "/admin"];
// Auth pages a signed-in member has no business seeing — bounce them into the app.
// /reset-password is deliberately absent: password-reset and invitation links both
// land there, and the person clicking one is often already signed in. Redirecting
// them to /dashboard would swallow the token and silently break the reset.
const SIGNED_IN_REDIRECT_PAGES = ["/login", "/register", "/forgot-password"];

// This config is imported by middleware, so it must not pull in Node-only
// modules (Prisma, bcrypt). Providers are added in auth.ts.
export const authConfig = {
  // We run behind Vercel's proxy; trust the forwarded host so Auth.js derives
  // callback/redirect URLs from the real request host rather than a stale
  // AUTH_URL. Paired with the AUTH_URL normalization in env-guard.ts.
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;
      const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
      const isSignedInRedirectPage = SIGNED_IN_REDIRECT_PAGES.some((p) => path.startsWith(p));

      if (isProtected) return isLoggedIn;
      if (isSignedInRedirectPage && isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.organizationId = user.organizationId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.organizationId = token.organizationId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
