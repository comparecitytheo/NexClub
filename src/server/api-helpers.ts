import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin, isSuperAdmin } from "@/lib/rbac";

// Each guard returns either { user } or { error: NextResponse }. Routes do:
//   const a = await requireAdmin();
//   if ("error" in a) return a.error;
//   const { user } = a;
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  return { user: session.user } as const;
}

export async function requireAdmin() {
  const result = await requireUser();
  if ("error" in result) return result;
  if (!isAdmin(result.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return result;
}

// Only SUPER_ADMIN passes. Used to protect announcement editing server-side.
export async function requireSuperAdmin() {
  const result = await requireUser();
  if ("error" in result) return result;
  if (!isSuperAdmin(result.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return result;
}
