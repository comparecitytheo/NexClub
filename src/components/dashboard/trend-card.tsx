"use client";
import dynamic from "next/dynamic";

// Lazily load the recharts chart body so recharts is code-split out of the
// dashboard's first-load bundle.
const TrendChartInner = dynamic(() => import("./trend-chart"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted" />,
});

export function TrendCard({ title, data }: { title: string; data: { label: string; value: number }[] }) {
  return (
    <div className="rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4 h-56">
        <TrendChartInner data={data} />
      </div>
    </div>
  );
}
