"use client";
import dynamic from "next/dynamic";
import type { ChartDatum } from "@/server/metrics";

type Props = { title: string; data: ChartDatum[]; format?: "number" | "currency" };

// Lazily load the recharts chart body so recharts is code-split out of the
// dashboard's first-load bundle. ssr:false because charts are client-only and
// the empty/loading states below render fine without it.
const BarChartInner = dynamic(() => import("./bar-chart"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted" />,
});

export function BarCard({ title, data, format }: Props) {
  const empty = data.every((d) => d.value === 0);
  return (
    <div className="rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4 h-64">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</div>
        ) : (
          <BarChartInner data={data} format={format} />
        )}
      </div>
    </div>
  );
}
