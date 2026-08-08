import Link from "next/link";
import { redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { ownerScope } from "@/server/scope";
import { ContactForm } from "@/components/contacts/contact-form";

export default async function NewContactPage() {
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  const companies = await prisma.company.findMany({
    where: ownerScope(session.user),
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/contacts" className="text-sm text-muted-foreground hover:text-foreground">← Contacts</Link>
        <h1 className="mt-1 text-2xl font-bold">New contact</h1>
      </div>
      <div className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <ContactForm companies={companies} />
      </div>
    </div>
  );
}
