import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { ownerScope } from "@/server/scope";
import { ContactForm } from "@/components/contacts/contact-form";
import { isAiConfigured } from "@/server/ai";
import { AiPanel } from "@/components/ai/ai-panel";
import { SummaryBox } from "@/components/ai/summary-box";
import { EmailWriter } from "@/components/ai/email-writer";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  const contact = await prisma.contact.findFirst({ where: { id, ...ownerScope(session.user) } });
  if (!contact) notFound();

  const companies = await prisma.company.findMany({
    where: ownerScope(session.user),
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const initial = {
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    jobTitle: contact.jobTitle ?? "",
    companyId: contact.companyId ?? "",
    status: contact.status,
    address: contact.address ?? "",
    website: contact.website ?? "",
    tags: (contact.tags ?? []).join(", "),
    notes: contact.notes ?? "",
  };

  const aiEnabled = isAiConfigured();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/contacts" className="text-sm text-muted-foreground hover:text-foreground">← Contacts</Link>
        <h1 className="mt-1 text-2xl font-bold">{contact.firstName} {contact.lastName}</h1>
      </div>
      <div className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <ContactForm companies={companies} initial={initial} id={contact.id} />
      </div>
      {aiEnabled && (
        <>
          <AiPanel title="Quick summary">
            <SummaryBox entityType="CONTACT" entityId={contact.id} />
          </AiPanel>
          <AiPanel title="Draft an email">
            <EmailWriter entityType="CONTACT" entityId={contact.id} />
          </AiPanel>
        </>
      )}
    </div>
  );
}
