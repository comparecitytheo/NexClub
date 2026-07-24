import { NextResponse } from "next/server";

// Public self-registration is disabled. Accounts are created ONLY by accepting an
// invitation (POST /api/invitations/accept), which requires a valid, unexpired,
// single-use token. This endpoint is retired and rejects every request so no
// account can be created without a token — enforced here at the server layer.
export async function POST() {
  return NextResponse.json(
    { error: "Public registration is disabled. Accounts are created by invitation only." },
    { status: 403 }
  );
}

export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
