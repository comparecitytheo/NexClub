import Link from "next/link";
import { redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { ownerScope } from "@/server/scope";
import { DealForm } from "@/components/deals/deal-form";

export default async function NewDealPage() {
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  const [companies, contacts] = await Promise.all([
    prisma.company.findMany({ where: ownerScope(session.user), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.contact.findMany({ where: ownerScope(session.user), orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
  ]);

  const contactOptions = contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/deals" className="text-sm text-muted-foreground hover:text-foreground">← Deals</Link>
        <h1 className="mt-1 text-2xl font-bold">New deal</h1>
      </div>
      <div className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <DealForm companies={companies} contacts={contactOptions} />
      </div>
    </div>
  );
}
