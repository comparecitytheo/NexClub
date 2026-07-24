import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, CheckSquare, Clock, CheckCircle2, ListTodo } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { readRangeParams, resolveDateRange } from "@/lib/date-range";
import { StatCard } from "@/components/dashboard/stat-card";
import { AllTasksView } from "@/components/tasks/all-tasks-view";
import type { TaskItem } from "@/components/tasks/task-list";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  // Shared date-range filter (?range=7|30|90 or ?from&to); default 30 days —
  // identical wiring to My Leads and Sent Leads (filters by record creation date).
  const rangeParams = readRangeParams(await searchParams);
  const { from, to } = resolveDateRange(rangeParams);

  // Every task across every lead the user can see: attached to a lead, and
  // assigned to or created by the user (same scope as the existing Tasks page /
  // API), created within the selected range. Done in the page server component,
  // the same place the "all leads" / "sent leads" pages run their queries.
  const tasks = await prisma.task.findMany({
    where: {
      organizationId: user.organizationId,
      OR: [{ assigneeId: user.id }, { creatorId: user.id }],
      createdAt: { gte: from, lte: to },
    },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    include: {
      assignee: { select: { name: true } },
      creator: { select: { name: true } },
      lead: { select: { id: true, contactName: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      company: { select: { id: true, name: true } },
      deal: { select: { id: true, name: true } },
    },
  });

  const initialTasks: TaskItem[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    assigneeName: t.assignee.name,
    creatorName: t.creator.name,
    entityLabel: t.lead
      ? t.lead.contactName
      : t.contact
        ? `${t.contact.firstName} ${t.contact.lastName}`
        : t.company
          ? t.company.name
          : t.deal
            ? t.deal.name
            : null,
    entityHref: t.lead
      ? `/leads/${t.lead.id}`
      : t.contact
        ? `/contacts/${t.contact.id}`
        : t.company
          ? `/companies/${t.company.id}`
          : t.deal
            ? `/deals/${t.deal.id}`
            : null,
    entityType: t.lead ? "LEAD" : t.contact ? "CONTACT" : t.company ? "COMPANY" : t.deal ? "DEAL" : null,
    description: t.description,
    updatedAt: t.updatedAt.toISOString(),
  }));

  // Summary counts over the range-filtered set.
  const now = Date.now();
  const isOpen = (s: string) => s === "OPEN" || s === "IN_PROGRESS";
  const open = initialTasks.filter((t) => isOpen(t.status)).length;
  const overdue = initialTasks.filter(
    (t) => isOpen(t.status) && t.dueDate && new Date(t.dueDate).getTime() < now
  ).length;
  const completed = initialTasks.filter((t) => t.status === "COMPLETED").length;
  const leadCount = new Set(initialTasks.map((t) => t.entityHref)).size;

  return (
    <div className="space-y-6 card-heading-accent">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">Every task across the CRM.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker {...rangeParams} />
          <Button asChild>
            <Link href="/tasks/new">
              <Plus className="h-4 w-4" /> New task
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tasks due"
          value={String(open)}
          hint={overdue > 0 ? `${overdue} overdue` : "none overdue"}
          icon={CheckSquare}
          tone={overdue > 0 ? "rose" : "default"}
        />
        <StatCard
          title="Overdue"
          value={String(overdue)}
          hint="past their due date"
          icon={Clock}
          tone={overdue > 0 ? "rose" : "default"}
        />
        <StatCard title="Completed" value={String(completed)} hint="in this range" icon={CheckCircle2} tone="emerald" />
        <StatCard
          title="Linked records"
          value={String(leadCount)}
          hint={`${initialTasks.length} task${initialTasks.length === 1 ? "" : "s"} total`}
          icon={ListTodo}
        />
      </div>

      <AllTasksView initialTasks={initialTasks} />
    </div>
  );
}
