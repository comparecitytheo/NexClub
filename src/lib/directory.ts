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
    const named = m.businessName?.trim();
    const key = named ? `b:${named.toLowerCase()}` : `m:${m.id}`;
    let g = map.get(key);
    if (!g) {
      g = { key, name: named || m.name, industry: m.industry, logoUrl: null, members: [] };
      map.set(key, g);
    }
    if (!g.industry && m.industry) g.industry = m.industry;
    if (!g.logoUrl && m.businessLogoUrl) g.logoUrl = m.businessLogoUrl;
    g.members.push(m);
  }
  return Array.from(map.values());
}
