import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("public registration is removed from the UI", () => {
  const loginPage = read("src/app/(auth)/login/page.tsx");
  const loginForm = read("src/app/(auth)/login/login-form.tsx");
  // The site root lives in the (auth) route group so it renders the sign-in screen.
  const home = read("src/app/(auth)/page.tsx");

  it("the login page has no register / sign-up link", () => {
    expect(loginPage).not.toMatch(/\/register/);
    expect(loginPage).not.toMatch(/create an account/i);
    expect(loginPage).not.toMatch(/sign\s*up/i);
  });

  it("the login form's only secondary action is the reset-password link", () => {
    expect(loginForm).not.toMatch(/\/register/);
    expect(loginForm).toMatch(/\/forgot-password/); // reset flow
    expect(loginForm.toLowerCase()).toContain("reset password");
  });

  it("the landing page has no public 'create account' call to action", () => {
    expect(home).not.toMatch(/\/register/);
    expect(home).not.toMatch(/create account/i);
  });

  it("a signed-in member is never bounced away from /reset-password", () => {
    // Reset and invitation emails both link to /reset-password?token=…. Listing it
    // alongside /login would redirect an already-signed-in recipient to /dashboard
    // and silently discard the token.
    const config = read("src/lib/auth.config.ts");
    const list = config.match(/SIGNED_IN_REDIRECT_PAGES = \[(.*?)\]/s)?.[1] ?? "";
    expect(list).toMatch(/\/login/);
    expect(list).not.toMatch(/\/reset-password/);
  });
});

describe("the old registration endpoint is disabled server-side", () => {
  it("POST /api/auth/register is rejected with 403 (no account without an invite)", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const req = new Request("http://test/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // A perfectly well-formed signup body must still be refused.
      body: JSON.stringify({ name: "Mallory", email: "mallory@evil.test", password: "Sup3rSecret", industry: "Finance" }),
    });
    const res = await (POST as (r?: Request) => Promise<Response>)(req);
    expect(res.status).toBe(403);
  });

  it("GET /api/auth/register is not found (404)", async () => {
    const { GET } = await import("@/app/api/auth/register/route");
    const res = await GET();
    expect(res.status).toBe(404);
  });
});
