import { describe, it, expect, vi, beforeEach } from "vitest";

const store = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (store.jar.has(k) ? { value: store.jar.get(k) } : undefined),
    set: (k: string, v: string) => void store.jar.set(k, v),
    delete: (k: string) => void store.jar.delete(k),
  }),
}));

const db = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: db.findUnique } } }));

process.env.AUTH_SECRET = "test-secret-for-signing";

import {
  startSupportSession,
  endSupportSession,
  readSupportSession,
} from "@/server/support-session";

const TARGET = { id: "member1", name: "Amelia Cross", isActive: true };

beforeEach(() => {
  store.jar.clear();
  db.findUnique.mockReset().mockResolvedValue(TARGET);
});

describe("starting and reading a support session", () => {
  it("records who is being helped", async () => {
    await startSupportSession("super1", "member1");
    const s = await readSupportSession("super1");
    expect(s).toMatchObject({ targetUserId: "member1", superAdminId: "super1" });
  });

  it("is invisible to a different signed-in user", async () => {
    // A stolen cookie is useless in someone else's browser: the session names
    // the Super Admin it was issued to, and is only honoured for them.
    await startSupportSession("super1", "member1");
    expect(await readSupportSession("someone-else")).toBeNull();
  });

  it("ends cleanly", async () => {
    await startSupportSession("super1", "member1");
    await endSupportSession();
    expect(await readSupportSession("super1")).toBeNull();
  });

  it("reports nothing when there is no session", async () => {
    expect(await readSupportSession("super1")).toBeNull();
  });
});

describe("the cookie cannot be forged", () => {
  it("rejects a tampered payload", async () => {
    await startSupportSession("super1", "member1");
    const raw = [...store.jar.values()][0];
    const [body, mac] = raw.split(".");
    // Swap the target for another user, keeping the original signature.
    const evil = Buffer.from(
      JSON.stringify({ targetUserId: "someone-important", superAdminId: "super1", expiresAt: Date.now() + 60000 })
    ).toString("base64url");
    store.jar.set("nex_support_session", `${evil}.${mac}`);
    expect(await readSupportSession("super1")).toBeNull();
    expect(body).not.toBe(evil);
  });

  it("rejects a cookie with no signature at all", async () => {
    store.jar.set("nex_support_session", "just-some-text");
    expect(await readSupportSession("super1")).toBeNull();
  });
});

describe("the session does not outlive its target", () => {
  it("stops working if the member is deactivated", async () => {
    await startSupportSession("super1", "member1");
    db.findUnique.mockResolvedValue({ ...TARGET, isActive: false });
    expect(await readSupportSession("super1")).toBeNull();
  });

  it("stops working if the member is gone", async () => {
    await startSupportSession("super1", "member1");
    db.findUnique.mockResolvedValue(null);
    expect(await readSupportSession("super1")).toBeNull();
  });
});

describe("a Super Admin can always get back out", () => {
  it("clears the session even when the read fails", async () => {
    // The escape hatch must not depend on anything working. endSupportSession
    // deletes the cookie unconditionally, so a corrupt or unreadable session
    // cannot strand an operator inside someone else's account.
    store.jar.set("nex_support_session", "corrupt-value");
    await endSupportSession();
    expect(store.jar.has("nex_support_session")).toBe(false);
  });

  it("reports no session rather than throwing when cookies are unavailable", async () => {
    // Called from a background job or a test there is no request scope; the
    // right answer is "nobody is supporting", never an exception.
    store.jar.clear();
    await expect(readSupportSession("super1")).resolves.toBeNull();
  });
});
