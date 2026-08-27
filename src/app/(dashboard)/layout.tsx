import { redirect } from "next/navigation";
import { effectiveSession } from "@/server/session";
import { isAdminOrAbove, isSuperAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { themeToCssText, type ThemePreferences } from "@/lib/theme";
import { viewingContext } from "@/server/api-helpers";
import { SupportBanner } from "@/components/shared/support-banner";
import { Sidebar } from "@/components/shared/sidebar";
import { MobileNav } from "@/components/shared/mobile-nav";
import { UserMenu } from "@/components/shared/user-menu";
import { AnnouncementBar } from "@/components/shared/announcement-bar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { RefreshControl } from "@/components/shared/refresh-control";
import { mergeSettings, FEATURE_KEYS } from "@/server/admin/settings";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await effectiveSession();
  if (!session?.user) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      avatarUrl: true,
      businessName: true,
      themePreferences: true,
      organization: { select: { announcement: true, settings: true } },
    },
  });
  const avatarImage = me?.avatarUrl ? `/api/users/${session.user.id}/avatar` : null;

  // The signed-in user's theme, rendered on the server for THIS request. Because
  // it is read from their row rather than from localStorage, signing in as a
  // different user on the same browser shows that user's colours immediately —
  // there is no client-side state to clear. Server-rendering also means no flash
  // of the default palette before the theme loads.
  const themeCss = themeToCssText((me?.themePreferences ?? {}) as ThemePreferences);
  const admin = isAdminOrAbove(session.user.role);
  const { viewAsName } = await viewingContext();
  // Org-wide header banner + who may edit it (SUPER_ADMIN only).
  const announcement = me?.organization?.announcement ?? "";
  const superAdmin = isSuperAdmin(session.user.role);
  const canEditAnnouncement = superAdmin;
  // Enabled CRM modules gate the nav; disabled modules disappear from the menu.
  const settings = mergeSettings(me?.organization?.settings ?? null);
  const features = FEATURE_KEYS.filter((k) => settings.features[k]);

  return (
    <>
      {/* Per-user CSS variables, scoped to the dashboard shell. These override
          the :root defaults from globals.css, so every component using a themed
          token restyles with no rebuild and no component changes. */}
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: `:root { ${themeCss} }` }}
      />
    <div className="flex h-screen flex-col bg-muted/20">
      {viewAsName && <SupportBanner viewingAs={viewAsName} />}
      <div className="flex min-h-0 flex-1 bg-muted/40">
      <Sidebar isAdmin={admin} isSuperAdmin={superAdmin} features={features} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mx-3 mt-2.5 flex h-14 shrink-0 items-center gap-2 rounded-full bg-card px-5 shadow-[0_4px_14px_rgba(0,0,0,0.07)] sm:mx-4">
          <MobileNav isAdmin={admin} isSuperAdmin={superAdmin} features={features} />
          {/* Was: <div className="flex-1" />. Now the scrolling announcement
              bar fills that space, left of the header controls. It still grows to
              flex-1 (and falls back to an empty spacer when there is no
              announcement and the user can't edit), so the bell and menu
              stay aligned exactly as before. */}
          <AnnouncementBar text={announcement} canEdit={canEditAnnouncement} />
          <RefreshControl />
          <NotificationBell />
          <UserMenu name={session.user.name} email={session.user.email} image={avatarImage} />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:py-6 sm:pl-4 sm:pr-6">{children}</main>
      </div>
      </div>
    </div>
    </>
  );
}
