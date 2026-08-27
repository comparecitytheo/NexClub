import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { ownerScope } from "@/server/scope";
import { CompanyForm } from "@/components/companies/company-form";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findFirst({
    where: { id, ...ownerScope(session.user) },
    include: {
      contacts: {
        select: { id: true, firstName: true, lastName: true, jobTitle: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!company) notFound();

  const initial = {
    name: company.name,
    industry: company.industry ?? "",
    website: company.website ?? "",
    employeeCount: company.employeeCount != null ? String(company.employeeCount) : "",
    revenue: company.revenue != null ? String(company.revenue) : "",
    address: company.address ?? "",
    notes: company.notes ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/companies" className="text-sm text-muted-foreground hover:text-foreground">← Companies</Link>
        <h1 className="mt-1 text-2xl font-bold">{company.name}</h1>
      </div>
      <div className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <CompanyForm initial={initial} id={company.id} />
      </div>
      {company.contacts.length > 0 && (
        <div className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Contacts at this company</h2>
          <ul className="divide-y">
            {company.contacts.map((c) => (
              <li key={c.id} className="py-2">
                <Link href={`/contacts/${c.id}`} className="text-sm font-medium hover:text-primary">
                  {c.firstName} {c.lastName}
                </Link>
                {c.jobTitle && <span className="ml-2 text-xs text-muted-foreground">{c.jobTitle}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
