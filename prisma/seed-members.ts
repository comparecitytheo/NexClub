/**
 * CLUB MEMBER SEED
 *
 * Creates the founding NexClub member accounts from the club's roster, all with
 * the same starting password. Members are expected to change it themselves via
 * "Reset password" on the login page (which emails a one-hour link) — so treat
 * the shared password as a handover credential, not a permanent one.
 *
 * Safe to run against production:
 *   - it upserts by email, so re-running never duplicates anyone,
 *   - it never deletes or deactivates anything (unlike prisma/seed.ts, which
 *     wipes and reseeds demo data),
 *   - by default it only sets a password on accounts it CREATES, so re-running
 *     will not clobber a password a member has already changed.
 *
 * Usage (from the project root, with DATABASE_URL set):
 *
 *   MEMBER_PASSWORD="the-shared-starting-password" npm run seed:members
 *
 * To deliberately reset EVERY listed member back to the shared password
 * (e.g. a second handover after people have already logged in):
 *
 *   MEMBER_PASSWORD="..." RESET_EXISTING_PASSWORDS=true npm run seed:members
 */
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type Member = {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  industry: string;
  role: UserRole;
};

// The club roster, in the order supplied. Everyone is ADMIN except the three
// Compare City principals, who are SUPER_ADMIN.
//
// Where two people share one mailbox, both rows carry the same email. Postgres
// enforces `User.email` as unique, so those pairs necessarily collapse into a
// single shared login — see the grouping step in main().
const ROSTER: Member[] = [
  { name: "Michael Saba",         email: "cbdbuild@bigpond.net.au",              phone: "0418446968", businessName: "CBD Building and Demo",                        industry: "Building",                     role: UserRole.ADMIN },
  { name: "Jordan Saba",          email: "cbdbuild@bigpond.net.au",              phone: "0477779247", businessName: "CBD Building and Demo",                        industry: "Building",                     role: UserRole.ADMIN },
  { name: "Matthew Austin",       email: "matt@cchservices.com.au",              phone: "0448848830", businessName: "CCHServices",                                  industry: "Air Con",                      role: UserRole.ADMIN },
  { name: "John Karagiorgis",     email: "jkaragiorgos@darleyca.com",            phone: "0410650097", businessName: "Darley and Co",                                industry: "Accountant",                   role: UserRole.ADMIN },
  { name: "Simone Spanos",        email: "billcoles@commercialcleaning.com.au",  phone: "0406898229", businessName: "Commercial Cleaning and Caretaking Services",   industry: "Strata Building Maintenance",  role: UserRole.ADMIN },
  { name: "Bill Collaros",        email: "billcoles@commercialcleaning.com.au",  phone: "0418247041", businessName: "Commercial Cleaning and Caretaking Services",   industry: "Strata Building Maintenance",  role: UserRole.ADMIN },
  { name: "Ray Regmi",            email: "ray@rykercapital.com.au",              phone: "0411331142", businessName: "Ryker Capital",                                industry: "Financial Planning",           role: UserRole.ADMIN },
  { name: "Liam Montgomery",      email: "liam@konectix.com.au",                 phone: "0412881360", businessName: "Konextix",                                     industry: "Electrician",                  role: UserRole.ADMIN },
  { name: "Hayden Waititi-Parata", email: "hayden@simplehomebuyers.com.au",      phone: "0475472243", businessName: "Simple Home Buyers",                           industry: "Buyers Agent",                 role: UserRole.ADMIN },
  { name: "Adam",                 email: "adam@newwave-plumbing.com.au",         phone: "0422312570", businessName: "New Wave Plumbing",                            industry: "Plumber",                      role: UserRole.ADMIN },
  { name: "Hass Hoballah",        email: "hassan@pinpointphysiotherapy.com.au",  phone: "0434287198", businessName: "Pinpoint Physiotherapy",                       industry: "Physio",                       role: UserRole.ADMIN },
  { name: "Mo Chokr",             email: "m.chokr@doorkeeperlegal.com.au",       phone: "0415903000", businessName: "Door Keeper Legal",                            industry: "Lawyer",                       role: UserRole.ADMIN },
  { name: "Marko Bratkovic",      email: "admin@elkoprojects.com.au",            phone: "0430646447", businessName: "Elko Projects",                                industry: "Builders",                     role: UserRole.ADMIN },
  { name: "Elias",                email: "admin@elkoprojects.com.au",            phone: "0423334792", businessName: "Elko Projects",                                industry: "Builders",                     role: UserRole.ADMIN },
  { name: "Andrew Adams",         email: "andrew@comparecity.com.au",            phone: "0449996469", businessName: "Compare City",                                 industry: "Mortgage Broker",              role: UserRole.SUPER_ADMIN },
  { name: "Theo Laspatzis",       email: "theo@comparecity.com.au",              phone: "0499999974", businessName: "Compare City",                                 industry: "Asset Broker",                 role: UserRole.SUPER_ADMIN },
  { name: "Robbie Raycic",        email: "robbie@comparecity.com.au",            phone: "0424423911", businessName: "Compare City",                                 industry: "Asset Broker",                 role: UserRole.SUPER_ADMIN },
  { name: "Shaun Ramani",         email: "shaunramani@stonerealestate.com.au",   phone: "0417444919", businessName: "Stone Real Estate",                            industry: "Real Estate Agent",            role: UserRole.ADMIN },
  // Supplied as 410658055 — a spreadsheet numeric cell dropping the leading 0.
  { name: "William Giardini",     email: "stickysignz@outlook.com",              phone: "0410658055", businessName: "Sticky Signz",                                 industry: "Business Creatives",           role: UserRole.ADMIN },
];

/**
 * Collapse roster rows onto one entry per email address. Two people sharing a
 * mailbox get one login named for both of them, so the member directory still
 * shows who is behind the account.
 */
function groupByEmail(roster: Member[]): { members: Member[]; shared: Member[][] } {
  const byEmail = new Map<string, Member[]>();
  for (const m of roster) {
    const key = m.email.toLowerCase();
    byEmail.set(key, [...(byEmail.get(key) ?? []), m]);
  }

  const members: Member[] = [];
  const shared: Member[][] = [];
  for (const [email, rows] of byEmail) {
    if (rows.length > 1) shared.push(rows);
    members.push({
      ...rows[0],
      email,
      name: rows.map((r) => r.name).join(" & "),
      // Keep the first listed number; the others are recorded in the warning.
      phone: rows[0].phone,
      // A shared mailbox takes the highest role among its occupants.
      role: rows.some((r) => r.role === UserRole.SUPER_ADMIN) ? UserRole.SUPER_ADMIN : rows[0].role,
    });
  }
  return { members, shared };
}

async function main() {
  const password = process.env.MEMBER_PASSWORD?.trim();
  if (!password) {
    throw new Error("Missing MEMBER_PASSWORD. See the usage comment at the top of prisma/seed-members.ts.");
  }
  if (password.length < 8) {
    throw new Error("MEMBER_PASSWORD must be at least 8 characters.");
  }
  const resetExisting = process.env.RESET_EXISTING_PASSWORDS === "true";

  // Join the club's EXISTING organization. Guessing a slug here would silently
  // create a second org and strand these members where they can't see the rest
  // of the club, so only fall back to creating one on a genuinely empty database.
  const slug = process.env.DEFAULT_ORG_SLUG?.trim();
  const org =
    (slug
      ? await prisma.organization.findUnique({ where: { slug } })
      : await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await prisma.organization.create({
      data: { name: process.env.DEFAULT_ORG_NAME?.trim() || "NexLink", slug: slug || "nexlink" },
    }));
  console.log(`Seeding into organization "${org.name}" (${org.slug}).`);

  const { members, shared } = groupByEmail(ROSTER);
  const hashedPassword = await bcrypt.hash(password, 10);

  let created = 0;
  let updated = 0;
  for (const m of members) {
    const existing = await prisma.user.findUnique({ where: { email: m.email }, select: { id: true } });

    await prisma.user.upsert({
      where: { email: m.email },
      create: {
        organizationId: org.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        businessName: m.businessName,
        industry: m.industry,
        role: m.role,
        hashedPassword,
        isActive: true,
        emailVerified: new Date(),
      },
      update: {
        name: m.name,
        phone: m.phone,
        businessName: m.businessName,
        industry: m.industry,
        role: m.role,
        isActive: true,
        // Only touch an existing password when explicitly asked, so a re-run
        // doesn't undo a password a member has already set for themselves.
        ...(resetExisting ? { hashedPassword } : {}),
      },
    });

    if (existing) updated++;
    else created++;
    console.log(`  ${existing ? "updated" : "created"}  ${m.role.padEnd(11)}  ${m.email}  (${m.name})`);
  }

  console.log(
    `\n${ROSTER.length} roster rows -> ${members.length} accounts in "${org.name}" (${org.slug}): ` +
      `${created} created, ${updated} updated.`
  );
  if (updated > 0 && !resetExisting) {
    console.log("Existing accounts kept their current password (set RESET_EXISTING_PASSWORDS=true to override).");
  }

  for (const rows of shared) {
    console.log(
      `\nWARNING: ${rows.map((r) => r.name).join(" and ")} share the mailbox ${rows[0].email}, ` +
        `so they share ONE login (phones: ${rows.map((r) => `${r.name} ${r.phone}`).join(", ")}).\n` +
        `         Give one of them a distinct email address to split them into separate accounts.`
    );
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
