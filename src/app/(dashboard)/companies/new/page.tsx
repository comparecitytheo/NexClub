import Link from "next/link";
import { redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { CompanyForm } from "@/components/companies/company-form";

export default async function NewCompanyPage() {
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/companies" className="text-sm text-muted-foreground hover:text-foreground">← Companies</Link>
        <h1 className="mt-1 text-2xl font-bold">New company</h1>
      </div>
      <div className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <CompanyForm />
      </div>
    </div>
  );
}
