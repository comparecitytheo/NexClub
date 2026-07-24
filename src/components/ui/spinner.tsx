import { cn } from "@/lib/utils";

// Classic 12-bar circular spinner in the brand burgundy (styles in globals.css
// under .nex-spinner). Each bar is rotated into place and fades on a staggered
// delay so the highlight rotates around the ring.
export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("nex-spinner", className)} role="status" aria-label="Loading">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{ transform: `rotate(${i * 30}deg)`, animationDelay: `${-1.1 + i * 0.1}s` }} />
      ))}
    </div>
  );
}
