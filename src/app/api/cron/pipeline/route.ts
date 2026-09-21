import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/api/cronAuth";
import { runIngestionPipeline } from "@/lib/pipeline/ingest";
import { runComputePipeline } from "@/lib/pipeline/compute";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * The daily automated pipeline (V3 §43). Scheduled via vercel.json to run
 * once per day inside the mandated maintenance window (after US market
 * close, before Tokyo market open — see vercel.json comment). Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET`; reject anything else so this
 * endpoint can't be triggered by an outside caller.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  try {
    const ingestSummary = await runIngestionPipeline(db);
    const computeSummary = await runComputePipeline(db);
    return NextResponse.json({ ok: true, ingest: ingestSummary, compute: computeSummary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
