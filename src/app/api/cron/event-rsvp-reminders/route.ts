import { NextResponse } from "next/server";
import { sendRsvpReminders, isMonday } from "@/server/events/rsvp-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly RSVP reminders, triggered by the scheduler on Mondays.
 *
 * Same CRON_SECRET protection as the other jobs: without the check this would
 * be a public endpoint that could email the whole club on demand, so it refuses
 * to run when the secret is unset rather than defaulting open.
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

  // The schedule already targets Monday; this guard means a daily or retried
  // schedule cannot chase members mid-week.
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && !isMonday()) {
    return NextResponse.json({ ok: true, skipped: "not Monday" });
  }

  const result = await sendRsvpReminders();
  return NextResponse.json({ ok: true, ...result });
}
