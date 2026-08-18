import { redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured } from "@/lib/storage";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { isAdminOrAbove } from "@/lib/rbac";
import type { StaffMember, PendingStaff } from "@/components/settings/business-staff";
import type { ThemePreferences } from "@/lib/theme";

export default async function SettingsPage() {
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  const canManageStaff = isAdminOrAbove(session.user.role);

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true,
      businessName: true, industry: true, services: true, phone: true, bio: true, avatarUrl: true, businessLogoUrl: true,
      businessId: true,
      themePreferences: true,
      business: { select: { addressLine1: true, addressLine2: true, suburb: true, state: true, postcode: true } },
      chapter: { select: { name: true } },
      emailNotificationsEnabled: true,
    },
  });
  if (!me) redirect("/login");

  // Staff at this admin's own business. Matched on business name, case-
  // insensitively, the same way the member directory groups businesses — so what
  // is listed here is exactly what appears on the directory card.
  // Membership is matched on the FOREIGN KEY, not the name. Someone who types a
  // business name into their profile can no longer appear in another business's
  // staff list — and the field is read-only now anyway.
  const business = me.businessName?.trim() ?? "";
  const showStaff = canManageStaff && Boolean(me.businessId);

  const staff: StaffMember[] = showStaff
    ? (
        await prisma.user.findMany({
          where: {
            organizationId: session.user.organizationId,
            isActive: true,
            businessId: me.businessId,
            id: { not: me.id }, // the admin is shown separately as the account owner
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true, role: true, avatarUrl: true },
        })
      ).map((u) => ({ id: u.id, name: u.name, role: u.role, avatarUrl: u.avatarUrl }))
    : [];

  const pending: PendingStaff[] = showStaff
    ? await prisma.invitation.findMany({
        where: {
          organizationId: session.user.organizationId,
          status: "PENDING",
          // Invitations still carry a name (the business row may not exist until
          // the invite is accepted), so these are matched by name.
          businessName: { equals: business, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, contactPerson: true, email: true },
      })
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile settings</h1>
        <p className="text-sm text-muted-foreground">
          Your details and how you appear in the NexLink member directory.
        </p>
      </div>
      <ProfileSettings
        me={{
          ...me,
          chapterName: me.chapter?.name ?? null,
          // The address lives on the business; flattened here for the form.
          addressLine1: me.business?.addressLine1 ?? null,
          addressLine2: me.business?.addressLine2 ?? null,
          suburb: me.business?.suburb ?? null,
          state: me.business?.state ?? null,
          postcode: me.business?.postcode ?? null,
        }}
        storageReady={isStorageConfigured()}
        initialTheme={(me.themePreferences ?? {}) as ThemePreferences}
        staff={staff}
        pendingStaff={pending}
        canManageStaff={showStaff}
      />
    </div>
  );
}
