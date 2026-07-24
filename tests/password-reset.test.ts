import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory DB + captured outbound mail so the full reset flow runs offline.
const h = vi.hoisted(() => {
  const store = { users: [] as any[], prts: [] as any[] };
  const mails: any[] = [];
  let seq = 0;
  return { store, mails, next: (p: string) => `${p}_${++seq}` };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: async ({ where }: any) =>
        h.store.users.find((u: any) => (where.email ? u.email === where.email : u.id === where.id)) ?? null,
      update: async ({ where, data }: any) => {
        const u = h.store.users.find((x: any) => x.id === where.id);
        Object.assign(u, data);
        return u;
      },
    },
    passwordResetToken: {
      create: async ({ data }: any) => {
        const row = { id: h.next("prt"), usedAt: null, ...data };
        h.store.prts.push(row);
        return row;
      },
      findUnique: async ({ where, include }: any) => {
        const row = h.store.prts.find((r: any) => r.tokenHash === where.tokenHash) ?? null;
        if (row && include?.user) return { ...row, user: h.store.users.find((u: any) => u.id === row.userId) };
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = h.store.prts.find((r: any) => r.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    $transaction: async (ops: any[]) => Promise.all(ops),
  },
}));

vi.mock("@/lib/email", () => ({
  sendMail: async (mail: any) => {
    h.mails.push(mail);
  },
}));

vi.mock("@/lib/env", () => ({ env: { AUTH_URL: "https://app.test" } }));
vi.mock("@/server/audit", () => ({ recordAudit: async () => {} }));
vi.mock("@/server/admin/settings", () => ({
  getOrgSettings: async () => ({ security: { passwordMinLength: 8 } }),
}));

import { POST as forgotPost } from "@/app/api/auth/forgot-password/route";
import { POST as resetPost } from "@/app/api/auth/reset-password/route";
import { __resetRateLimiter } from "@/lib/rate-limit";

function post(body: any) {
  return new Request("http://test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const tokenFromMail = (html: string) => (html.match(/token=([a-f0-9]+)/) || [])[1];

beforeEach(() => {
  h.store.users.length = 0;
  h.store.prts.length = 0;
  h.mails.length = 0;
  __resetRateLimiter();
  h.store.users.push({ id: "u1", email: "dana@acme.io", isActive: true, deletedAt: null, hashedPassword: "OLD", organizationId: "org1" });
});

describe("password reset — full flow", () => {
  it("requesting a reset emails a link containing a valid token", async () => {
    const res = await forgotPost(post({ email: "dana@acme.io" }));
    expect(res.status).toBe(200);
    expect(h.mails).toHaveLength(1);
    expect(h.mails[0].to).toBe("dana@acme.io");
    const token = tokenFromMail(h.mails[0].html);
    expect(token).toBeTruthy();
    expect(h.store.prts).toHaveLength(1); // only the hash is stored
    expect(h.store.prts[0].tokenHash).not.toBe(token);
  });

  it("the emailed link resets the password, and the token is then single-use", async () => {
    await forgotPost(post({ email: "dana@acme.io" }));
    const token = tokenFromMail(h.mails[0].html);

    const r1 = await resetPost(post({ token, password: "Sup3rSecret" }));
    expect(r1.status).toBe(200);
    const user = h.store.users.find((u: any) => u.id === "u1");
    expect(user.hashedPassword).not.toBe("OLD"); // updated
    expect(user.hashedPassword).not.toBe("Sup3rSecret"); // hashed, not plaintext
    expect(h.store.prts[0].usedAt).toBeTruthy();

    // Reusing the same link fails.
    const r2 = await resetPost(post({ token, password: "An0therPass" }));
    expect(r2.status).toBe(400);
  });

  it("does not reveal whether an email exists (unknown email still returns ok, sends nothing)", async () => {
    const res = await forgotPost(post({ email: "nobody@nowhere.io" }));
    expect(res.status).toBe(200);
    expect(h.mails).toHaveLength(0);
  });

  it("rejects an expired token", async () => {
    await forgotPost(post({ email: "dana@acme.io" }));
    const token = tokenFromMail(h.mails[0].html);
    h.store.prts[0].expires = new Date(Date.now() - 1000); // force expiry
    const res = await resetPost(post({ token, password: "Sup3rSecret" }));
    expect(res.status).toBe(400);
  });
});
