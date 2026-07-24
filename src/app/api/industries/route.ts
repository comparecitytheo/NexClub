import { NextResponse } from "next/server";
import { requireUser } from "@/server/api-helpers";
import { listIndustryNames } from "@/server/industries";

// Shared industry list for client dropdowns (e.g. the invite dialog). Server
// components read listIndustryNames() directly instead of calling this.
export async function GET() {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const industries = await listIndustryNames();
  return NextResponse.json({ industries });
}
