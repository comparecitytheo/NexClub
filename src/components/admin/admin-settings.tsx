"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type FeatureKey = "leads" | "deals" | "contacts" | "companies" | "tasks" | "events";
type Settings = {
  branding: { companyName: string; supportEmail: string };
  defaultSignupRole: "MANAGER" | "SALES_REP" | "SUPPORT_AGENT";
  security: { passwordMinLength: number; sessionTimeoutMinutes: number };
  smtp: { host: string; port: number; user: string; from: string };
  features: Record<FeatureKey, boolean>;
};

const FEATURES: { key: FeatureKey; label: string }[] = [
  { key: "leads", label: "Leads" },
  { key: "deals", label: "Deals" },
  { key: "contacts", label: "Contacts" },
  { key: "companies", label: "Companies" },
  { key: "tasks", label: "Tasks" },
  { key: "events", label: "NEX Events" },
];
const SIGNUP_ROLES: [Settings["defaultSignupRole"], string][] = [
  ["SALES_REP", "Sales Rep"],
  ["SUPPORT_AGENT", "Support Agent"],
  ["MANAGER", "Manager"],
];

export function AdminSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [integrations, setIntegrations] = useState<{ email: boolean; ai: boolean; storage: boolean } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setS(data.settings);
        setIntegrations(data.integrations ?? null);
      } catch {
        toast.error("Could not load settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    if (!s) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Could not save settings.");
      setS(data.settings);
      setIntegrations(data.integrations ?? integrations);
      toast.success("Settings saved.");
    } finally {
      setBusy(false);
    }
  }

  async function resetDefaults() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Could not reset settings.");
      setS(data.settings);
      setIntegrations(data.integrations ?? null);
      setConfirmReset(false);
      toast.success("Settings reset to defaults.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !s) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <Section title="Branding" desc="Shown across the workspace and in member emails.">
        <Field label="Company name">
          <Input value={s.branding.companyName} onChange={(e) => setS({ ...s, branding: { ...s.branding, companyName: e.target.value } })} />
        </Field>
        <Field label="Support email">
          <Input type="email" value={s.branding.supportEmail} onChange={(e) => setS({ ...s, branding: { ...s.branding, supportEmail: e.target.value } })} />
        </Field>
      </Section>

      <Section title="Sign-ups" desc="Role assigned to people who self-register.">
        <Field label="Default role">
          <select className={selectClass} value={s.defaultSignupRole} onChange={(e) => setS({ ...s, defaultSignupRole: e.target.value as Settings["defaultSignupRole"] })}>
            {SIGNUP_ROLES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Security" desc="Password and session policy.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Min password length">
            <Input type="number" min={8} max={128} value={s.security.passwordMinLength} onChange={(e) => setS({ ...s, security: { ...s.security, passwordMinLength: Number(e.target.value) } })} />
          </Field>
          <Field label="Session timeout (min)">
            <Input type="number" min={5} value={s.security.sessionTimeoutMinutes} onChange={(e) => setS({ ...s, security: { ...s.security, sessionTimeoutMinutes: Number(e.target.value) } })} />
          </Field>
        </div>
      </Section>

      <Section title="Email (SMTP)" desc="Outgoing mail server. The SMTP password stays in the server environment and is never stored here.">
        <Field label="Host">
          <Input value={s.smtp.host} onChange={(e) => setS({ ...s, smtp: { ...s.smtp, host: e.target.value } })} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Port">
            <Input type="number" value={s.smtp.port} onChange={(e) => setS({ ...s, smtp: { ...s.smtp, port: Number(e.target.value) } })} />
          </Field>
          <Field label="From address">
            <Input value={s.smtp.from} onChange={(e) => setS({ ...s, smtp: { ...s.smtp, from: e.target.value } })} />
          </Field>
        </div>
        <Field label="Username">
          <Input value={s.smtp.user} onChange={(e) => setS({ ...s, smtp: { ...s.smtp, user: e.target.value } })} />
        </Field>
      </Section>

      <Section title="Modules" desc="Disabled modules are hidden from the menu for everyone.">
        <div className="grid grid-cols-2 gap-2">
          {FEATURES.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.features[f.key]} onChange={(e) => setS({ ...s, features: { ...s.features, [f.key]: e.target.checked } })} />
              {f.label}
            </label>
          ))}
        </div>
      </Section>

      {integrations && (
        <Section title="Integrations" desc="Secrets (API keys, SMTP password) are managed via environment variables and shown masked, never stored in the database.">
          <IntegrationRow label="Email (SMTP)" on={integrations.email} />
          <IntegrationRow label="AI (Anthropic)" on={integrations.ai} />
          <IntegrationRow label="File storage (S3)" on={integrations.storage} />
        </Section>
      )}

      <div className="flex items-center justify-between">
        {confirmReset ? (
          <span className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={resetDefaults} disabled={busy}>Confirm reset</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
          </span>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>Reset to defaults</Button>
        )}
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      {children}
    </section>
  );
}
function IntegrationRow({ label, on }: { label: string; on: boolean }) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      {on ? (
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{reveal ? "configured (value in env)" : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}</span>
          <button type="button" onClick={() => setReveal((r) => !r)} className="text-xs text-primary hover:underline">{reveal ? "Hide" : "Reveal"}</button>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Not configured</span>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
