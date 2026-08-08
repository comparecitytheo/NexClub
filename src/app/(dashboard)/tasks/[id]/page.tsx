import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { taskScope } from "@/server/scope";
import { TaskForm } from "@/components/tasks/task-form";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  const task = await prisma.task.findFirst({ where: { id, ...taskScope(session.user) } });
  if (!task) notFound();

  const members = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const initial = {
    title: task.title,
    description: task.description ?? "",
    assigneeId: task.assigneeId,
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "",
    priority: task.priority,
    status: task.status,
    recurrence: !task.isRecurring ? "NONE" : task.recurrenceRule ?? "NONE",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/tasks" className="text-sm text-muted-foreground hover:text-foreground">← Tasks</Link>
        <h1 className="mt-1 text-2xl font-bold">{task.title}</h1>
      </div>
      <div className="rounded-xl bg-card p-6 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <TaskForm members={members} initial={initial} id={task.id} />
      </div>
    </div>
  );
}
