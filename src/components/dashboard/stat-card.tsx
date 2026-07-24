import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  hint,
  breakdown,
  icon: Icon,
  tone = "default",
  className,
}: {
  title: string;
  value: string;
  hint?: string;
  breakdown?: { label: string; value: string; color?: string }[];
  icon: LucideIcon;
  tone?: "default" | "emerald" | "rose";
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]", className)}>
      <div className="flex items-center justify-between">
        <p data-card-title className="text-sm text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className={cn("mt-2 text-2xl font-bold", tone === "emerald" && "text-emerald-600", tone === "rose" && "text-rose-600")}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {breakdown && breakdown.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t pt-3">
          {breakdown.map((b) => (
            <div key={b.label}>
              <p className="text-xs text-muted-foreground">{b.label}</p>
              <p className="text-base font-semibold" style={b.color ? { color: b.color } : undefined}>{b.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
