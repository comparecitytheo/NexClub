import { redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { MemberDirectory } from "@/components/directory/member-directory";
import { listIndustryNames } from "@/server/industries";
import { isSuperAdmin } from "@/lib/rbac";

// MEMBER DIRECTORY — data-model assumptions
// This schema has no dedicated `businesses` table. A "business" is the
// `businessName` string carried on each member (`User`), and the people
// associated with a business are (a) the member(s) that share that businessName
// and (b) each member's `BusinessContact` rows (related via BusinessContact.userId).
// We therefore fetch members and group them by businessName (done client-side in
// MemberDirectory); a member with no businessName is shown as their own
// single-person business. Member photos come from `User.avatarUrl` (served at
// /api/users/{id}/avatar via MemberAvatar); business contacts have no photo and
// fall back to initials. A business logo comes from `User.businessLogoUrl` (each
// member uploads their own in profile settings, served at
// /api/users/{id}/business-logo); when several members share a businessName the
// first member with a logo represents the business. Member email exists on `User` but the existing
// query intentionally does not expose it, so we leave it off too.

export default async function DirectoryPage() {
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  const members = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId, isActive: true },
    orderBy: [{ businessName: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, role: true,
      businessId: true,
      // Chapter belongs to the BUSINESS — it is a location, not a per-person
      // attribute — so it comes through the business relation.
      business: { select: { logoUserId: true, chapter: { select: { id: true, name: true } } } },
      businessName: true, industry: true, services: true, phone: true, bio: true, avatarUrl: true, businessLogoUrl: true,

    },
  });

  // Flatten the business's logo owner onto each member, so the grouper does not
  // need to know how the relation is shaped.
  //
  // `business` is KEPT rather than destructured away. groupBusinesses reads the
  // chapter from it (`m.business?.chapter`), and dropping it here meant every
  // group was built with chapter: null — so the Chapter dropdown listed the
  // right options, and choosing one filtered every business out. The field is
  // optional on DirectoryMember, so removing it type-checked perfectly.
  const rows = members.map((m) => ({
    ...m,
    businessLogoUserId: m.business?.logoUserId ?? null,
    chapterName: m.business?.chapter?.name ?? null,
  }));

  const industries = await listIndustryNames();

  // Only chapters that someone is actually in, so the filter never offers an
  // option that returns nothing.
  const chapters = [...new Set(rows.map((r) => r.chapterName).filter(Boolean))].sort() as string[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Member Directory</h1>
          <p className="text-sm text-muted-foreground">
            Browse the NexLink community — services offered and who to contact.
          </p>
        </div>
        <div className="rounded-lg bg-card px-4 py-2 text-center border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <p className="text-2xl font-bold leading-none">{members.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Active members</p>
        </div>
      </div>
      <MemberDirectory
        members={rows}
        industries={industries}
        chapters={chapters}
        canManage={isSuperAdmin(session.user.role)}
      />
    </div>
  );
}
