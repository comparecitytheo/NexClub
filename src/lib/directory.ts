import type { Business, DirectoryMember } from "@/components/directory/business-card";

// Group directory members into businesses by businessName (case-insensitive). A
// member with no businessName stands alone as a single-person business, so a
// member invited by a business admin (who carries that admin's businessName)
// groups under that same business. The business's industry is taken from its
// members' industry — a member created with a brand-new industry therefore shows
// that industry on the business card, exactly like an existing one. Input is
// expected pre-sorted by businessName then name; Map insertion order then keeps
// the businesses alphabetical.
export function groupBusinesses(members: DirectoryMember[]): Business[] {
  const map = new Map<string, Business>();
  for (const m of members) {
    // Group by the business ID where there is one. Name matching remains only
    // as a fallback for members not yet linked to a business row — after the
    // backfill that should be nobody, but it keeps the directory sane if a
    // member is created outside the invite flow.
    const named = m.businessName?.trim();
    const key = m.businessId
      ? `b:${m.businessId}`
      : named
        ? `b:name:${named.toLowerCase()}`
        : `m:${m.id}`;
    let g = map.get(key);
    if (!g) {
      g = { key, name: named || m.name, industry: m.industry, chapter: m.business?.chapter ?? null, logoUserId: null, members: [] };
      map.set(key, g);
    }
    if (!g.industry && m.industry) g.industry = m.industry;
    // WHERE A BUSINESS ROW EXISTS, it names its own logo owner and nothing else
    // is consulted. The old behaviour — take whichever member happened to have a
    // logo — is what made the choice arbitrary when colleagues both uploaded.
    //
    // Members with NO business row are their own group of one, so using their own
    // logo is not arbitrary: there is nobody else it could belong to.
    if (!g.logoUserId) {
      g.logoUserId = m.businessId
        ? (m.businessLogoUserId ?? null)
        : (m.businessLogoUrl ? m.id : null);
    }
    g.members.push(m);
  }
  return Array.from(map.values());
}
