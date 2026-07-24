import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin, isSuperAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/shared/sidebar";
import { MobileNav } from "@/components/shared/mobile-nav";
import { UserMenu } from "@/components/shared/user-menu";
import { AnnouncementBar } from "@/components/shared/announcement-bar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { mergeSettings, FEATURE_KEYS } from "@/server/admin/settings";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true, organization: { select: { announcement: true, settings: true } } },
  });
  const avatarImage = me?.avatarUrl ?? null;
  const admin = isAdmin(session.user.role);
  // Org-wide header banner + who may edit it (SUPER_ADMIN only).
  const announcement = me?.organization?.announcement ?? "";
  const superAdmin = isSuperAdmin(session.user.role);
  const canEditAnnouncement = superAdmin;
  // Enabled CRM modules gate the nav; disabled modules disappear from the menu.
  const settings = mergeSettings(me?.organization?.settings ?? null);
  const features = FEATURE_KEYS.filter((k) => settings.features[k]);

  return (
    <div className="flex h-screen bg-muted/20">
      <Sidebar isAdmin={admin} isSuperAdmin={superAdmin} features={features} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b bg-card px-4 sm:px-6">
          <MobileNav isAdmin={admin} isSuperAdmin={superAdmin} features={features} />
          {/* Was: <div className="flex-1" />. Now the scrolling announcement
              bar fills that space, left of the header controls. It still grows to
              flex-1 (and falls back to an empty spacer when there is no
              announcement and the user can't edit), so the bell and menu
              stay aligned exactly as before. */}
          <AnnouncementBar text={announcement} canEdit={canEditAnnouncement} />
          <NotificationBell />
          <UserMenu name={session.user.name} email={session.user.email} image={avatarImage} />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
