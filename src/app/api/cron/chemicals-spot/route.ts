import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestEiaChemicalFeedstockSpot } from "@/lib/pipeline/ingest";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Standalone twice-a-day trigger for the Chemicals section's one real spot
 * price series (EIA Mont Belvieu propane — see eiaChemicalFeedstockSpot.ts).
 * Deliberately its own route rather than a stage folded into
 * /api/cron/pipeline: that route already occupies vercel.json's one Hobby-
 * plan daily cron slot, and this needs its own twice-a-day cadence — driven
 * by an external scheduler (.github/workflows/chemicals-spot-cron.yml)
 * hitting this route directly, not by Vercel Cron. Same bearer-secret
 * pattern as the main pipeline route so this can't be triggered by an
 * outside caller.
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
    const result = await ingestEiaChemicalFeedstockSpot(db, runDate);
    return NextResponse.json({ ok: result.status !== "failed", result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
