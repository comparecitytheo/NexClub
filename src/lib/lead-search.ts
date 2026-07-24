// Single source of truth for lead-board search, shared by the My Leads and
// Sent Leads boards so their behaviour can never drift apart.
//
// Matching rules: case-insensitive partial match (substring) across the fields
// below, OR'd together. An empty/whitespace-only query matches everything.
export const LEAD_SEARCH_FIELDS = ["contactName", "company", "email", "phone"] as const;

type SearchableLead = Partial<Record<(typeof LEAD_SEARCH_FIELDS)[number], string | null>>;

export function leadMatchesQuery(lead: SearchableLead, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return LEAD_SEARCH_FIELDS.some((field) => lead[field]?.toLowerCase().includes(q));
}
