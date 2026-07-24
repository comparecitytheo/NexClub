import { describe, it, expect, beforeEach, vi } from "vitest";

// These tests prove the "single shared entity" guarantees by driving the REAL
// route handlers against one shared in-memory data store. A write performed via
// one route as one user is then read back via another route as the other user,
// so the assertions only pass if both sides are backed by the same canonical
// Lead row and the same lead-scoped Note thread.
//
// The store mirrors the real schema exactly: one `leads` row per lead (with a
// referrerId = sender and ownerId = receiver) and Notes keyed by leadId. There
// is no per-user comment store to fake, because the code doesn't have one.

const h = vi.hoisted(() => {
  const users: Record<string, any> = {};
  const leads: Record<string, any> = {};
  const notes: any[] = [];
  let noteSeq = 0;
  let current: any = null;

  const reset = () => {
    Object.keys(users).forEach((k) => delete users[k]);
    Object.keys(leads).forEach((k) => delete leads[k]);
    notes.length = 0;
    noteSeq = 0;
    current = null;
  };
  const setUser = (u: any) => {
    current = u;
  };
  const getCurrent = () => current;

  // Minimal Prisma `where` evaluator — enough for the filters these routes use
  // (id, org scoping, owner/referrer access via OR, optimistic status guard).
  const match = (lead: any, where: any): boolean => {
    if (!where) return true;
    for (const [k, v] of Object.entries(where)) {
      if (k === "OR") {
        if (!(v as any[]).some((c) => match(lead, c))) return false;
      } else if (k === "AND") {
        if (!(v as any[]).every((c) => match(lead, c))) return false;
      } else if (k === "deletedAt") {
        if (v === null && lead.deletedAt != null) return false;
      } else if (["id", "organizationId", "ownerId", "referrerId", "status", "sentStatus"].includes(k)) {
        if (lead[k] !== v) return false;
      }
      // Unhandled keys (e.g. createdAt ranges) are ignored for these tests.
    }
    return true;
  };

  const resolveUser = (id: string) => {
    const u = users[id] ?? { id, name: "Unknown", email: null, phone: null, avatarUrl: null };
    return { id: u.id, name: u.name, email: u.email ?? null, phone: u.phone ?? null, avatarUrl: u.avatarUrl ?? null };
  };

  const withRelations = (lead: any, include: any) => {
    const out: any = { ...lead };
    if (include?.referrer) out.referrer = resolveUser(lead.referrerId);
    if (include?.owner) out.owner = resolveUser(lead.ownerId);
    if (include?.taskEntries) out.taskEntries = [];
    if (include?.noteEntries) {
      out.noteEntries = notes
        .filter((n) => n.leadId === lead.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((n) => ({
          id: n.id,
          body: n.body,
          createdAt: n.createdAt,
          leadStageAtPost: n.leadStageAtPost,
          author: resolveUser(n.authorId),
        }));
    }
    return out;
  };

  const prismaMock = {
    lead: {
      findFirst: async ({ where, include }: any) => {
        const lead = Object.values(leads).find((l: any) => match(l, where));
        return lead ? withRelations(lead, include) : null;
      },
      findUnique: async ({ where }: any) => (leads[where.id] ? { ...leads[where.id] } : null),
      update: async ({ where, data, include }: any) => {
        const lead = leads[where.id];
        if (!lead) throw new Error("Record to update not found");
        for (const [k, v] of Object.entries(data)) {
          if (k === "owner" && v && (v as any).connect) lead.ownerId = (v as any).connect.id;
          else lead[k] = v;
        }
        return withRelations(lead, include);
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const lead of Object.values(leads) as any[]) {
          if (match(lead, where)) {
            Object.assign(lead, data);
            count++;
          }
        }
        return { count };
      },
    },
    note: {
      create: async ({ data }: any) => {
        // Deterministic increasing timestamps so ordering is stable + identical on both sides.
        const note = { id: `note_${++noteSeq}`, createdAt: new Date(2026, 0, 1, 0, 0, noteSeq), updatedAt: new Date(), ...data };
        notes.push(note);
        return {
          id: note.id,
          body: note.body,
          createdAt: note.createdAt,
          leadStageAtPost: note.leadStageAtPost,
          author: resolveUser(note.authorId),
        };
      },
    },
    user: { findFirst: async () => null },
    notification: { create: async () => ({}), createMany: async () => ({ count: 0 }) },
    activity: { create: async () => ({}) },
  };

  return { users, leads, notes, reset, setUser, getCurrent, prismaMock };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prismaMock }));
vi.mock("@/server/api-helpers", () => ({
  requireUser: async () => {
    const u = h.getCurrent();
    return u ? { user: u } : { error: new Response(JSON.stringify({ error: "unauth" }), { status: 401 }) };
  },
}));
vi.mock("@/server/audit", () => ({ recordAudit: async () => {} }));
vi.mock("@/lib/email", () => ({ sendMail: async () => {} }));
// The notification dispatcher resolves deep-link bases from validated env.
vi.mock("@/lib/env", () => ({ env: { AUTH_URL: "https://portal.nexclub.com.au" } }));
// Provide the enum objects the zod validators need at import time, without
// booting the Prisma engine (unavailable in this sandbox).
vi.mock("@prisma/client", () => ({
  LeadStatus: { NEW: "NEW", CONTACTED: "CONTACTED", IN_PROGRESS: "IN_PROGRESS", CLOSED_WON: "CLOSED_WON", CLOSED_LOST: "CLOSED_LOST" },
  SentLeadStatus: { SENT: "SENT", VIEWED: "VIEWED", RESPONDED: "RESPONDED", CONVERTED: "CONVERTED", CLOSED: "CLOSED" },
  LeadSource: { REFERRAL: "REFERRAL", WEBSITE: "WEBSITE", COLD_OUTREACH: "COLD_OUTREACH", EVENT: "EVENT", SOCIAL: "SOCIAL", OTHER: "OTHER" },
  LeadPriority: { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", NEEDED_YESTERDAY: "NEEDED_YESTERDAY" },
  Prisma: {},
}));

// Import the real handlers AFTER the mocks are registered.
import { POST as postComment } from "@/app/api/leads/[id]/comments/route";
import { GET as getDetail } from "@/app/api/leads/[id]/sent-detail/route";
import { PATCH as patchStatus } from "@/app/api/leads/[id]/status/route";
import { PATCH as patchLead } from "@/app/api/leads/[id]/route";
import { PATCH as patchRevenue } from "@/app/api/leads/[id]/revenue/route";

const SENDER = { id: "u_sender", organizationId: "org1", name: "Sam Sender", role: "SALES_REP", email: "sam@club.co" };
const RECEIVER = { id: "u_receiver", organizationId: "org1", name: "Rita Receiver", role: "SALES_REP", email: "rita@club.co" };

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const body = (payload: unknown) =>
  new Request("http://test/lead", { method: "POST", body: JSON.stringify(payload), headers: { "content-type": "application/json" } });
const readDetail = async (leadId: string) => (await getDetail(new Request("http://test/lead"), ctx(leadId)))!.json();

function seed() {
  h.users[SENDER.id] = SENDER;
  h.users[RECEIVER.id] = RECEIVER;
  h.leads["lead1"] = {
    id: "lead1",
    organizationId: "org1",
    referrerId: SENDER.id, // sender
    ownerId: RECEIVER.id, // receiver
    contactName: "Greg Client",
    company: "Acme Pty",
    phone: "0400 000 000",
    email: "greg@acme.co",
    industry: "Construction",
    valueEstimate: null,
    status: "NEW", // receiver pipeline axis
    sentStatus: "SENT", // sender lifecycle axis
    source: "REFERRAL",
    notes: "Warm intro",
    priority: "LOW",
    dateReceived: new Date("2026-01-10T00:00:00Z"),
    followUpDate: null,
    lastActivityAt: new Date("2026-01-10T00:00:00Z"),
    boardPosition: 0,
    deletedAt: null,
  };
}

beforeEach(() => {
  h.reset();
  seed();
});

describe("a lead is one shared entity across the sender and receiver views", () => {
  it("(a) a comment posted by the sender appears on the receiver's lead, and vice versa", async () => {
    // Sender writes to the thread.
    h.setUser(SENDER);
    expect((await postComment(body({ body: "Sender: he's expecting your call." }), ctx("lead1")))!.status).toBe(201);

    // Receiver reads the SAME thread and sees the sender's comment, author preserved.
    h.setUser(RECEIVER);
    let detail = await readDetail("lead1");
    const fromSender = detail.comments.find((c: any) => c.body === "Sender: he's expecting your call.");
    expect(fromSender).toBeTruthy();
    expect(fromSender.authorId).toBe(SENDER.id);
    expect(fromSender.authorName).toBe(SENDER.name);

    // Receiver writes to the same thread.
    expect((await postComment(body({ body: "Receiver: got it, calling now." }), ctx("lead1")))!.status).toBe(201);

    // Sender reads the same thread: both comments, identical order + identity on both sides.
    h.setUser(SENDER);
    detail = await readDetail("lead1");
    expect(detail.comments.map((c: any) => c.body)).toEqual([
      "Sender: he's expecting your call.",
      "Receiver: got it, calling now.",
    ]);
    expect(detail.comments.map((c: any) => c.authorId)).toEqual([SENDER.id, RECEIVER.id]);
    // Exactly one shared thread — no duplicate/per-user records.
    expect(h.notes.filter((n) => n.leadId === "lead1")).toHaveLength(2);
  });

  it("(b) a stage change made by the receiver is reflected in the sender's view of the same lead", async () => {
    // Receiver advances the lead in their pipeline.
    h.setUser(RECEIVER);
    const res = await patchStatus(body({ status: "CONTACTED", boardPosition: 0 }), ctx("lead1"));
    expect(res!.status).toBe(200);

    // Sender's view of the same lead shows the receiver's new pipeline stage
    // (surfaced as "Recipient's pipeline"). Same underlying `status` field.
    h.setUser(SENDER);
    const detail = await readDetail("lead1");
    expect(detail.lead.status).toBe("CONTACTED");
    expect(h.leads["lead1"].status).toBe("CONTACTED"); // one canonical row mutated
  });

  it("(c) an edit to a shared lead field propagates to the other party's view (both directions)", async () => {
    // Receiver edits a shared detail field; sender reads it back.
    h.setUser(RECEIVER);
    expect((await patchLead(body({ notes: "Met on site — needs equipment finance." }), ctx("lead1")))!.status).toBe(200);

    h.setUser(SENDER);
    let detail = await readDetail("lead1");
    expect(detail.lead.notes).toBe("Met on site — needs equipment finance.");

    // Sender edits a shared field (deal value); receiver reads it back.
    expect((await patchRevenue(body({ valueEstimate: 42000 }), ctx("lead1")))!.status).toBe(200);

    h.setUser(RECEIVER);
    detail = await readDetail("lead1");
    expect(detail.lead.valueEstimate).toBe(42000);
    expect(h.leads["lead1"].valueEstimate).toBe(42000); // same canonical row
  });

  it("permissions are preserved: a party cannot use a route they aren't authorized for", async () => {
    // Only the receiver (owner) may change the pipeline stage; the sender cannot.
    h.setUser(SENDER);
    expect((await patchStatus(body({ status: "CONTACTED", boardPosition: 0 }), ctx("lead1")))!.status).toBe(403);
    // Only the owner may edit detail fields; the sender is limited to reassign.
    expect((await patchLead(body({ notes: "sender should not edit this" }), ctx("lead1")))!.status).toBe(403);
    expect(h.leads["lead1"].status).toBe("NEW");
    expect(h.leads["lead1"].notes).toBe("Warm intro");
  });
});
