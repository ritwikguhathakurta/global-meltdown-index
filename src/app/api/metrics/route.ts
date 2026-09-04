import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

/**
 * Lightweight operational metrics (V3 §62). Not a Prometheus exposition-format
 * endpoint — a small JSON summary of pipeline/data health, which is all a
 * single-operator deployment like this actually needs to act on.
 */
export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "backend not configured", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }

  try {
    const db = createAdminClient();

    const [{ data: lastRuns }, { data: gfmi }, { count: engineCount }] = await Promise.all([
      db.from("pipeline_runs").select("stage,status,started_at").order("started_at", { ascending: false }).limit(10),
      db.from("gfmi_scores").select("as_of,score").order("as_of", { ascending: false }).limit(1),
      db.from("risk_engine_scores").select("id", { count: "exact", head: true }),
    ]);

    const latestRunDate = lastRuns?.[0]?.started_at ?? null;
    const hoursSinceLastRun = latestRunDate ? (Date.now() - new Date(latestRunDate).getTime()) / 3600000 : null;

    return NextResponse.json({
      lastRuns: lastRuns ?? [],
      latestGfmi: gfmi?.[0] ?? null,
      engineRowCount: engineCount ?? 0,
      hoursSinceLastPipelineRun: hoursSinceLastRun,
      pipelineStale: hoursSinceLastRun === null || hoursSinceLastRun > 30,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
