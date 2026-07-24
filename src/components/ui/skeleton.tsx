import { cn } from "@/lib/utils";

// Pulsing placeholder block. Compose several to sketch a page's layout while it
// loads. Uses Tailwind's built-in `animate-pulse`.
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
