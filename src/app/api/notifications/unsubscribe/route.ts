import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unsubscribeTokenMatches } from "@/lib/unsubscribe";

export const runtime = "nodejs";

// One-click unsubscribe for notification emails.
//
// The Spam Act expects an unsubscribe that works without undue effort, so this
// cannot require signing in — the person may be reading on a phone, logged out.
// Instead the link carries a token derived from the user id and AUTH_SECRET, so
// it is unforgeable but needs no session. The token only ever turns notifications
// OFF, so the worst a leaked link can do is stop someone's email.

function page(title: string, message: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="color-scheme" content="light">` +
      `<title>${title}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;background:#f6f6f7;color:#0a0a0a;margin:0;padding:48px 16px">` +
      `<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;` +
      `box-shadow:0 6px 20px rgba(0,0,0,0.16)">` +
      `<h1 style="margin:0 0 12px;font-size:20px">${title}</h1>` +
      `<p style="margin:0;font-size:14px;line-height:1.5">${message}</p>` +
      `</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";

  if (!userId || !token || !unsubscribeTokenMatches(userId, token)) {
    return page(
      "Link not recognised",
      "This unsubscribe link is invalid or has expired. You can turn email notifications off at any time from your profile settings."
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return page(
      "Link not recognised",
      "We could not find that account. It may have been removed."
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { emailNotificationsEnabled: false },
  });

  return page(
    "You're unsubscribed",
    "You will no longer receive notification emails from NEX Club. You will still see notifications in the app, " +
      "and you can turn email back on at any time from your profile settings."
  );
}
