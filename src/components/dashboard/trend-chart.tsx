"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { PRIMARY_HEX } from "@/lib/chart-colors";

// Recharts-only chart body. Split out of TrendCard and dynamically imported so
// the recharts bundle stays out of the dashboard's first-load JS.
export default function TrendChartInner({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY_HEX} stopOpacity={0.3} />
            <stop offset="100%" stopColor={PRIMARY_HEX} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f3" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} width={28} />
        <Tooltip cursor={{ stroke: PRIMARY_HEX }} />
        <Area type="monotone" dataKey="value" stroke={PRIMARY_HEX} strokeWidth={2} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
