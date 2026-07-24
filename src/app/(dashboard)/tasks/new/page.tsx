import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskForm } from "@/components/tasks/task-form";

const ENTITY_TYPES = new Set<string>(Object.values(EntityType));

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; entityId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const sp = await searchParams;

  const members = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const prefillEntity =
    sp.entityType && sp.entityId && ENTITY_TYPES.has(sp.entityType)
      ? { type: sp.entityType as EntityType, id: sp.entityId }
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/tasks" className="text-sm text-muted-foreground hover:text-foreground">← Tasks</Link>
        <h1 className="mt-1 text-2xl font-bold">New task</h1>
      </div>
      <div className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <TaskForm members={members} prefillEntity={prefillEntity} />
      </div>
    </div>
  );
}
