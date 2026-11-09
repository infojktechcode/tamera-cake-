import { NextResponse } from "next/server";
import { retryFailedNotifications } from "@/lib/notifications/service";

/**
 * POST /api/cron/retry-notifications
 *
 * Scheduled cron endpoint to retry failed notifications.
 * Secured by CRON_SECRET (Vercel sets Authorization: Bearer <CRON_SECRET>).
 */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await retryFailedNotifications(50);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}