import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createMemberSchema } from "@/server/validators/admin";

const ROUTE = readFileSync(join(process.cwd(), "src/app/api/admin/users/route.ts"), "utf8");
const DIALOG = readFileSync(
  join(process.cwd(), "src/components/admin/add-member-dialog.tsx"),
  "utf8"
);
const ADMIN_USERS = readFileSync(
  join(process.cwd(), "src/components/admin/admin-users.tsx"),
  "utf8"
);

/**
 * Invitation emails stopped reaching people, so an invited member could never
 * create an account. Adding directly takes email out of the loop entirely: the
 * Super Admin sets the first password and hands it over.
 *
 * Both routes in still exist — the club asked for invite AND direct add.
 */
describe("the password is optional, and validated when given", () => {
  it("accepts a member with no password (the invite-a-setup-link path)", () => {
    const parsed = createMemberSchema.safeParse({
      name: "Priya Nair",
      email: "priya@example.com",
      role: "SALES_REP",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.password).toBeUndefined();
  });

  it("accepts a strong password", () => {
    const parsed = createMemberSchema.safeParse({
      name: "Priya Nair",
      email: "priya@example.com",
      role: "SALES_REP",
      password: "Wallaby7Hill",
    });
    expect(parsed.success).toBe(true);
  });

  it("holds a directly-set password to the same rules as a member's own", () => {
    // An admin-chosen password must not be weaker than one the member would be
    // forced to pick themselves at /reset-password.
    for (const bad of ["short1A", "alllowercase1", "ALLUPPERCASE1", "NoDigitsHere"]) {
      const parsed = createMemberSchema.safeParse({
        name: "Priya Nair",
        email: "priya@example.com",
        role: "SALES_REP",
        password: bad,
      });
      expect(parsed.success, `${bad} should be rejected`).toBe(false);
    }
  });
});

describe("the route", () => {
  it("hashes the password rather than storing it", () => {
    expect(ROUTE).toMatch(/hashedPassword: password \? await bcrypt\.hash\(password, 10\) : null/);
  });

  it("sends no email at all when a password was set", () => {
    // The password branch returns before the setup-link mail is built.
    const passwordBranch = ROUTE.slice(ROUTE.indexOf("if (password)"));
    const returnIdx = passwordBranch.indexOf("status: 201");
    expect(passwordBranch.slice(0, returnIdx)).not.toContain("sendMail");
  });

  it("never writes the password into the audit trail", () => {
    expect(ROUTE).toContain("passwordSetByAdmin: true");
    expect(ROUTE).not.toMatch(/after: \{[^}]*\bpassword\b(?!SetByAdmin)/);
  });

  it("stays Super Admin only", () => {
    expect(ROUTE).toMatch(/export async function POST[\s\S]{0,200}requireSuperAdminForWrite/);
  });

  it("reports honestly whether the setup email sent", () => {
    // Same rule as the invitation endpoint: an undelivered link must not look
    // like a delivered one.
    expect(ROUTE).toMatch(/inviteSent = false/);
    expect(ROUTE).not.toMatch(/inviteSent: true\s*[,}]/);
  });
});

describe("the screen offers both ways in", () => {
  it("keeps Invite and adds Add", () => {
    expect(ADMIN_USERS).toContain("InviteMemberDialog");
    expect(ADMIN_USERS).toContain("AddMemberDialog");
    expect(ADMIN_USERS).toMatch(/Invite member/);
    expect(ADMIN_USERS).toMatch(/Add member/);
  });

  it("opens only one of the two at a time", () => {
    expect(ADMIN_USERS).toMatch(/setShowCreate\(false\);\s*setShowAdd\(\(s\) => !s\)/);
    expect(ADMIN_USERS).toMatch(/setShowAdd\(false\);\s*setShowCreate\(\(s\) => !s\)/);
  });

  it("shows the password so it can be passed on, and says the member may change it", () => {
    // Masking it would leave the Super Admin unable to read out the one thing
    // the member needs.
    expect(DIALOG).toMatch(/type="text"/);
    expect(DIALOG).toMatch(/change it/i);
  });

  it("says plainly that no invitation goes out", () => {
    expect(DIALOG).toMatch(/No invitation is sent/i);
  });
});
