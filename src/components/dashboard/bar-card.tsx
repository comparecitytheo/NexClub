"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import type { ChartDatum } from "@/server/metrics";

type Props = { title: string; data: ChartDatum[]; format?: "number" | "currency" };

function fmt(v: number, format?: string): string {
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

export function BarCard({ title, data, format }: Props) {
  const empty = data.every((d) => d.value === 0);
  return (
    <div className="rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4 h-64">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
