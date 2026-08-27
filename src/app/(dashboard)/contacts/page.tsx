import Link from "next/link";
import { isSuperAdmin } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { ownerScope } from "@/server/scope";
import { Button } from "@/components/ui/button";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { CsvTools } from "@/components/shared/csv-tools";

export default async function ContactsPage() {
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  const rows = await prisma.contact.findMany({
    where: ownerScope(session.user),
    orderBy: { createdAt: "desc" },
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, jobTitle: true, status: true,
      company: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-muted-foreground">People you work with across the club.</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvTools exportHref="/api/contacts/export" importEndpoint="/api/contacts/import" canExport={isSuperAdmin(session.user.role)} />
          <Button asChild>
            <Link href="/contacts/new">
              <Plus className="h-4 w-4" /> New contact
            </Link>
          </Button>
        </div>
      </div>
      <ContactsTable rows={rows} />
    </div>
  );
}
