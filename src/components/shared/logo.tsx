import { cn } from "@/lib/utils";

/**
 * Centralized brand logo for the whole app.
 *
 * The menu's collapsed/expanded state is already a single global signal: the
 * `sidebar-collapsed` class on <html>, written in exactly one place (the sidebar
 * toggle), persisted to localStorage, and applied before paint by the root
 * layout. This component is the one place that "subscribes" to that signal —
 * it renders the full NEX Club wordmark and, when `swap` is set, also the
 * compact mark, and CSS (globals.css) decides which is visible based on the
 * global state. Because the swap is pure CSS it happens in the same frame as the
 * toggle: no re-render, no lag, and no flash on refresh.
 *
 * Only the sidebar passes `swap`, so logos on pages without a menu (auth,
 * marketing) and the mobile header always show the wordmark — no per-component
 * logic required, just this shared component.
 */
export function Logo({
  className,
  size = "h-7",
  alt = "NEX Club",
  swap = false,
  mark = false,
}: {
  className?: string;
  /** Tailwind height applied to both marks so they line up (default h-7). */
  size?: string;
  alt?: string;
  /** When true, also render the compact mark for the collapsed-rail swap. */
  swap?: boolean;
  /** When true, render ONLY the compact NEX monogram instead of the wordmark
      (used by the mobile header, which has room only for the mark). */
  mark?: boolean;
}) {
  return (
    <span className={cn("logo inline-grid items-center justify-items-center", className)}>
      {mark ? (
        /* Compact NEX monogram only (used by the mobile header). Same brand, so
           the alt text is unchanged. Deliberately omits the logo-full/logo-mark
           classes so the sidebar-collapse CSS never fades it out. */
        <img src="/logo-mark.svg" alt={alt} className={cn("w-auto", size)} />
      ) : (
        <>
          {/* Full wordmark — the default everywhere */}
          <img src="/logo.svg" alt={alt} className={cn("logo-full w-auto", size)} />
          {/* Compact mark — only rendered where a swap can happen (the sidebar);
              CSS reveals it when <html> has `sidebar-collapsed`. */}
          {swap && (
            <img
              src="/logo-mark.svg"
              alt=""
              aria-hidden="true"
              className={cn("logo-mark w-auto", size)}
            />
          )}
        </>
      )}
    </span>
  );
}
