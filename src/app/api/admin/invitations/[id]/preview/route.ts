import { NextResponse } from "next/server";

// The invite preview step was removed: invitations are now sent directly from the
// invite form ("Confirm and Send"). This endpoint is retired and responds 410 Gone
// so any stale caller fails clearly. Nothing in the app calls it.
export async function GET() {
  return NextResponse.json({ error: "The invitation preview endpoint has been removed." }, { status: 410 });
}
