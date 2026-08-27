"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ALL_INDUSTRIES } from "@/lib/industries";

const ALL_CHAPTERS = "__all__";
import { groupBusinesses } from "@/lib/directory";
import { BusinessCard, type DirectoryMember } from "./business-card";

export function MemberDirectory({
  members,
  industries,
  chapters,
}: {
  members: DirectoryMember[];
  industries: string[];
  chapters: string[];
}) {
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState<string>(ALL_INDUSTRIES);
  const [chapter, setChapter] = useState<string>(ALL_CHAPTERS);

  // Group members into businesses by businessName (case-insensitive). A member
  // with no businessName stands alone as a single-person business. Members
  // arrive pre-sorted by businessName then name, so Map insertion order keeps
  // the businesses alphabetical.
  // Grouping lives in a shared, unit-tested helper (see src/lib/directory.ts).
  const businesses = useMemo(() => groupBusinesses(members), [members]);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return businesses.filter((b) => {
      // Industry filter, ANDed with search. "All Industries" applies no filter,
      // so businesses with a null or legacy (off-list) industry still show under it.
      if (industry !== ALL_INDUSTRIES && b.industry !== industry) return false;
      // Chapter belongs to the BUSINESS — it is where the business is, so it
      // filters whole businesses rather than individual people.
      if (chapter !== ALL_CHAPTERS && b.chapter?.name !== chapter) return false;
      if (!t) return true;
      return [
        b.name,
        b.industry,
        ...b.members.flatMap((m) => [m.name, m.services, m.bio]),
      ].some((s) => s != null && s.toLowerCase().includes(t));
    });
  }, [q, industry, chapter, businesses]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search businesses, members, services…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="industry-filter" className="shrink-0 text-sm text-muted-foreground">
            Industry
          </label>
          <select
            id="industry-filter"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
          >
            <option value={ALL_INDUSTRIES}>All Industries</option>
            {industries.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {/* Only shown once chapters exist, so a club that never sets them up is
            not given a filter with one useless option. */}
        {chapters.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="chapter-filter" className="shrink-0 text-sm text-muted-foreground">
              Chapter
            </label>
            <select
              id="chapter-filter"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
            >
              <option value={ALL_CHAPTERS}>All Chapters</option>
              {chapters.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No businesses match your filters.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((b) => (
            <BusinessCard key={b.key} business={b} />
          ))}
        </div>
      )}
    </div>
  );
}
