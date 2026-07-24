import { describe, it, expect, vi } from "vitest";

// In-memory Prisma so the whole create -> accept flow runs without a database.
// vi.hoisted lets both the mock factory and the test body share the store.
const h = vi.hoisted(() => {
  const store = { invitations: [] as any[], users: [] as any[], industries: [] as any[] };
  let seq = 0;
  return { store, next: (p: string) => `${p}_${++seq}` };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invitation: {
      create: async ({ data }: any) => {
        const row = { id: h.next("inv"), status: "PENDING", createdAt: new Date(), acceptedAt: null, acceptedUserId: null, ...data };
        h.store.invitations.push(row);
        return row;
      },
      findUnique: async ({ where }: any) =>
        h.store.invitations.find((i: any) => (where.id ? i.id === where.id : i.tokenHash === where.tokenHash)) ?? null,
      findFirst: async ({ where }: any) =>
        h.store.invitations.find((i: any) => Object.entries(where).every(([k, v]) => i[k] === v)) ?? null,
      update: async ({ where, data }: any) => {
        const row = h.store.invitations.find((i: any) => i.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    user: {
      findUnique: async ({ where }: any) => h.store.users.find((u: any) => u.email === where.email) ?? null,
      create: async ({ data }: any) => {
        const row = { id: h.next("user"), ...data };
        h.store.users.push(row);
        return row;
      },
    },
    industry: {
      findFirst: async ({ where }: any) => {
        const eq = where?.name?.equals ?? where?.name;
        const ci = where?.name?.mode === "insensitive";
        return (
          h.store.industries.find((r: any) =>
            ci ? r.name.toLowerCase() === String(eq).toLowerCase() : r.name === eq
          ) ?? null
        );
      },
      findMany: async () => [...h.store.industries].sort((a: any, b: any) => a.name.localeCompare(b.name)),
      create: async ({ data }: any) => {
        // Mirror the DB's case-insensitive unique index.
        if (h.store.industries.some((r: any) => r.name.toLowerCase() === data.name.toLowerCase())) {
          throw new Error("unique violation");
        }
        const row = { id: h.next("ind"), name: data.name, createdAt: new Date() };
        h.store.industries.push(row);
        return row;
      },
    },
  },
}));

import { createInvitation, acceptInvitation } from "@/server/invitations";

const baseInput = {
  businessName: "Acme Pty Ltd",
  contactPerson: "Dana Reed",
  email: "Dana@Acme.io",
  mobileNumber: "0412 345 678", // local AU input; should normalise to E.164
  industry: "Finance",
  role: "SALES_REP",
  organizationId: "org1",
  invitedById: "admin1",
  base: "https://app.test",
  companyName: "NEX Club",
} as any;

describe("invitation service: create -> accept -> member with all five fields", () => {
  it("createInvitation persists all five canonical fields, stores only a token hash, and sets an expiry", async () => {
    const { invitation, rawToken, email } = await createInvitation({ ...baseInput });

    expect(invitation.businessName).toBe("Acme Pty Ltd");
    expect(invitation.contactPerson).toBe("Dana Reed");
    expect(invitation.email).toBe("dana@acme.io"); // normalised to lowercase
    expect(invitation.mobileNumber).toBe("+61412345678"); // E.164
    expect(invitation.industry).toBe("Finance");
    expect(invitation.role).toBe("SALES_REP"); // role fixed at send time

    expect(invitation.tokenHash).toBeTruthy();
    expect(invitation.tokenHash).not.toBe(rawToken); // raw token is never stored
    expect(invitation.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // The rendered password-setup email carries the dynamic fields.
    expect(email.html).toContain("Dana Reed");
    expect(email.html).toContain("Acme Pty Ltd");
    expect(email.html).toContain("Finance");
    expect(email.html).toContain(rawToken); // accept link embeds the real token
  });

  it("acceptInvitation creates the member carrying all five fields and is single-use", async () => {
    const { invitation, rawToken } = await createInvitation({ ...baseInput, email: "carol@firm.io" });

    const res = await acceptInvitation({ rawToken, password: "Sup3rSecret", role: "SALES_REP" as any });
    expect(res.ok).toBe(true);

    const created = h.store.users.find((u: any) => u.email === "carol@firm.io");
    expect(created.name).toBe("Dana Reed"); // contactPerson -> name
    expect(created.email).toBe("carol@firm.io");
    expect(created.businessName).toBe("Acme Pty Ltd");
    expect(created.phone).toBe("+61412345678"); // mobileNumber -> phone
    expect(created.industry).toBe("Finance");
    expect(created.hashedPassword).toBeTruthy();
    expect(created.hashedPassword).not.toBe("Sup3rSecret"); // hashed, not plaintext
    expect(created.role).toBe("SALES_REP");

    const stored = h.store.invitations.find((i: any) => i.id === invitation.id);
    expect(stored.status).toBe("ACCEPTED");
    expect(stored.acceptedUserId).toBe(created.id);

    // Single-use: the same link cannot be redeemed twice.
    const again = await acceptInvitation({ rawToken, password: "Sup3rSecret", role: "SALES_REP" as any });
    expect(again.ok).toBe(false);
  });

  it("rejects an expired invitation and flips its status to EXPIRED", async () => {
    const { invitation, rawToken } = await createInvitation({ ...baseInput, email: "past@firm.io" });
    const row = h.store.invitations.find((i: any) => i.id === invitation.id);
    row.expiresAt = new Date(Date.now() - 1000); // force into the past

    const res = await acceptInvitation({ rawToken, password: "Sup3rSecret", role: "SALES_REP" as any });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("expired");
    expect(row.status).toBe("EXPIRED");
  });
});
