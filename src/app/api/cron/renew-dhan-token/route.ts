import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/api/cronAuth";
import { getDhanAccessToken } from "@/lib/sources/dhanToken";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Dhan access tokens last exactly 24h, and the main pipeline (ingest.ts's ingestDhanMcx) only
 * gets one renewal attempt per day, at whatever moment its cron actually fires. Confirmed live
 * (2026-09-29): three straight days of ingest_dhan_mcx HTTP 401 after the token issued at the
 * 2026-09-25 run had expired by the time the 2026-09-26 run tried to renew it — Dhan's own
 * RenewToken call requires a still-valid token, so once one lapses the chain can't self-heal
 * without a human pasting a fresh token.
 *
 * A same-project Vercel cron running more often than daily was tried first and rejected at
 * deploy time: Hobby-plan projects are capped at once-per-day cron jobs (confirmed via Vercel's
 * own docs after the deploy failed), and Vercel's own docs say even that one daily run can drift
 * up to +/-59 minutes — two consecutive runs can land nearly 26h apart, reliably longer than the
 * token's 24h life. So this route is triggered from OUTSIDE Vercel's cron system instead: a
 * GitHub Actions scheduled workflow (.github/workflows/renew-dhan-token.yml) hits it every 6h,
 * keeping the stored token comfortably inside its 24h window regardless of the main pipeline's
 * exact run time, so ingestDhanMcx should always find an already-fresh token waiting in
 * dhan_token and only need to read it, not race an expiry.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const clientId = process.env.DHAN_CLIENT_ID;
  const accessToken = process.env.DHAN_ACCESS_TOKEN;
  if (!clientId || !accessToken) {
    return NextResponse.json({ ok: false, reason: "DHAN_CLIENT_ID / DHAN_ACCESS_TOKEN not set" });
  }
  const db = createAdminClient();
  try {
    const { note } = await getDhanAccessToken(db, clientId, accessToken);
    return NextResponse.json({ ok: note === "renewed", note });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
