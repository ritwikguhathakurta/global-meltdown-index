import type { SupabaseClient } from "@supabase/supabase-js";
import type { EngineResult, Horizon } from "./types";
import { runGlobalLiquidityEngine } from "./globalLiquidity";
import { runCreditEngine } from "./credit";
import { runEquityFragilityEngine } from "./equityFragility";
import { runTreasuryEngine } from "./treasury";
import { runYenCarryEngine } from "./yenCarry";
import { computeGfmi, engineResultToGfmiInput } from "./gfmi";

export const HORIZONS: Horizon[] = ["short", "medium", "long"];

/**
 * Phase-1 engine registry. Each entry maps a V3 §4 engine to its runner and
 * its weight in the GFMI composite. The remaining 19 engines from the
 * document (AI Financial Sustainability, Private Credit, Banking, Property,
 * China, Energy, Geopolitical, ...) are not yet implemented — they require
 * data this deployment doesn't ingest yet (company filings, CRE data,
 * China macro, etc.) and will be added engine-by-engine in later phases.
 * They are intentionally absent from GFMI rather than stubbed with fake scores.
 */
export const ENGINE_REGISTRY = [
  { key: "global_liquidity", run: runGlobalLiquidityEngine, gfmiWeight: 1.1 },
  { key: "credit", run: runCreditEngine, gfmiWeight: 1.0 },
  { key: "equity_fragility", run: runEquityFragilityEngine, gfmiWeight: 0.9 },
  { key: "us_treasury_sovereign", run: runTreasuryEngine, gfmiWeight: 1.0 },
  { key: "yen_carry", run: runYenCarryEngine, gfmiWeight: 1.0 },
] as const;

export async function runAllEngines(
  db: SupabaseClient,
  asOf: string
): Promise<Record<string, Record<Horizon, EngineResult>>> {
  const out: Record<string, Record<Horizon, EngineResult>> = {};
  for (const engine of ENGINE_REGISTRY) {
    out[engine.key] = {} as Record<Horizon, EngineResult>;
    for (const horizon of HORIZONS) {
      out[engine.key][horizon] = await engine.run({ db, asOf }, horizon);
    }
  }
  return out;
}

export async function computeGfmiFromResults(
  results: Record<string, Record<Horizon, EngineResult>>,
  horizon: Horizon
) {
  const inputs = ENGINE_REGISTRY.map((e) => engineResultToGfmiInput(results[e.key][horizon], e.gfmiWeight));
  const vix = results["equity_fragility"]?.[horizon]?.leadingIndicators.find((i) => i.key === "vol.vix")?.value ?? null;
  const creditStress = results["credit"]?.[horizon]?.score ?? null;
  return computeGfmi(inputs, vix, creditStress);
}
