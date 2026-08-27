import { BusinessLogo } from "@/components/shared/business-logo";
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";
import { Mail, Phone } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { tierOf, TIER_LABELS } from "@/lib/rbac";

export type DirectoryMember = {
  id: string;
  name: string;
  role: UserRole;
  /** Authority on membership. Prefer this over businessName for grouping. */
  businessId: string | null;
  businessName: string | null;
  industry: string | null;
  services: string | null;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  businessLogoUrl: string | null;
  /** Logo owner named by the business itself; wins over businessLogoUrl. */
  businessLogoUserId?: string | null;
  /** The business record, carrying the chapter it belongs to. */
  business?: { logoUserId: string | null; chapter: { id: string; name: string } | null } | null;
};

export type Business = {
  key: string;
  name: string;
  industry: string | null;
  /** The chapter this business is in — a location, so it belongs to the
      business rather than to each member. */
  chapter: { id: string; name: string } | null;
  /** Member whose uploaded logo represents this business (first one that has one). */
  logoUserId: string | null;
  members: DirectoryMember[];
};

// One business section: name + industry, the services offered, and the list of
// people (the member(s) — shown with their profile photo — plus the contacts
// each member maintains for that business).
export function BusinessCard({ business }: { business: Business }) {
  // Split once, so the headings and the lists can never disagree about who
  // belongs where.
  const directors = business.members.filter((m) => tierOf(m.role) !== "EMPLOYEE");
  const staff = business.members.filter((m) => tierOf(m.role) === "EMPLOYEE");
  // De-duplicate services across any members that share this business.
  const services = Array.from(
    new Set(business.members.map((m) => m.services?.trim()).filter((s): s is string => Boolean(s)))
  );

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {/* Shared component: initials fall back in a tinted square when a
                business has no logo, so cards never sit at different heights. */}
            <BusinessLogo name={business.name} logoUserId={business.logoUserId} />
            <span className="flex min-w-0 items-baseline gap-2">
              <CardTitle className="text-base">{business.name}</CardTitle>
              {business.chapter ? (
                <span className="shrink-0 text-xs text-muted-foreground">{business.chapter.name}</span>
              ) : null}
            </span>
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
          {/* Split so staff read as staff: directors first, then everyone else.
              The Directors block is skipped entirely when a business has none,
              rather than leaving a heading with nothing under it. */}
          {directors.length > 0 && (
            <>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Directors
          </div>
          <div className="mt-2 space-y-3">
            {directors.map((m) => (
              <PersonRow
                  key={m.id}
                  avatar={
                    <MemberAvatar userId={m.id} name={m.name} avatarUrl={m.avatarUrl} className="h-11 w-11" />
                  }
                  name={m.name}
                    subtitle={TIER_LABELS[tierOf(m.role)]}
                  phone={m.phone}
                />
            ))}
          </div>
            </>
          )}

          {/* Staff. Headed "People" when there are no directors, so a business
              without one never shows a lone "Staff" group under nothing. */}
          {staff.length > 0 && (
            <>
              <div
                className={cn(
                  "text-xs font-medium uppercase tracking-wide text-muted-foreground",
                  directors.length > 0 && "mt-4"
                )}
              >
                {directors.length > 0 ? "Staff" : "People"}
              </div>
              <div className="mt-2 space-y-3">
                {staff.map((m) => (
                    <PersonRow
                        key={m.id}
                        avatar={
                          <MemberAvatar
                            userId={m.id}
                            name={m.name}
                            avatarUrl={m.avatarUrl}
                            className="h-11 w-11"
                          />
                        }
                        name={m.name}
                        subtitle={m.services || "Staff"}
                        phone={m.phone}
                      />
                  ))}
              </div>
            </>
          )}
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
