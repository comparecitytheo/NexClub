// Best-effort client IP + user agent for audit records. On Vercel/most proxies
// the real client IP is the first entry of x-forwarded-for.
export function getClientContext(req: Request): { ipAddress: string | null; userAgent: string | null } {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0]?.trim() : "") || h.get("x-real-ip") || null;
  return { ipAddress: ip || null, userAgent: h.get("user-agent") };
}
