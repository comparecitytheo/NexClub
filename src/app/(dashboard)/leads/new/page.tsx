import Link from "next/link";
import { redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { LeadForm } from "@/components/leads/lead-form";

export default async function NewLeadPage() {
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  const members = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="text-sm text-muted-foreground hover:text-foreground">← Leads</Link>
        <h1 className="mt-1 text-2xl font-bold">Send a lead</h1>
        <p className="text-sm text-muted-foreground">Refer an opportunity to another member. It lands at the top of their pipeline.</p>
      </div>
      <div className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <LeadForm members={members} currentUserId={session.user.id} />
      </div>
    </div>
  );
}
