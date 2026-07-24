import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured } from "@/lib/storage";
import { ProfileSettings } from "@/components/settings/profile-settings";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true,
      businessName: true, industry: true, services: true, phone: true, bio: true, avatarUrl: true, businessLogoUrl: true,
      emailNotificationsEnabled: true,
      businessContacts: {
        select: { id: true, name: true, role: true, phone: true, email: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!me) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile settings</h1>
        <p className="text-sm text-muted-foreground">
          Your details and how you appear in the NexLink member directory.
        </p>
      </div>
      <ProfileSettings me={me} storageReady={isStorageConfigured()} />
    </div>
  );
}
