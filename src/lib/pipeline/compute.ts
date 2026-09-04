import type { SupabaseClient } from "@supabase/supabase-js";
import { HORIZONS, runAllEngines, computeGfmiFromResults } from "../engines/registry";
import { runIndiaRegimeEngine } from "../engines/indiaRegime";

async function logRun(db: SupabaseClient, runDate: string, stage: string, status: string, detail: unknown) {
  await db.from("pipeline_runs").insert({ run_date: runDate, stage, status, detail, finished_at: new Date().toISOString() });
}

export async function runComputePipeline(db: SupabaseClient) {
  const asOf = new Date().toISOString().slice(0, 10);

  try {
    const engineResults = await runAllEngines(db, asOf);

    const engineRows = [];
    for (const engineKey of Object.keys(engineResults)) {
      for (const horizon of HORIZONS) {
        const r = engineResults[engineKey][horizon];
        engineRows.push({
          engine_key: r.engineKey,
          as_of: r.asOf,
          horizon: r.horizon,
          score: r.score,
          direction: r.direction,
          regime: r.regime,
          confidence: r.confidence,
          top_drivers: r.topDrivers,
          leading_indicators: r.leadingIndicators,
          coincident_indicators: r.coincidentIndicators,
          lagging_indicators: r.laggingIndicators,
          contradictory_evidence: r.contradictoryEvidence,
          not_yet_happened: r.notYetHappened,
          trigger_desc: r.triggerDesc,
          amplifiers: r.amplifiers,
          transmission_mechanism: r.transmissionMechanism,
          invalidation_conditions: r.invalidationConditions,
          confirmation_conditions: r.confirmationConditions,
          methodology_version: r.methodologyVersion,
          data_completeness: r.dataCompleteness,
        });
      }
    }
    if (engineRows.length > 0) {
      const { error } = await db.from("risk_engine_scores").upsert(engineRows, { onConflict: "engine_key,as_of,horizon" });
      if (error) throw new Error(error.message);
    }

    const gfmiRows = [];
    for (const horizon of HORIZONS) {
      const gfmi = await computeGfmiFromResults(engineResults, horizon);
      if (horizon === "short") {
        gfmiRows.push({
          as_of: asOf,
          score: gfmi.score,
          regime: gfmi.regime,
          confidence: gfmi.confidence,
          components: gfmi.components,
          amplifier_applied: gfmi.amplifierApplied,
          override_triggered: gfmi.overrideTriggered,
          methodology_version: "v0.1-freedata",
        });
      }
    }
    if (gfmiRows.length > 0) {
      const { error } = await db.from("gfmi_scores").upsert(gfmiRows, { onConflict: "as_of" });
      if (error) throw new Error(error.message);
    }

    const indiaRows = [];
    for (const horizon of HORIZONS) {
      const r = await runIndiaRegimeEngine({ db, asOf }, horizon);
      indiaRows.push({
        as_of: asOf,
        horizon,
        score: r.score,
        classification: r.regime,
        confidence: r.confidence,
        top_positive: r.topDrivers.filter((d) => d.contribution > 0),
        top_negative: r.topDrivers.filter((d) => d.contribution <= 0),
        invalidation_conditions: r.invalidationConditions,
        next_catalysts: r.confirmationConditions,
        methodology_version: r.methodologyVersion,
      });
    }
    if (indiaRows.length > 0) {
      const { error } = await db.from("india_regime").upsert(indiaRows, { onConflict: "as_of,horizon" });
      if (error) throw new Error(error.message);
    }

    await logRun(db, asOf, "compute", "ok", { engines: Object.keys(engineResults).length });
    return { status: "ok" as const, asOf, engineCount: Object.keys(engineResults).length };
  } catch (e) {
    await logRun(db, asOf, "compute", "failed", { error: (e as Error).message });
    throw e;
  }
}
