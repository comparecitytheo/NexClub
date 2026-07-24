import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Always evaluated at request time — never cached or prerendered.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up", time: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "down", time: new Date().toISOString() },
      { status: 503 }
    );
  }
}
