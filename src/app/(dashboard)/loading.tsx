import { Skeleton } from "@/components/ui/skeleton";

// Shown automatically by the App Router while any dashboard tab's server
// component is fetching. The layout (sidebar + header) stays put; only this
// content area animates, giving instant feedback on every navigation. The shape
// (title + stat row + list card) mirrors the common page layout so the swap to
// real content feels seamless.
const CARD = "rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]";

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      {/* Indeterminate bar that slides across the top for the whole load. */}
      <div className="nex-loadbar" aria-hidden />

      {/* Page title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={CARD}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>

      {/* List / table block */}
      <div className={CARD}>
        <Skeleton className="h-5 w-40" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
