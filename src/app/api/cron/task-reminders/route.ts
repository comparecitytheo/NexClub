import { NextResponse } from "next/server";
import { sendOverdueTaskReminders } from "@/server/tasks/overdue-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Overdue task reminders, triggered by the scheduler.
 *
 * Runs DAILY, but each task is only chased every 2nd day — the interval is
 * tracked per task via `lastOverdueReminderAt`, not by how often this runs. That
 * keeps the cadence correct even if a run is missed or retried.
 *
 * Same protection as the archival cron: Vercel sends a bearer token matching
 * CRON_SECRET, and the route refuses to run if that secret is unset rather than
 * sitting exposed as a public endpoint that can email your whole club.
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

  const result = await sendOverdueTaskReminders();
  return NextResponse.json({ ok: true, ...result });
}
