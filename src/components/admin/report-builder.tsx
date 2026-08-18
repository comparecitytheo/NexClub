"use client";
import { useMemo, useState } from "react";
import { BarChart3, Plus, Play, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ReportBlock } from "@/components/admin/club-report";
import { CustomResults } from "@/components/admin/custom-results";
import { CustomReportDocument } from "@/components/admin/custom-report-document";
import { DateTimeField } from "@/components/shared/date-time-field";
import { DownloadCustomReportButton } from "@/components/admin/download-custom-report-button";

export type MetricOption = { key: string; title: string; category: string };
export type BusinessOption = { key: string; name: string; director: string };
export type ChapterOption = { id: string; name: string };
export type MemberOption = { id: string; name: string; businessName: string | null };
export type SavedReportSummary = {
  id: string;
  name: string;
  metricKeys: string[];
  businessKey: string | null;
  rangeDays: number | null;
};

const RANGES = [7, 30, 90] as const;

const CATEGORY_LABEL: Record<string, string> = {
  revenue: "Revenue",
  referral: "Referrals",
  member: "Members",
  financial: "Financial",
};

/**
 * Custom report builder.
 *
 * Deliberately independent of the club-wide cards above it: its own scope and
 * range, its own results, its own PDF. It shares exactly one thing with them —
 * the calculation, via /api/admin/reports/run, which calls the same runReport
 * the cards use so the numbers cannot disagree.
 */
export function ReportBuilder({
  metrics,
  businesses,
  chapters,
  members,
  savedReports,
}: {
  metrics: MetricOption[];
  businesses: BusinessOption[];
  chapters: ChapterOption[];
  members: MemberOption[];
  savedReports: SavedReportSummary[];
}) {
  // Highlighted in the left tree. Separate from `chosen`: highlighting is not
  // adding, which is the distinction that was missing before.
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  // Three scopes, mutually exclusive: choosing one clears the others, because
  // "Webb Financial AND The Shire AND Priya" has no coherent meaning.
  const [businessKey, setBusinessKey] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [blocks, setBlocks] = useState<ReportBlock[] | null>(null);
  const [ranScope, setRanScope] = useState<string | null>(null);
  const [ranAt, setRanAt] = useState<{ from: string; to: string } | null>(null);
  const [running, setRunning] = useState(false);

  const [saved, setSaved] = useState(savedReports);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  const byCategory = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? metrics.filter((x) => x.title.toLowerCase().includes(q)) : metrics;
    const m = new Map<string, MetricOption[]>();
    for (const opt of list) {
      const list = m.get(opt.category) ?? [];
      list.push(opt);
      m.set(opt.category, list);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [metrics, search]);

  const titleOf = (key: string) => metrics.find((m) => m.key === key)?.title ?? key;

  function addMetric() {
    if (!active) {
      toast.error("Choose a metric on the left first.");
      return;
    }
    if (chosen.includes(active)) {
      toast.error(`${titleOf(active)} is already in this report.`);
      return;
    }
    if (chosen.length >= 12) {
      toast.error("Twelve metrics is the limit for one report.");
      return;
    }
    setChosen((c) => [...c, active]);
    // Results no longer match the metric list, so clear them rather than leave
    // stale figures on screen next to a changed selection.
    setBlocks(null);
  }

  /** Only one scope at a time — the three are alternatives, not filters that stack. */
  function pickScope(kind: "business" | "chapter" | "member", value: string) {
    setBusinessKey(kind === "business" ? value : "");
    setChapterId(kind === "chapter" ? value : "");
    setMemberId(kind === "member" ? value : "");
    setBlocks(null);
  }

  function removeMetric(key: string) {
    setChosen((c) => c.filter((k) => k !== key));
    setBlocks(null);
  }

  async function run() {
    if (chosen.length === 0) {
      toast.error("Add at least one metric first.");
      return;
    }
    setRunning(true);
    try {
      const params = new URLSearchParams({ metricKeys: chosen.join(",") });
      if (memberId) params.set("memberId", memberId);
      else if (chapterId) params.set("chapterId", chapterId);
      else if (businessKey) params.set("businessKey", businessKey);
      // A custom range wins over the day presets; the server falls back to
      // rangeDays when no explicit dates arrive.
      if (rangeDays === 0 && customFrom && customTo) {
        params.set("from", new Date(customFrom).toISOString());
        params.set("to", new Date(customTo).toISOString());
      } else {
        params.set("rangeDays", String(rangeDays || 30));
      }
      const res = await fetch(`/api/admin/reports/run?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not run that report.");
        return;
      }
      setBlocks(data.blocks ?? []);
      setRanScope(data.scopeName ?? null);
      setRanAt({ from: data.from, to: data.to });
      if (data.skipped?.length) {
        toast.error(`${data.skipped.length} metric(s) no longer exist and were skipped.`);
      }
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setRunning(false);
    }
  }

  async function save() {
    const name = saveName.trim();
    if (!name) {
      toast.error("Give the report a name.");
      return;
    }
    if (chosen.length === 0) {
      toast.error("Add at least one metric first.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/reports/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, metricKeys: chosen, businessKey: businessKey || undefined, rangeDays }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not save that report.");
      return;
    }
    setSaved((s) => [data.report, ...s]);
    setSaveName("");
    toast.success(`${name} saved.`);
  }

  function load(r: SavedReportSummary) {
    // A saved report may name a metric that has since been removed from the
    // code; drop those rather than showing a chip that can never run.
    const live = r.metricKeys.filter((k) => metrics.some((m) => m.key === k));
    const dropped = r.metricKeys.length - live.length;
    setChosen(live);
    setBusinessKey(r.businessKey ?? "");
    setRangeDays(r.rangeDays ?? 30);
    setBlocks(null);
    setActive(null);
    if (dropped > 0) toast.error(`${dropped} metric(s) in that report no longer exist.`);
    else toast.success(`${r.name} loaded. Press Run to see current figures.`);
  }

  async function remove(r: SavedReportSummary) {
    if (!confirm(`Delete the saved report ${r.name}?`)) return;
    const res = await fetch(`/api/admin/reports/saved/${r.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete that report.");
      return;
    }
    setSaved((s) => s.filter((x) => x.id !== r.id));
    toast.success(`${r.name} deleted.`);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-4 w-4 text-primary" /> Custom report
          </h2>
          <p className="text-sm text-muted-foreground">
            Build your own from any of the {metrics.length} metrics. Independent of the figures above.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
        {/* Left: the metric tree ------------------------------------------ */}
        <div className="rounded-xl bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Available metrics ({metrics.length})
          </p>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search metrics"
            className="mb-2 h-8"
          />
          <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
            {byCategory.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No metric matches &ldquo;{search}&rdquo;.
              </p>
            )}
            {byCategory.map(([category, opts]) => (
              <div key={category}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABEL[category] ?? category}
                </p>
                <ul className="space-y-0.5">
                  {opts.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        onClick={() => setActive(o.key)}
                        aria-pressed={active === o.key}
                        className={cn(
                          "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          active === o.key
                            ? "bg-primary text-primary-foreground"
                            : chosen.includes(o.key)
                              ? "text-muted-foreground"
                              : "hover:bg-accent"
                        )}
                      >
                        {o.title}
                        {chosen.includes(o.key) ? " ·" : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Button className="mt-3 w-full" onClick={addMetric} disabled={!active}>
            <Plus className="h-4 w-4" /> Add metric
          </Button>
        </div>

        {/* Right: scope, chosen metrics, actions --------------------------- */}
        <div className="space-y-4">
          <div className="rounded-xl bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Three scopes, one at a time. Choosing any clears the others. */}
              <div className="space-y-1.5">
                <Label htmlFor="rb-business">Business</Label>
                <select id="rb-business" value={businessKey}
                  onChange={(e) => pickScope("business", e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">All businesses</option>
                  {businesses.map((b) => (
                    <option key={b.key} value={b.key}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rb-chapter">Chapter</Label>
                <select id="rb-chapter" value={chapterId}
                  onChange={(e) => pickScope("chapter", e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">All chapters</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rb-member">Member</Label>
                <select id="rb-member" value={memberId}
                  onChange={(e) => pickScope("member", e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">All members</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.businessName ? ` — ${m.businessName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <Label>Period</Label>
              <div className="flex flex-wrap gap-1.5">
                {RANGES.map((d) => (
                  <button key={d} type="button"
                    onClick={() => { setRangeDays(d); setBlocks(null); }}
                    className={cn("h-9 rounded-md border px-4 text-sm transition-colors",
                      rangeDays === d ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent")}>
                    {d} days
                  </button>
                ))}
                <button type="button"
                  onClick={() => { setRangeDays(0); setBlocks(null); }}
                  className={cn("h-9 rounded-md border px-4 text-sm transition-colors",
                    rangeDays === 0 ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent")}>
                  Custom range
                </button>
              </div>
              {rangeDays === 0 && (
                <div className="grid gap-2 pt-1 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="rb-from">From</Label>
                    <DateTimeField id="rb-from" value={customFrom}
                      onChange={(v) => { setCustomFrom(v); setBlocks(null); }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rb-to">To</Label>
                    <DateTimeField id="rb-to" value={customTo}
                      onChange={(v) => { setCustomTo(v); setBlocks(null); }} />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                In this report ({chosen.length})
              </p>
              {chosen.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing added yet. Pick a metric on the left and press Add metric.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {chosen.map((k) => (
                    <li
                      key={k}
                      className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-sm"
                    >
                      {titleOf(k)}
                      <button
                        type="button"
                        onClick={() => removeMetric(k)}
                        aria-label={`Remove ${titleOf(k)}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={run} disabled={running || chosen.length === 0}>
                <Play className="h-4 w-4" /> {running ? "Running…" : "Run"}
              </Button>
              {/* Disabled until a run exists — there is nothing to export before
                  then, and an empty PDF is worse than no button. */}
              <DownloadCustomReportButton
                ready={Boolean(blocks && blocks.length > 0)}
                metricCount={chosen.length}
              />
              <span className="ml-auto flex items-center gap-2">
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Name to save as"
                  className="h-9 w-44"
                />
                <Button variant="outline" onClick={save} disabled={saving || chosen.length === 0}>
                  <Save className="h-4 w-4" /> Save
                </Button>
              </span>
            </div>
          </div>

          {saved.length > 0 && (
            <div className="rounded-xl bg-card p-4 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Saved reports
              </p>
              <ul className="divide-y">
                {saved.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.metricKeys.length} metric{r.metricKeys.length === 1 ? "" : "s"}
                        {r.businessKey ? ` · ${r.businessKey}` : " · club-wide"}
                        {r.rangeDays ? ` · ${r.rangeDays} days` : ""}
                      </span>
                    </span>
                    <Button size="sm" variant="outline" onClick={() => load(r)}>
                      Load
                    </Button>
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      aria-label={`Delete ${r.name}`}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Results. Rendered with the same ClubReport component the cards use, so
          bars, tables, KPIs and the donut all behave identically. */}
      {blocks && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {ranScope ?? "Club-wide"} · {chosen.length} metric{chosen.length === 1 ? "" : "s"}
            {ranAt ? ` · ${new Date(ranAt.from).toLocaleDateString("en-AU")}–${new Date(ranAt.to).toLocaleDateString("en-AU")}` : ""}
          </p>
          {/* On paper: the same document design as the club-wide export. */}
          <CustomReportDocument
            blocks={blocks}
            scope={ranScope}
            from={ranAt ? new Date(ranAt.from) : null}
            to={ranAt ? new Date(ranAt.to) : null}
          />

          {blocks.length === 0 ? (
            <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
              No data for those metrics in this period.
            </p>
          ) : (
            <CustomResults blocks={blocks} />
          )}
        </div>
      )}
    </section>
  );
}
