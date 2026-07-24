// SINGLE SOURCE OF TRUTH for member/business industries.
//
// Edit this one list to change BOTH the "Industry" dropdown on the Member
// Directory and the "Industry" selector on the signup form — they each read
// from here, so the options never drift apart.
//
// Brief-guidance for what each bucket covers: "Finance" is inclusive of
// financial planning and related disciplines; "Medical" is inclusive of
// physiotherapy and related disciplines; "Accounting" is its own bucket.
//
// (If you later want these admin-managed from the database instead, replace
//  this constant with a query and keep the same exported shape.)
export const INDUSTRIES = [
  "Automotive",
  "Construction",
  "Consulting",
  "Education",
  "Finance",
  "Hospitality",
  "Information Technology",
  "Legal",
  "Marketing & Advertising",
  "Medical",
  "Real Estate",
  "Retail",
  "Accounting",
  "Other",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

// Sentinel the Member Directory's Industry filter uses to mean "no filter".
// Selecting "All Industries" sets the control to this value, which shows every
// business — including those with a null or legacy (off-list) industry.
export const ALL_INDUSTRIES = "all";
