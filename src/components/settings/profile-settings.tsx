"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Plus, Trash2, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  emailNotificationsEnabled: boolean;
  businessContacts: { id: string; name: string; role: string | null; phone: string | null; email: string | null }[];
};

export function ProfileSettings({ me, storageReady }: { me: Me; storageReady: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(me.avatarUrl);
  const logoRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [businessLogoUrl, setBusinessLogoUrl] = useState(me.businessLogoUrl);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(
    me.emailNotificationsEnabled
  );

  const [form, setForm] = useState({
    name: me.name ?? "",
    businessName: me.businessName ?? "",
    industry: me.industry ?? "",
    services: me.services ?? "",
    phone: me.phone ?? "",
    bio: me.bio ?? "",
  });
  const [contacts, setContacts] = useState<Contact[]>(
    me.businessContacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
    }))
  );

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function setContact(i: number, k: keyof Contact, v: string) {
    setContacts((cs) => cs.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));
  }
  function addContact() {
    setContacts((cs) => [...cs, { name: "", role: "", phone: "", email: "" }]);
  }
  function removeContact(i: number) {
    setContacts((cs) => cs.filter((_, idx) => idx !== i));
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    const res = await fetch("/api/users/me/avatar", { method: "POST", body: fd });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Upload failed.");
      return;
    }
    const d = await res.json();
    setAvatarUrl(d.avatarUrl);
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
    setAvatarUrl(null);
    toast.success("Profile picture removed.");
    router.refresh();
  }

  async function onUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploadingLogo(true);
    const res = await fetch("/api/users/me/business-logo", { method: "POST", body: fd });
    setUploadingLogo(false);
    if (logoRef.current) logoRef.current.value = "";
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Upload failed.");
      return;
    }
    const d = await res.json();
    setBusinessLogoUrl(d.businessLogoUrl);
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
    setBusinessLogoUrl(null);
    toast.success("Business logo removed.");
    router.refresh();
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        emailNotificationsEnabled,
        businessContacts: contacts
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name,
            role: c.role || undefined,
            phone: c.phone || undefined,
            email: c.email || undefined,
          })),
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

  const avatarSrc = avatarUrl ?? undefined;
  const logoSrc = businessLogoUrl ?? undefined;

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
                {avatarUrl && (
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
                Image storage isn&apos;t configured yet, so uploads are disabled. Add the Cloudinary
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
                {businessLogoUrl && (
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
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              value={form.businessName}
              onChange={(e) => set("businessName", e.target.value)}
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

      <div className="rounded-lg bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <label htmlFor="emailNotifications" className="flex cursor-pointer items-start gap-3">
          <input
            id="emailNotifications"
            type="checkbox"
            checked={emailNotificationsEnabled}
            onChange={(e) => setEmailNotificationsEnabled(e.target.checked)}
            aria-describedby="email-notifications-hint"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
          />
          <span className="text-sm font-medium">Email notifications</span>
        </label>
        <p id="email-notifications-hint" className="mt-2 pl-7 text-xs text-muted-foreground">
          Mirror in-app notifications (new leads, tasks, comments) to your email address.
        </p>
      </div>

      <div className="space-y-4 rounded-lg bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Business contact people</div>
            <p className="text-xs text-muted-foreground">
              Who members should reach out to. Shown in the directory.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addContact}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {contacts.length === 0 && (
          <p className="text-sm text-muted-foreground">No contacts added yet.</p>
        )}

        <div className="space-y-3">
          {contacts.map((c, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
              <Input
                placeholder="Full name"
                value={c.name}
                onChange={(e) => setContact(i, "name", e.target.value)}
              />
              <Input
                placeholder="Role (optional)"
                value={c.role}
                onChange={(e) => setContact(i, "role", e.target.value)}
              />
              <Input
                placeholder="Phone"
                value={c.phone}
                onChange={(e) => setContact(i, "phone", e.target.value)}
              />
              <Input
                placeholder="Email"
                type="email"
                value={c.email}
                onChange={(e) => setContact(i, "email", e.target.value)}
              />
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive focus:text-destructive"
                  onClick={() => removeContact(i)}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
