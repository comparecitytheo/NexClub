import { redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { isAdminOrAbove } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { MembersTable } from "@/components/members/members-table";

export default async function MembersPage() {
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");
  if (!isAdminOrAbove(session.user.role)) redirect("/dashboard");

  const members = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      businessName: true, industry: true, avatarUrl: true,
      chapter: { select: { name: true } },
      business: { select: { logoUserId: true } },
    },
  });

  // Flatten the business's logo owner, as the directory does.
  const rows = members.map(({ business, ...m }) => ({
    ...m,
    businessLogoUserId: business?.logoUserId ?? null,
  }));


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="text-sm text-muted-foreground">Manage roles and access for the club.</p>
      </div>
      <MembersTable
        members={rows.map(({ chapter, ...m }) => ({ ...m, chapterName: chapter?.name ?? null }))}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />
    </div>
  );
}
