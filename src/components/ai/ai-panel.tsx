"use client";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export function AiPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-card p-5 border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}
