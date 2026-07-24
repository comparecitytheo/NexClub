import { formatCurrency } from "@/lib/format";

/**
 * Shared Kanban column header for BOTH the Leads (received) and Sent Leads boards.
 *
 * Extracted into a single component so the heading is guaranteed pixel-identical
 * across the two views — same font, padding, border and layout — and can never
 * drift apart again. The stage's colour is applied to the header TEXT
 * (no background fill), driven by stage value via STAGE_COLORS in lib/labels, so
 * My Leads and Sent Leads show identical colours for the same stage. Only the
 * label, count and column total vary per column.
 *
 * Rendered as the first child INSIDE each column's scroll container with
 * `position: sticky; top: 0`, so it stays pinned to the top while the cards
 * scroll underneath. It has a solid bg-muted fill (matching the column surface), so cards scrolling under this sticky header are
 * cleanly masked instead of bleeding through.
 */
export function ColumnHeader({
  bg,
  label,
  count,
  total,
}: {
  bg: string;
  fg: string;
  label: string;
  count: number;
  total: number;
}) {
  return (
    <div
      className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b bg-muted px-3 py-2"
      style={{ color: bg }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs opacity-80">{count}</span>
      </div>
      {total > 0 && <span className="text-xs opacity-80">{formatCurrency(total)}</span>}
    </div>
  );
}
