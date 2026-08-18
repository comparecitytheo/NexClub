/**
 * Seed data for NexLink.
 *
 * Run with:  npm run db:seed   (or it runs automatically after db:reset)
 *
 * Demonstrates the club lead-sharing flow: every lead has a referrer (the
 * member who sent it) and an owner (the member it landed with).
 *
 * All demo accounts use the password:  Password123!
 */
import { PrismaClient, UserRole, LeadStatus, LeadSource, DealStage, ContactStatus, ActivityType, TaskPriority, TaskStatus, NotificationType, EntityType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ORG_SLUG = "valet-club";
const DEMO_PASSWORD = "Password123!";

const day = 24 * 60 * 60 * 1000;
const daysFromNow = (n: number) => new Date(Date.now() + n * day);
const daysAgo = (n: number) => new Date(Date.now() - n * day);

async function main() {
  // Clean slate. Deleting the org cascades to every child record.
  // The seed WIPES this organization (cascading to every lead, member and note)
  // and replaces it with demo data. Never let that happen against production.
  //
  // This used to key on NODE_ENV === "production", which is the WRONG SIGNAL:
  // NODE_ENV is "development" whenever you run a script locally, and DEPLOY.md
  // explicitly tells the operator to run release commands "locally with your env
  // pointed at production". In that shell the old guard stayed silent and this
  // would have wiped the live club.
  //
  // Key on the database actually being addressed instead. Anything that is not
  // plainly a local host has to be unlocked deliberately.
  const dbUrl = process.env.DATABASE_URL ?? "";
  const isLocalDb = /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal|postgres|db)[:/]/.test(dbUrl);
  if (!isLocalDb && !process.env.ALLOW_DESTRUCTIVE_SEED) {
    throw new Error(
      "Refusing to seed: DATABASE_URL does not point at a local database, and this seed " +
        "DELETES the club organization and everything cascading from it — every lead, member, " +
        "note and audit row.\n" +
        "Use `npm run bootstrap` to create the first admin on a real database instead.\n" +
        "Set ALLOW_DESTRUCTIVE_SEED=1 only if you are certain this is a throwaway database."
    );
  }

  await prisma.organization.deleteMany({ where: { slug: ORG_SLUG } });

  const org = await prisma.organization.create({
    data: { name: "NexLink", slug: ORG_SLUG },
  });

  // ---- Permissions (granular grants layered on top of roles) ----
  const exportPerm = await prisma.permission.upsert({
    where: { key: "leads.export" },
    update: {},
    create: { key: "leads.export", description: "Export leads to CSV" },
  });
  await prisma.permission.upsert({
    where: { key: "audit.read" },
    update: {},
    create: { key: "audit.read", description: "Read the audit log" },
  });

  // ---- Members ----
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 10);
  const mk = (
    name: string,
    email: string,
    role: UserRole,
    businessName: string,
    industry: string,
    phone: string
  ) =>
    prisma.user.create({
      data: {
        organizationId: org.id,
        name,
        email,
        hashedPassword: hashed,
        emailVerified: new Date(),
        role,
        businessName,
        industry,
        phone,
        avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`,
      },
    });

  const operator = await mk("Club Operator", "owner@valetcrm.test", UserRole.SUPER_ADMIN, "NexLink", "Finance", "+61 400 000 001");
  const admin = await mk("Theo Admin", "admin@valetcrm.test", UserRole.ADMIN, "NexLink", "Commercial Finance", "+61 400 000 002");
  const priya = await mk("Priya Nair", "priya@valetcrm.test", UserRole.MANAGER, "Nair Accounting", "Accounting", "+61 400 000 003");
  const marcus = await mk("Marcus Lee", "marcus@valetcrm.test", UserRole.SALES_REP, "Lee Mortgage Group", "Mortgage Broking", "+61 400 000 004");
  const sophie = await mk("Sophie Tran", "sophie@valetcrm.test", UserRole.SALES_REP, "Tran Legal", "Legal", "+61 400 000 005");
  const daniel = await mk("Daniel Cohen", "daniel@valetcrm.test", UserRole.SUPPORT_AGENT, "Cohen Insurance", "Insurance", "+61 400 000 006");

  const members = { operator, admin, priya, marcus, sophie, daniel };

  // Grant Marcus the export permission on top of his SALES_REP role.
  await prisma.userPermission.create({
    data: { userId: marcus.id, permissionId: exportPerm.id },
  });

  // ---- Team ----
  const team = await prisma.team.create({
    data: { organizationId: org.id, name: "Hills Shire Chapter", description: "NSW Hills Shire referral chapter" },
  });
  await prisma.teamMembership.createMany({
    data: [
      { teamId: team.id, userId: priya.id, isLead: true },
      { teamId: team.id, userId: marcus.id },
      { teamId: team.id, userId: sophie.id },
      { teamId: team.id, userId: daniel.id },
    ],
  });

  // ---- Companies ----
  const acme = await prisma.company.create({
    data: { organizationId: org.id, ownerId: priya.id, name: "Acme Logistics Pty Ltd", industry: "Transport", website: "https://acmelogistics.com.au", employeeCount: 45, revenue: 8500000, address: "12 Old Northern Rd, Baulkham Hills NSW" },
  });
  const harbour = await prisma.company.create({
    data: { organizationId: org.id, ownerId: marcus.id, name: "Harbour Cafe Group", industry: "Hospitality", website: "https://harbourcafe.com.au", employeeCount: 22, revenue: 3200000, address: "5 Windsor Rd, Kellyville NSW" },
  });
  await prisma.company.create({
    data: { organizationId: org.id, ownerId: sophie.id, name: "Summit Constructions", industry: "Construction", employeeCount: 70, revenue: 15000000, address: "88 Showground Rd, Castle Hill NSW" },
  });

  // ---- Contacts ----
  const johnAcme = await prisma.contact.create({
    data: { organizationId: org.id, ownerId: priya.id, companyId: acme.id, firstName: "John", lastName: "Whitfield", email: "john@acmelogistics.com.au", phone: "+61 400 111 222", jobTitle: "Managing Director", tags: ["decision-maker", "transport"], status: ContactStatus.CUSTOMER },
  });
  await prisma.contact.create({
    data: { organizationId: org.id, ownerId: marcus.id, companyId: harbour.id, firstName: "Elena", lastName: "Rossi", email: "elena@harbourcafe.com.au", phone: "+61 400 333 444", jobTitle: "Owner", tags: ["hospitality"], status: ContactStatus.ACTIVE },
  });
  await prisma.contact.create({
    data: { organizationId: org.id, ownerId: sophie.id, firstName: "Raj", lastName: "Patel", email: "raj@summitconstructions.com.au", phone: "+61 400 555 666", jobTitle: "CFO", tags: ["construction", "finance"], status: ContactStatus.LEAD },
  });

  // ---- Leads: the send/receive flow ----
  // [contactName, company, referrer, owner, status, value, followUpInDays|null, lastActivityDaysAgo, score, pos]
  type LeadSpec = [string, string, keyof typeof members, keyof typeof members, LeadStatus, number, number | null, number, number, number];
  const leadSpecs: LeadSpec[] = [
    ["Greg Hamilton", "Hamilton Plumbing", "priya", "marcus", LeadStatus.NEW, 25000, 0, 0, 30, 0],
    ["Nina Okafor", "Okafor Dental", "marcus", "priya", LeadStatus.CONTACTED, 40000, 2, 1, 55, 0],
    ["Tom Becker", "Becker Freight", "sophie", "daniel", LeadStatus.IN_PROGRESS, 120000, 5, 9, 70, 0],
    ["Aisha Khan", "Khan Childcare", "daniel", "sophie", LeadStatus.NEW, 18000, null, 0, 20, 0],
    ["Liam Murphy", "Murphy Electrical", "priya", "sophie", LeadStatus.IN_PROGRESS, 65000, 3, 2, 80, 1],
    ["Chloe Davis", "Davis Physio", "marcus", "daniel", LeadStatus.NEW, 22000, 0, 0, 35, 1],
    ["Ben Carter", "Carter Joinery", "sophie", "priya", LeadStatus.CONTACTED, 48000, 4, 8, 50, 1],
    ["Maria Lopez", "Lopez Bakery", "admin", "marcus", LeadStatus.NEW, 30000, 1, 0, 40, 1],
    ["Oscar Reed", "Reed Mechanical", "daniel", "priya", LeadStatus.CLOSED_WON, 90000, null, 3, 95, 0],
    ["Hannah Scott", "Scott Bookkeeping", "priya", "daniel", LeadStatus.CONTACTED, 15000, 6, 1, 45, 2],
    ["Felix Wong", "Wong Architecture", "marcus", "sophie", LeadStatus.IN_PROGRESS, 75000, 2, 4, 65, 2],
    ["Ivy Bennett", "Bennett Salon", "sophie", "marcus", LeadStatus.NEW, 12000, null, 0, 25, 2],
  ];

  const leads = [];
  for (const [contactName, company, refKey, ownKey, status, value, followUp, lastAct, , pos] of leadSpecs) {
    const lead = await prisma.lead.create({
      data: {
        organizationId: org.id,
        referrerId: members[refKey].id,
        ownerId: members[ownKey].id,
        contactName,
        company,
        email: `${contactName.split(" ")[0].toLowerCase()}@example.com`,
        phone: "+61 400 000 999",
        industry: "Small Business",
        valueEstimate: value,
        status,
        source: LeadSource.REFERRAL,
        followUpDate: followUp === null ? null : daysFromNow(followUp),
        lastActivityAt: daysAgo(lastAct),
        boardPosition: pos,
        notes: `Referred by ${members[refKey].name}.`,
      },
    });
    leads.push(lead);
  }

  // ---- Deal converted from the CLOSED_WON lead (Oscar Reed -> Priya) ----
  const wonLead = leads[8];
  const wonDeal = await prisma.deal.create({
    data: {
      organizationId: org.id,
      ownerId: priya.id,
      companyId: acme.id,
      contactId: johnAcme.id,
      leadId: wonLead.id,
      name: "Reed Mechanical — equipment finance",
      value: 90000,
      stage: DealStage.CLOSED_WON,
      probability: 100,
      expectedCloseDate: daysAgo(2),
      closedAt: daysAgo(2),
      isWon: true,
      boardPosition: 0,
    },
  });
  await prisma.lead.update({
    where: { id: wonLead.id },
    data: { convertedDealId: wonDeal.id, convertedContactId: johnAcme.id, convertedAt: daysAgo(2) },
  });

  // A second, in-flight deal.
  await prisma.deal.create({
    data: {
      organizationId: org.id,
      ownerId: marcus.id,
      companyId: harbour.id,
      name: "Harbour Cafe — fit-out loan",
      value: 55000,
      stage: DealStage.NEGOTIATION,
      probability: 60,
      expectedCloseDate: daysFromNow(14),
      boardPosition: 0,
    },
  });

  // ---- Tasks (overdue / due today / upcoming / completed) ----
  await prisma.task.create({
    data: { organizationId: org.id, creatorId: priya.id, assigneeId: marcus.id, title: "Call Greg Hamilton to qualify", dueDate: daysAgo(2), priority: TaskPriority.HIGH, status: TaskStatus.OPEN, entityType: EntityType.LEAD, leadId: leads[0].id },
  });
  await prisma.task.create({
    data: { organizationId: org.id, creatorId: admin.id, assigneeId: priya.id, title: "Send proposal to Nina Okafor", dueDate: daysFromNow(0), priority: TaskPriority.MEDIUM, status: TaskStatus.IN_PROGRESS, entityType: EntityType.LEAD, leadId: leads[1].id },
  });
  await prisma.task.create({
    data: { organizationId: org.id, creatorId: sophie.id, assigneeId: sophie.id, title: "Prepare meeting deck for Felix Wong", dueDate: daysFromNow(3), priority: TaskPriority.MEDIUM, status: TaskStatus.OPEN, entityType: EntityType.LEAD, leadId: leads[10].id },
  });
  await prisma.task.create({
    data: { organizationId: org.id, creatorId: priya.id, assigneeId: priya.id, title: "Finalise Reed Mechanical settlement", dueDate: daysAgo(3), priority: TaskPriority.HIGH, status: TaskStatus.COMPLETED, completedAt: daysAgo(2), entityType: EntityType.DEAL, dealId: wonDeal.id },
  });

  // ---- Notes (one with an @mention) ----
  await prisma.note.create({
    data: {
      organizationId: org.id,
      authorId: marcus.id,
      body: "<p>Spoke with Greg — keen on a chattel mortgage for two vans. Wants numbers by Friday. cc @Priya Nair</p>",
      entityType: EntityType.LEAD,
      leadId: leads[0].id,
      mentions: { connect: [{ id: priya.id }] },
    },
  });
  await prisma.note.create({
    data: {
      organizationId: org.id,
      authorId: priya.id,
      body: "<p>Settlement complete. Great referral from Daniel.</p>",
      entityType: EntityType.DEAL,
      dealId: wonDeal.id,
    },
  });

  // ---- Activities ----
  await prisma.activity.create({
    data: { organizationId: org.id, userId: marcus.id, type: ActivityType.CALL, subject: "Intro call with Greg Hamilton", body: "10 min discovery call.", occurredAt: daysAgo(0), entityType: EntityType.LEAD, leadId: leads[0].id },
  });
  await prisma.activity.create({
    data: { organizationId: org.id, userId: daniel.id, type: ActivityType.MEETING, subject: "Site meeting — Becker Freight", occurredAt: daysAgo(9), entityType: EntityType.LEAD, leadId: leads[2].id },
  });
  await prisma.activity.create({
    data: { organizationId: org.id, userId: priya.id, type: ActivityType.EMAIL, subject: "Sent settlement confirmation", occurredAt: daysAgo(2), entityType: EntityType.DEAL, dealId: wonDeal.id },
  });

  // ---- Notifications ----
  await prisma.notification.createMany({
    data: [
      { organizationId: org.id, recipientId: marcus.id, actorId: priya.id, type: NotificationType.LEAD_ASSIGNED, title: "New lead from Priya Nair", body: "Greg Hamilton — Hamilton Plumbing", entityType: EntityType.LEAD, entityId: leads[0].id },
      { organizationId: org.id, recipientId: priya.id, actorId: marcus.id, type: NotificationType.MENTIONED_IN_NOTE, title: "Marcus Lee mentioned you", body: "On the Greg Hamilton lead", entityType: EntityType.LEAD, entityId: leads[0].id },
      { organizationId: org.id, recipientId: marcus.id, actorId: priya.id, type: NotificationType.TASK_ASSIGNED, title: "Task assigned", body: "Call Greg Hamilton to qualify", isRead: false, entityType: EntityType.LEAD, entityId: leads[0].id },
    ],
  });

  const counts = {
    organizations: 1,
    users: 6,
    teams: 1,
    companies: 3,
    contacts: 3,
    leads: leads.length,
    deals: 2,
  };
  console.log("Seed complete:", counts);
  console.log("\nDemo accounts (password for all: %s)", DEMO_PASSWORD);
  console.table([
    { role: "SUPER_ADMIN", email: "owner@valetcrm.test" },
    { role: "ADMIN", email: "admin@valetcrm.test" },
    { role: "MANAGER", email: "priya@valetcrm.test" },
    { role: "SALES_REP", email: "marcus@valetcrm.test" },
    { role: "SALES_REP", email: "sophie@valetcrm.test" },
    { role: "SUPPORT_AGENT", email: "daniel@valetcrm.test" },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
