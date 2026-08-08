import { cn } from "@/lib/utils";

/**
 * A business, shown the same way everywhere.
 *
 * The logo is a property of the BUSINESS (Business.logoUserId names the member
 * whose upload represents it), so every screen resolves the same image rather
 * than whichever colleague happened to upload one. Falls back to initials in a
 * tinted square — square, not round, so a business never reads as a person.
 */
export function BusinessLogo({
  name,
  logoUserId,
  className,
}: {
  name: string;
  /** The member whose upload represents this business, or null for initials. */
  logoUserId: string | null;
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (logoUserId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/users/${logoUserId}/business-logo`}
        alt={name}
        className={cn("h-10 w-10 shrink-0 rounded-md object-contain", className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-bold text-primary",
        className
      )}
    >
      {initials}
    </span>
  );
}
