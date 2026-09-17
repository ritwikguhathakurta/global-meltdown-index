import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestMassiveFutures } from "@/lib/pipeline/ingest";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Standalone, more-frequent trigger for ingest_massive_futures — separate
 * from /api/cron/pipeline (which already calls this same stage once a day
 * as part of its ~65-stage run). Built because Massive's aggregates
 * endpoint hit an undocumented rate/quota limit that stayed exhausted for
 * 17+ hours straight across multiple once-daily pipeline runs; waiting a
 * full day between each check meant a day lost every time it happened to
 * still be exhausted at exactly 21:30 UTC. This lets an external scheduler
 * (.github/workflows/massive-futures-nudge.yml) "nudge" the same resumable
 * stage every few hours instead, so recovery is caught same-day.
 *
 * Safe to call this on top of the daily pipeline's own call to the same
 * function: ingestMassiveFutures reads its own last pipeline_runs row and
 * resumes from wherever it left off regardless of which route triggered it,
 * so the two triggers cooperate rather than conflict. When the endpoint is
 * still rate-limited, this costs at most one wasted API call (the stage
 * stops itself immediately on the first candidate) — not a meaningful
 * ongoing burden even at several checks a day.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const runDate = new Date().toISOString().slice(0, 10);

  try {
    const result = await ingestMassiveFutures(db, runDate);
    return NextResponse.json({ ok: result.status !== "failed", result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
