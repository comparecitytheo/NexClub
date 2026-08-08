import { NextResponse } from "next/server";
import { archiveLapsedLeads, isFirstOfMonth } from "@/server/leads/archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Month-lapse archival, triggered by the scheduler.
 *
 * There is no queue or worker anywhere in this project, so the schedule lives
 * with the host. On Vercel (which the build targets) that is Vercel Cron, which
 * calls this route on the 1st — see the `crons` entry in vercel.json. Vercel
 * sends a bearer token matching CRON_SECRET; without that check this would be a
 * public write endpoint, so it refuses to run when the secret is unset rather
 * than defaulting open.
 *
 * For the Docker image, run `npm run archive:leads` from the host's own cron
 * instead — identical logic, no HTTP involved.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to run." },
      { status: 503 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && !isFirstOfMonth()) {
    return NextResponse.json({ ok: true, skipped: "not the 1st of the month" });
  }

  const result = await archiveLapsedLeads();
  return NextResponse.json({ ok: true, ...result });
}
