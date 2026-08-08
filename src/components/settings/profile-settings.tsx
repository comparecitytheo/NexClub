"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Trash2, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageCropper } from "./image-cropper";
import { ThemeSettings } from "./theme-settings";
import { BusinessStaff, type StaffMember, type PendingStaff } from "./business-staff";
import { DEFAULT_THEME, type ThemePreferences } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initials } from "@/lib/format";

type Contact = { id?: string; name: string; role: string; phone: string; email: string };

type Me = {
  id: string;
  name: string;
  email: string;
  businessName: string | null;
  industry: string | null;
  services: string | null;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  businessLogoUrl: string | null;
};

export function ProfileSettings({
  me,
  storageReady,
  initialTheme,
  staff,
  pendingStaff,
  canManageStaff,
}: {
  me: Me;
  storageReady: boolean;
  initialTheme: ThemePreferences;
  staff: StaffMember[];
  pendingStaff: PendingStaff[];
  /** Admins only, and only once they have a business name to attach staff to. */
  canManageStaff: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasAvatar, setHasAvatar] = useState(Boolean(me.avatarUrl));
  const [cacheBust, setCacheBust] = useState(0);
  const logoRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [hasLogo, setHasLogo] = useState(Boolean(me.businessLogoUrl));
  const [logoCacheBust, setLogoCacheBust] = useState(0);
  // The picked file waits here until the member has framed it. Nothing uploads
  // until they confirm the crop.
  const [pending, setPending] = useState<{ file: File; kind: "avatar" | "logo" } | null>(null);
  // Theme lives here so the page's single Save changes button sends it with the
  // rest of the profile — one form, one save.
  const [theme, setTheme] = useState<ThemePreferences>({ ...DEFAULT_THEME, ...initialTheme });

  const [form, setForm] = useState({
    name: me.name ?? "",
    businessName: me.businessName ?? "",
    industry: me.industry ?? "",
    services: me.services ?? "",
    phone: me.phone ?? "",
    bio: me.bio ?? "",
  });

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Picking a file opens the cropper rather than uploading straight away, so a
  // wide photo is never squashed into the circle.
  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPending({ file, kind: "avatar" });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadAvatarBlob(blob: Blob) {
    const fd = new FormData();
    fd.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    setUploading(true);
    const res = await fetch("/api/users/me/avatar", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Upload failed.");
      return;
    }
    setHasAvatar(true);
    setCacheBust(Date.now());
    toast.success("Profile picture updated.");
    router.refresh();
  }

  async function removeAvatar() {
    setUploading(true);
    const res = await fetch("/api/users/me/avatar", { method: "DELETE" });
    setUploading(false);
    if (!res.ok) {
      toast.error("Could not remove the picture.");
      return;
    }
    setHasAvatar(false);
    toast.success("Profile picture removed.");
    router.refresh();
  }

  // Logos crop to a wide frame rather than a circle, matching how they appear
  // on the business cards in the member directory.
  function onUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPending({ file, kind: "logo" });
    if (logoRef.current) logoRef.current.value = "";
  }

  async function uploadLogoBlob(blob: Blob) {
    const fd = new FormData();
    fd.append("file", new File([blob], "logo.jpg", { type: "image/jpeg" }));
    setUploadingLogo(true);
    const res = await fetch("/api/users/me/business-logo", { method: "POST", body: fd });
    setUploadingLogo(false);
    if (logoRef.current) logoRef.current.value = "";
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Upload failed.");
      return;
    }
    setHasLogo(true);
    setLogoCacheBust(Date.now());
    toast.success("Business logo updated.");
    router.refresh();
  }

  async function removeLogo() {
    setUploadingLogo(true);
    const res = await fetch("/api/users/me/business-logo", { method: "DELETE" });
    setUploadingLogo(false);
    if (!res.ok) {
      toast.error("Could not remove the logo.");
      return;
    }
    setHasLogo(false);
    toast.success("Business logo removed.");
    router.refresh();
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // name and businessName are intentionally omitted: the server no longer
        // accepts either, and neither is the member's to change.
        ...(({ name: _n, businessName: _b, ...rest }) => rest)(form),
        themePreferences: theme,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not save your profile.");
      return;
    }
    toast.success("Profile saved.");
    router.refresh();
  }

  const avatarSrc = hasAvatar ? `/api/users/${me.id}/avatar?v=${cacheBust}` : undefined;
  const logoSrc = hasLogo ? `/api/users/${me.id}/business-logo?v=${logoCacheBust}` : undefined;

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            {avatarSrc ? <AvatarImage src={avatarSrc} alt={form.name} /> : null}
            <AvatarFallback className="text-lg">{initials(form.name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <div className="text-sm font-medium">Profile picture</div>
            {storageReady ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={onUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload"}
                </Button>
                {hasAvatar && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploading}
                    className="text-destructive focus:text-destructive"
                    onClick={removeAvatar}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ) : (
              <p className="max-w-sm text-xs text-muted-foreground">
                Image storage isn&apos;t configured yet, so uploads are disabled. Add the S3 storage
                settings to enable profile pictures.
              </p>
            )}
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP or GIF, up to 5MB.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        {/* Business logo — shown on this business's card in the member directory. */}
        <div className="flex items-center gap-4">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={form.businessName || "Business logo"}
              className="h-20 w-20 rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Building2 className="h-8 w-8" />
            </div>
          )}
          <div className="space-y-2">
            <div className="text-sm font-medium">Business logo</div>
            {storageReady ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={onUploadLogo}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => logoRef.current?.click()}
                >
                  <Upload className="h-4 w-4" /> {uploadingLogo ? "Uploading…" : "Upload"}
                </Button>
                {hasLogo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploadingLogo}
                    className="text-destructive focus:text-destructive"
                    onClick={removeLogo}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ) : (
              <p className="max-w-sm text-xs text-muted-foreground">
                Image storage isn&apos;t configured yet, so uploads are disabled.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Appears on your business card in the member directory. JPG, PNG, WebP or GIF, up to 5MB.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            {/* Read-only, like the business name below. Both are changed by a
                Super Admin from the Admin panel. Leaving this editable would
                silently discard what was typed, since the server no longer
                accepts it. */}
            <Input
              id="name"
              value={form.name}
              readOnly
              disabled
              title="Contact a Super Admin to change your name."
            />
            <p className="text-xs text-muted-foreground">
              Contact a Super Admin to change your name.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessName">Business name</Label>
            {/* Read-only: which business you belong to is set by your invitation
                or by a Super Admin, not by typing. An editable field here would
                silently discard what the user typed, since the server no longer
                accepts it. */}
            <Input
              id="businessName"
              value={form.businessName}
              readOnly
              disabled
              title="Contact a Super Admin to change which business you belong to."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={form.industry}
              onChange={(e) => set("industry", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="services">Services you offer</Label>
          <Textarea
            id="services"
            rows={3}
            value={form.services}
            placeholder="e.g. Commercial lending, asset finance, refinancing"
            onChange={(e) => set("services", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Shown on your directory listing so members know what you do.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">About</Label>
          <Textarea id="bio" rows={3} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
        </div>
      </div>

      {/* Staff accounts: real logins at this business, distinct from the contact
          people below, who are just names and numbers on the directory card. */}
      {canManageStaff && (
        <div className="space-y-4 rounded-lg bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <BusinessStaff
            businessName={form.businessName}
            staff={staff}
            pending={pendingStaff}
          />
        </div>
      )}


      <ThemeSettings value={theme} onChange={setTheme} />

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* Both crop square, because both are DISPLAYED square: avatars in a
          circle, logos in a rounded box (h-10 w-10 in the directory, h-20 w-20
          here). Cropping the logo to a wide frame meant the saved image never
          matched the box it had to sit in. Only the frame's corner radius
          differs, so each preview looks like its final placement. */}
      {pending && (
        <ImageCropper
          file={pending.file}
          aspect={1}
          outputWidth={512}
          shape={pending.kind === "avatar" ? "circle" : "rect"}
          // A logo fits whole inside the square; an avatar fills the circle.
          fit={pending.kind === "avatar" ? "cover" : "contain"}
          onCancel={() => setPending(null)}
          onCropped={async (blob) => {
            const kind = pending.kind;
            setPending(null);
            if (kind === "avatar") await uploadAvatarBlob(blob);
            else await uploadLogoBlob(blob);
          }}
        />
      )}

    </div>
  );
}
