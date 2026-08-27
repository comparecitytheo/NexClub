/**
 * BUSINESS CONTACTS — INSPECT AND EXPORT (read-only)
 *
 * Business contacts were merged into staff accounts: a person in the CRM now has
 * a login, or is not listed. The `business_contacts` table was deliberately left
 * in place rather than dropped, because it may hold names, phone numbers and
 * email addresses that members typed in and nobody has reviewed.
 *
 * This script CHANGES NOTHING. It reports what is in there and writes a CSV, so
 * the decision to keep, migrate or delete is made with the data in front of you
 * rather than in the dark.
 *
 *   npm run contacts:audit              # summary only
 *   npm run contacts:audit -- --csv     # summary + contacts-export.csv
 *
 * If the table is empty, it says so and there is nothing to weigh up — the table
 * can then be dropped safely.
 *
 * If it is not empty, those are real people. Consider inviting the ones who
 * should have accounts (Business details → Staff accounts) BEFORE removing
 * anything. Deleting the table would take their details with it, and under the
 * Australian Privacy Act these are personal information you were holding.
 */
import { writeFileSync } from "fs";
import { prisma } from "../src/lib/prisma";

function csvCell(value: string | null): string {
  const v = (value ?? "").replace(/"/g, '""');
  return /[",\n]/.test(v) ? `"${v}"` : v;
}

async function main() {
  const wantCsv = process.argv.includes("--csv");

  const contacts = await prisma.businessContact.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      phone: true,
      email: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, email: true, businessName: true, isActive: true },
      },
    },
  });

  if (contacts.length === 0) {
    console.log("\nbusiness_contacts is EMPTY.");
    console.log("Nothing would be lost by dropping the table.\n");
    return;
  }

  // Group by the member who entered them, which is how someone would review it.
  const byOwner = new Map<string, typeof contacts>();
  for (const c of contacts) {
    const key = c.user?.businessName?.trim() || c.user?.name || "(unknown member)";
    const list = byOwner.get(key) ?? [];
    list.push(c);
    byOwner.set(key, list);
  }

  const withEmail = contacts.filter((c) => c.email).length;
  const withPhone = contacts.filter((c) => c.phone).length;

  console.log(`\nbusiness_contacts holds ${contacts.length} contact(s) across ${byOwner.size} business(es).`);
  console.log(`  ${withEmail} have an email address — these could be invited as staff.`);
  console.log(`  ${withPhone} have a phone number.`);
  console.log("\nNOTHING HAS BEEN CHANGED. This is a read-only report.\n");

  for (const [business, list] of [...byOwner.entries()].sort()) {
    console.log(`  ${business} — ${list.length}`);
    for (const c of list) {
      const bits = [c.role, c.email, c.phone].filter(Boolean).join(" · ");
      console.log(`      ${c.name}${bits ? ` (${bits})` : ""}`);
    }
  }

  if (wantCsv) {
    const header = "contact_name,role,email,phone,entered_by,business,entered_on";
    const rows = contacts.map((c) =>
      [
        csvCell(c.name),
        csvCell(c.role),
        csvCell(c.email),
        csvCell(c.phone),
        csvCell(c.user?.name ?? null),
        csvCell(c.user?.businessName ?? null),
        csvCell(c.createdAt.toISOString().slice(0, 10)),
      ].join(",")
    );
    writeFileSync("contacts-export.csv", [header, ...rows].join("\n") + "\n");
    console.log(`\nWrote contacts-export.csv (${contacts.length} rows).`);
  } else {
    console.log("\nRe-run with --csv to export these to a file before deciding.");
  }

  console.log(
    "\nNext step: invite anyone who should have an account (Business details → " +
      "Staff accounts). Only drop the table once you are satisfied nothing here is needed.\n"
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
