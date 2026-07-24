import { Fragment, type ReactNode } from "react";
import { Mail, Phone } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { initials } from "@/lib/format";
import { tierOf, TIER_LABELS } from "@/lib/rbac";

export type DirectoryContact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
};

export type DirectoryMember = {
  id: string;
  name: string;
  role: UserRole;
  businessName: string | null;
  industry: string | null;
  services: string | null;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  businessLogoUrl: string | null;
  businessContacts: DirectoryContact[];
};

export type Business = {
  key: string;
  name: string;
  industry: string | null;
  /** URL of the first member-uploaded logo that represents this business. */
  logoUrl: string | null;
  members: DirectoryMember[];
};

// One business section: name + industry, the services offered, and the list of
// people (the member(s) — shown with their profile photo — plus the contacts
// each member maintains for that business).
export function BusinessCard({ business }: { business: Business }) {
  // De-duplicate services across any members that share this business.
  const services = Array.from(
    new Set(business.members.map((m) => m.services?.trim()).filter((s): s is string => Boolean(s)))
  );

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {business.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={business.logoUrl}
                alt={`${business.name} logo`}
                className="h-10 w-10 shrink-0 rounded-md object-contain"
              />
            ) : null}
            <CardTitle className="text-base">{business.name}</CardTitle>
          </div>
          {business.industry ? (
            // Industry as a contained badge: reuses the menu burgundy (bg-sidebar,
            // the same token the label text used) with the Badge component's white
            // text + rounded-md + padding. White on #7B1E3A is ~9.5:1 (AA pass).
            <Badge className="shrink-0 bg-sidebar text-[10px]">{business.industry}</Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {services.length > 0 ? (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Services</div>
            {services.map((s, i) => (
              <p key={i} className="mt-1 whitespace-pre-line text-sm">
                {s}
              </p>
            ))}
          </div>
        ) : null}

        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">People</div>
          <div className="mt-2 space-y-3">
            {business.members.map((m) => (
              <Fragment key={m.id}>
                <PersonRow
                  avatar={
                    <MemberAvatar userId={m.id} name={m.name} avatarUrl={m.avatarUrl} className="h-9 w-9" />
                  }
                  name={m.name}
                  subtitle={TIER_LABELS[tierOf(m.role)]}
                  phone={m.phone}
                />
                {m.businessContacts.map((c) => (
                  <PersonRow
                    key={c.id}
                    avatar={
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{initials(c.name)}</AvatarFallback>
                      </Avatar>
                    }
                    name={c.name}
                    subtitle={c.role}
                    phone={c.phone}
                    email={c.email}
                  />
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// One person line: avatar + name/role + tappable contact links. Shared by the
// member (with their profile photo) and their business contacts (initials only).
function PersonRow({
  avatar,
  name,
  subtitle,
  phone,
  email,
}: {
  avatar: ReactNode;
  name: string;
  subtitle?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-tight">
          {name}
          {subtitle ? <span className="font-normal text-muted-foreground"> · {subtitle}</span> : null}
        </div>
        {phone || email ? (
          <div className="mt-1 flex flex-col gap-0.5">
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {phone}
              </a>
            ) : null}
            {email ? (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {email}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
