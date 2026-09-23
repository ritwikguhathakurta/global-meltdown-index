import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/api/cronAuth";
import { runIngestionPipeline } from "@/lib/pipeline/ingest";
import { runComputePipeline } from "@/lib/pipeline/compute";

export const runtime = "nodejs";
// Tried raising this to 400 to give runIngestionPipeline's new RBI pre-phase
// (see that function's own comment) headroom without touching any other
// stage's budget — the deployment failed at the "Deploying outputs" step
// (build itself succeeded) with no error surfaced via the CLI, consistent
// with this account's plan capping function duration at 300s. Reverted;
// the RBI pre-phase is bounded at a more modest 60s instead, accepted as
// the same kind of "not every stage hits its absolute worst case at once"
// empirical assumption the whole 300s pipeline already ran on before this
// change — don't raise this again without confirming the plan actually
// supports it (e.g. via the Vercel dashboard's plan/limits page).
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
