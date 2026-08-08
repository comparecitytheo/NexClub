import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { ownerScope } from "@/server/scope";
import { Button } from "@/components/ui/button";
import { CompaniesTable } from "@/components/companies/companies-table";

export default async function CompaniesPage() {
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  const companies = await prisma.company.findMany({
    where: ownerScope(session.user),
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      industry: true,
      website: true,
      _count: { select: { contacts: true, deals: true } },
    },
  });

  const rows = companies.map((c) => ({
    id: c.id,
    name: c.name,
    industry: c.industry,
    website: c.website,
    contacts: c._count.contacts,
    deals: c._count.deals,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-sm text-muted-foreground">The businesses behind your contacts and deals.</p>
        </div>
        <Button asChild>
          <Link href="/companies/new">
            <Plus className="h-4 w-4" /> New company
          </Link>
        </Button>
      </div>
      <CompaniesTable rows={rows} />
    </div>
  );
}
