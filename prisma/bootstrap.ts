/**
 * FIRST-ADMIN BOOTSTRAP
 *
 * Public self-registration is disabled (POST /api/auth/register always 403s) and
 * accounts are otherwise created only by an existing admin sending an invitation.
 * That leaves a fresh database with no way in — this script is that way in.
 *
 * It is deliberately safe to run against production:
 *   - it REFUSES to do anything if any user already exists, so it can never
 *     clobber a live club (unlike prisma/seed.ts, which wipes and reseeds demo data),
 *   - it creates nothing but one organization and one SUPER_ADMIN,
 *   - it reads credentials from the environment so no password is committed.
 *
 * Usage (from the project root, with DATABASE_URL set):
 *
 *   BOOTSTRAP_EMAIL="you@yourclub.com.au" \
 *   BOOTSTRAP_PASSWORD="a-long-password-you-choose" \
 *   BOOTSTRAP_NAME="Your Name" \
 *   npm run bootstrap
 *
 * Then sign in at /login and invite the rest of the club from Members.
 */
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing ${name}. See the usage comment at the top of prisma/bootstrap.ts.`);
  }
  return v.trim();
}

async function main() {
  const email = required("BOOTSTRAP_EMAIL").toLowerCase();
  const password = required("BOOTSTRAP_PASSWORD");
  const name = process.env.BOOTSTRAP_NAME?.trim() || "Club Owner";
  const orgSlug = process.env.DEFAULT_ORG_SLUG?.trim() || "nexlink";
  const orgName = process.env.DEFAULT_ORG_NAME?.trim() || "NexLink";

  if (password.length < 12) {
    throw new Error("BOOTSTRAP_PASSWORD must be at least 12 characters.");
  }

  // Safety: this script exists only to open an empty database. If anyone at all
  // exists, the club is already live and the correct path is an invitation.
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log(
      `Refusing to bootstrap: ${existing} user(s) already exist.\n` +
        `Add people by inviting them from Members instead.`
    );
    return;
  }

  const org =
    (await prisma.organization.findUnique({ where: { slug: orgSlug } })) ??
    (await prisma.organization.create({ data: { name: orgName, slug: orgSlug } }));

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      name,
      email,
      hashedPassword: await bcrypt.hash(password, 10),
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      emailVerified: new Date(),
    },
    select: { id: true, email: true, role: true },
  });

  console.log(
    `Created ${user.role} ${user.email} in organization "${org.name}" (${org.slug}).\n` +
      `Sign in at /login, then invite the rest of the club from Members.`
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
