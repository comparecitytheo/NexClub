import { requireSuperAdminPage } from "@/server/admin/guard";
import { prisma } from "@/lib/prisma";
import { ChapterManager } from "@/components/admin/chapter-manager";

export default async function AdminChaptersPage() {
  // The guard already returns the session user — no second lookup needed.
  const user = await requireSuperAdminPage();

  const rows = await prisma.chapter.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      // Deleted members do not count towards the guard that blocks removing a
      // chapter people are still in.
      _count: { select: { businesses: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Chapters</h2>
        <p className="text-sm text-muted-foreground">
          The club&rsquo;s geographic groups. Assign a member to a chapter from their
          profile in Members. Chapters are for organising the directory only &mdash;
          they don&rsquo;t change who can see which leads.
        </p>
      </div>
      <ChapterManager
        initial={rows.map((c) => ({ id: c.id, name: c.name, businessCount: c._count.businesses }))}
      />
    </div>
  );
}
