import type { NextAuthConfig } from "next-auth";

// Paths under these prefixes require a session.
const PROTECTED_PREFIXES = ["/dashboard", "/leads", "/contacts", "/companies", "/deals", "/tasks", "/members", "/admin"];
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

// This config is imported by middleware, so it must not pull in Node-only
// modules (Prisma, bcrypt). Providers are added in auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;
      const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
      const isAuthPage = AUTH_PAGES.some((p) => path.startsWith(p));

      if (isProtected) return isLoggedIn;
      if (isAuthPage && isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
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
