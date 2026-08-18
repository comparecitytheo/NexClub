import { prisma } from "@/lib/prisma";
import { requireSuperAdminPage } from "@/server/admin/guard";
import { BusinessManager, type BusinessRow } from "@/components/admin/business-manager";

export default async function AdminBusinessesPage() {
  const user = await requireSuperAdminPage();

  const businesses = await prisma.business.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      industry: true,
      logoUserId: true,
      addressLine1: true,
      addressLine2: true,
      suburb: true,
      state: true,
      postcode: true,
      chapterId: true,
      chapter: { select: { name: true } },
      _count: { select: { members: true } },
    },
  });

  const rows: BusinessRow[] = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    industry: b.industry,
    logoUserId: b.logoUserId,
    memberCount: b._count.members,
    addressLine1: b.addressLine1,
    addressLine2: b.addressLine2,
    suburb: b.suburb,
    state: b.state,
    postcode: b.postcode,
    chapterId: b.chapterId,
    chapterName: b.chapter?.name ?? null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Businesses</h2>
        <p className="text-sm text-muted-foreground">
          Every business in the club. Renaming one updates it everywhere — the
          directory, lead cards, reporting and each member&apos;s profile.
        </p>
      </div>
      <BusinessManager initial={rows} />
    </div>
  );
}
