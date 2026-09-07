import { describe, it, expect, vi, beforeEach } from "vitest";

// The dispatcher talks to Prisma, SMTP and validated env at import time, so those
// boundaries are mocked and the real fan-out logic is exercised against them.
const mocks = vi.hoisted(() => ({
  createMany: vi.fn(),
  findMany: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: { AUTH_URL: "https://app.example.com", AUTH_SECRET: "test-secret-for-unsubscribe-links" },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: { createMany: mocks.createMany },
    user: { findMany: mocks.findMany },
  },
}));
vi.mock("@/lib/email", () => ({ sendMail: mocks.sendMail }));

import {
  notify,
  dedupeRecipients,
  canEmail,
  buildNotificationEmail,
  appUrl,
  escapeHtml,
} from "@/server/notify";

const emailable = (id: string, name: string) => ({
  id,
  name,
  email: `${id}@example.com`,
  isActive: true,
  deletedAt: null,
  emailNotificationsEnabled: true,
});

/** Let the fire-and-forget email fan-out settle. */
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  mocks.createMany.mockReset().mockResolvedValue({ count: 1 });
  mocks.findMany.mockReset().mockResolvedValue([]);
  mocks.sendMail.mockReset().mockResolvedValue(undefined);
});

describe("dedupeRecipients", () => {
  it("removes the actor so nobody is notified of their own action", () => {
    expect(dedupeRecipients(["referrer", "owner"], "referrer")).toEqual(["owner"]);
  });
  it("collapses duplicates so one user is only notified once", () => {
    expect(dedupeRecipients(["u1", "u1", "u2"], null)).toEqual(["u1", "u2"]);
  });
  it("keeps both lead parties when a third party (admin) is the actor", () => {
    expect(dedupeRecipients(["referrer", "owner"], "admin")).toEqual(["referrer", "owner"]);
  });
  it("ignores null/undefined ids", () => {
    expect(dedupeRecipients([null, undefined, "u1"], null)).toEqual(["u1"]);
  });
});

describe("canEmail", () => {
  // hashedPassword stands in for "they opened the invitation and set a password",
  // which canEmail now requires as proof the address is really theirs.
  const base = {
    email: "a@b.com",
    isActive: true,
    deletedAt: null,
    emailNotificationsEnabled: true,
    hashedPassword: "hashed",
  };
  it("allows an active user with an address and the preference on", () => {
    expect(canEmail(base)).toBe(true);
  });
  it("skips users who turned email notifications off", () => {
    expect(canEmail({ ...base, emailNotificationsEnabled: false })).toBe(false);
  });
  it("skips users with no email address", () => {
    expect(canEmail({ ...base, email: null })).toBe(false);
  });
  it("skips invited accounts that never set a password", () => {
    // An invitation goes to an address we cannot yet prove belongs to them.
    expect(canEmail({ ...base, hashedPassword: null })).toBe(false);
  });
  it("skips deactivated and deleted users", () => {
    expect(canEmail({ ...base, isActive: false })).toBe(false);
    expect(canEmail({ ...base, deletedAt: new Date() })).toBe(false);
  });
});

describe("buildNotificationEmail", () => {
  const href = "https://app.example.com/leads/l1";

  it("gives each event its own subject and context", () => {
    expect(
      buildNotificationEmail("TASK_ASSIGNED", { taskTitle: "Call Priya" }, href).subject
    ).toContain("Call Priya");

    expect(
      buildNotificationEmail("LEAD_ASSIGNED", { actorName: "Dan", leadName: "Acme" }, href).subject
    ).toContain("Acme");

    const stage = buildNotificationEmail(
      "LEAD_STATUS_CHANGE",
      { actorName: "Dan", leadName: "Acme", fromStage: "New", toStage: "Won" },
      href
    );
    expect(stage.subject).toContain("Won");
    expect(stage.html).toContain("New");
    expect(stage.html).toContain("Won");

    const comment = buildNotificationEmail(
      "LEAD_COMMENT",
      { actorName: "Dan", leadName: "Acme", excerpt: "ready to sign" },
      href
    );
    expect(comment.subject).toContain("Dan");
    expect(comment.html).toContain("ready to sign");

    expect(
      buildNotificationEmail("MENTIONED_IN_NOTE", { actorName: "Dan", leadName: "Acme" }, href)
        .subject
    ).toContain("mentioned you");
  });

  it("always includes a deep link back to the right screen", () => {
    for (const type of ["TASK_ASSIGNED", "LEAD_ASSIGNED", "LEAD_COMMENT"] as const) {
      expect(buildNotificationEmail(type, {}, href).html).toContain(href);
    }
  });

  it("escapes user-supplied text so comments cannot inject markup", () => {
    const { html } = buildNotificationEmail(
      "LEAD_COMMENT",
      { actorName: "Dan", leadName: "Acme", excerpt: "<script>alert(1)</script>" },
      href
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("appUrl / escapeHtml", () => {
  it("builds absolute links from the configured base", () => {
    expect(appUrl("/leads/l1")).toBe("https://app.example.com/leads/l1");
  });
  it("escapes the HTML metacharacters", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});

describe("notify — in-app and email fan out together", () => {
  it("creates the in-app row and emails the same user", async () => {
    mocks.findMany.mockResolvedValue([emailable("owner", "Olivia")]);

    const notified = await notify({
      organizationId: "org1",
      recipientIds: ["owner"],
      actorId: "referrer",
      type: "LEAD_ASSIGNED",
      title: "New lead received",
      entityType: "LEAD",
      entityId: "l1",
      email: { actorName: "Dan", leadName: "Acme" },
    });
    await flush();

    expect(notified).toEqual(["owner"]);
    expect(mocks.createMany).toHaveBeenCalledTimes(1);
    const rows = mocks.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ recipientId: "owner", type: "LEAD_ASSIGNED", actorId: "referrer" });

    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    const mail = mocks.sendMail.mock.calls[0][0];
    expect(mail.to).toBe("owner@example.com");
    expect(mail.subject).toContain("Acme");
    expect(mail.html).toContain("https://app.example.com/leads/l1");
  });

  it.each([
    ["LEAD_ASSIGNED", { leadName: "Acme" }],
    ["LEAD_STATUS_CHANGE", { leadName: "Acme", toStage: "Won" }],
    ["LEAD_COMMENT", { leadName: "Acme", excerpt: "hi" }],
    ["MENTIONED_IN_NOTE", { leadName: "Acme", excerpt: "hi" }],
  ] as const)("emails as well as notifies for %s", async (type, ctx) => {
    mocks.findMany.mockResolvedValue([emailable("u1", "Uma")]);

    await notify({
      organizationId: "org1",
      recipientIds: ["u1"],
      actorId: "actor",
      type,
      title: "t",
      entityType: "LEAD",
      entityId: "l1",
      email: { actorName: "Dan", ...ctx },
    });
    await flush();

    expect(mocks.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.createMany.mock.calls[0][0].data[0].type).toBe(type);
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
  });

  /**
   * Tasks are worked inside the CRM, and the club asked for no task mail to
   * anyone — creator or assignee. The bell still lights up; only the email is
   * suppressed.
   */
  it.each(["TASK_ASSIGNED", "TASK_OVERDUE", "TASK_DUE_TODAY"] as const)(
    "notifies in-app but sends no email for %s",
    async (type) => {
      mocks.findMany.mockResolvedValue([emailable("u1", "Uma")]);

      await notify({
        organizationId: "org1",
        recipientIds: ["u1"],
        actorId: "actor",
        type,
        title: "t",
        entityType: "LEAD",
        entityId: "l1",
        email: { actorName: "Dan", taskTitle: "Call Priya" },
      });
      await flush();

      expect(mocks.createMany).toHaveBeenCalledTimes(1);
      expect(mocks.createMany.mock.calls[0][0].data[0].type).toBe(type);
      expect(mocks.sendMail).not.toHaveBeenCalled();
    }
  );

  it("includes a working unsubscribe link and identifies the sender", async () => {
    mocks.findMany.mockResolvedValue([emailable("owner", "Olivia")]);

    await notify({
      organizationId: "org1",
      recipientIds: ["owner"],
      actorId: "actor",
      type: "LEAD_COMMENT",
      title: "t",
      entityType: "LEAD",
      entityId: "l1",
    });
    await flush();

    const html = mocks.sendMail.mock.calls[0][0].html as string;
    expect(html).toContain("/api/notifications/unsubscribe?u=owner&t=");
    expect(html).toContain("Unsubscribe");
    expect(html).toContain("Sent by NEX Club");
  });

  it("notifies both lead parties when an admin comments (symmetric visibility)", async () => {
    mocks.findMany.mockResolvedValue([emailable("referrer", "Rita"), emailable("owner", "Olivia")]);

    const notified = await notify({
      organizationId: "org1",
      recipientIds: ["referrer", "owner"],
      actorId: "admin",
      type: "LEAD_COMMENT",
      title: "Admin commented",
      entityType: "LEAD",
      entityId: "l1",
    });
    await flush();

    expect(notified).toEqual(["referrer", "owner"]);
    expect(mocks.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
  });

  it("does not notify or email the comment author about their own comment", async () => {
    mocks.findMany.mockResolvedValue([emailable("owner", "Olivia")]);

    const notified = await notify({
      organizationId: "org1",
      recipientIds: ["referrer", "owner"],
      actorId: "referrer", // the author is one of the two parties
      type: "LEAD_COMMENT",
      title: "Rita commented",
      entityType: "LEAD",
      entityId: "l1",
    });
    await flush();

    expect(notified).toEqual(["owner"]);
    const rows = mocks.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { recipientId: string }) => r.recipientId)).not.toContain("referrer");
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail.mock.calls[0][0].to).toBe("owner@example.com");
  });

  it("sends one email when a user qualifies for the same event twice", async () => {
    mocks.findMany.mockResolvedValue([emailable("u1", "Uma")]);

    await notify({
      organizationId: "org1",
      recipientIds: ["u1", "u1"], // e.g. referrer and owner are the same member
      actorId: "actor",
      type: "LEAD_COMMENT",
      title: "t",
      entityType: "LEAD",
      entityId: "l1",
    });
    await flush();

    expect(mocks.createMany.mock.calls[0][0].data).toHaveLength(1);
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
  });

  it("still creates the in-app row but sends no email when the user disabled email", async () => {
    mocks.findMany.mockResolvedValue([
      { ...emailable("u1", "Uma"), emailNotificationsEnabled: false },
    ]);

    await notify({
      organizationId: "org1",
      recipientIds: ["u1"],
      actorId: "actor",
      type: "LEAD_COMMENT",
      title: "t",
      entityType: "LEAD",
      entityId: "l1",
    });
    await flush();

    expect(mocks.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("skips users with no address and emails only the eligible ones", async () => {
    mocks.findMany.mockResolvedValue([
      { ...emailable("u1", "Uma"), email: null },
      emailable("u2", "Ben"),
    ]);

    await notify({
      organizationId: "org1",
      recipientIds: ["u1", "u2"],
      actorId: "actor",
      type: "LEAD_ASSIGNED",
      title: "t",
      entityType: "LEAD",
      entityId: "l1",
    });
    await flush();

    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail.mock.calls[0][0].to).toBe("u2@example.com");
  });

  it("does nothing when the only recipient is the actor", async () => {
    const notified = await notify({
      organizationId: "org1",
      recipientIds: ["actor"],
      actorId: "actor",
      type: "LEAD_COMMENT",
      title: "t",
    });
    await flush();

    expect(notified).toEqual([]);
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("a failing SMTP send never breaks notification creation", async () => {
    mocks.findMany.mockResolvedValue([emailable("u1", "Uma")]);
    mocks.sendMail.mockRejectedValue(new Error("SMTP down"));

    await expect(
      notify({
        organizationId: "org1",
        recipientIds: ["u1"],
        actorId: "actor",
        type: "LEAD_COMMENT",
        title: "t",
        entityType: "LEAD",
        entityId: "l1",
      })
    ).resolves.toEqual(["u1"]);
    await flush();

    expect(mocks.createMany).toHaveBeenCalledTimes(1);
  });
});
