import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import { ownerScope } from "@/server/scope";
import { Button } from "@/components/ui/button";
import { DealBoard } from "@/components/deals/deal-board";
import type { BoardDeal } from "@/components/deals/deal-card";

export default async function DealsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  const deals = await prisma.deal.findMany({
    where: ownerScope(user),
    orderBy: [{ boardPosition: "asc" }, { updatedAt: "desc" }],
    include: {
      company: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
      owner: { select: { id: true, name: true } },
    },
  });

  const initialDeals: BoardDeal[] = deals.map((d) => ({
    id: d.id,
    name: d.name,
    value: Number(d.value),
    stage: d.stage,
    probability: d.probability,
    expectedCloseDate: d.expectedCloseDate ? d.expectedCloseDate.toISOString() : null,
    boardPosition: d.boardPosition,
    companyName: d.company?.name ?? null,
    contactName: d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : null,
    ownerId: d.ownerId ?? "",
    ownerName: d.owner?.name ?? "",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Deals</h1>
          <p className="text-sm text-muted-foreground">Your pipeline by stage. Drag a deal to move it forward.</p>
        </div>
        <Button asChild>
          <Link href="/deals/new">
            <Plus className="h-4 w-4" /> New deal
          </Link>
        </Button>
      </div>
      <DealBoard initialDeals={initialDeals} currentUserId={user.id} isAdmin={isAdmin(user.role)} />
    </div>
  );
}
