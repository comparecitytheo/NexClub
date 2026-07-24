"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import type { ChartDatum } from "@/server/metrics";

export function fmt(v: number, format?: string): string {
  if (format === "currency") {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
      notation: v >= 10000 ? "compact" : "standard",
    }).format(v);
  }
  return String(v);
}

// Recharts-only chart body. Split out of BarCard and dynamically imported so the
// recharts bundle (~350 KB with its d3 deps) stays out of the dashboard's
// first-load JS.
export default function BarChartInner({ data, format }: { data: ChartDatum[]; format?: "number" | "currency" }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f3" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={52} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={format === "currency" ? 56 : 32} tickFormatter={(v) => fmt(Number(v), format)} />
        <Tooltip formatter={(v) => fmt(Number(v), format)} cursor={{ fill: "rgba(124,58,237,0.06)" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
