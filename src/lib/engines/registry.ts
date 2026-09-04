import type { SupabaseClient } from "@supabase/supabase-js";
import type { EngineResult, Horizon } from "./types";
import { runGlobalLiquidityEngine } from "./globalLiquidity";
import { runCreditEngine } from "./credit";
import { runEquityFragilityEngine } from "./equityFragility";
import { runTreasuryEngine } from "./treasury";
import { runYenCarryEngine } from "./yenCarry";
import { runBankingEngine } from "./banking";
import { runPropertyEngine } from "./property";
import { runGlobalSovereignDebtEngine } from "./globalSovereignDebt";
import { runEmergingMarketDebtEngine } from "./emergingMarketDebt";
import { runEnergyEngine } from "./energy";
import { runGeopoliticalEngine } from "./geopolitical";
import { runDerivativesLeverageEngine } from "./derivativesLeverage";
import { runCryptoEngine } from "./crypto";
import { runCyberEngine } from "./cyber";
import { runTradePolicyEngine } from "./tradePolicy";
import { runSupplyChainsEngine } from "./supplyChains";
import { runChinaEngine } from "./china";
import { computeGfmi, engineResultToGfmiInput } from "./gfmi";

export const HORIZONS: Horizon[] = ["short", "medium", "long"];

/**
 * Engine registry. Each entry maps a V3 §4 engine to its runner and its
 * weight in the GFMI composite. 17 of 24 engines are implemented. Corporate
 * Credit is fulfilled by "credit" (HY/IG OAS) and Equity Valuation is folded
 * into "equity_fragility" rather than duplicated. Still not implemented:
 * AI Financial Sustainability/Valuation/Credit/Circular-Financing/Debt-Maturity
 * (need SEC EDGAR XBRL parsing — Phase 2), Private Credit and Market
 * Concentration (no free structured source), and Central-Bank Policy (needs
 * the NLP hawkish/dovish classifier, deferred — see README). China and India
 * are explicitly partial. None are stubbed with fake scores — see each
 * engine file's docstring for exactly what free data does and doesn't cover.
 */
export const ENGINE_REGISTRY = [
  { key: "global_liquidity", run: runGlobalLiquidityEngine, gfmiWeight: 1.1 },
  { key: "credit", run: runCreditEngine, gfmiWeight: 1.0 },
  { key: "equity_fragility", run: runEquityFragilityEngine, gfmiWeight: 0.9 },
  { key: "us_treasury_sovereign", run: runTreasuryEngine, gfmiWeight: 1.0 },
  { key: "yen_carry", run: runYenCarryEngine, gfmiWeight: 1.0 },
  { key: "banking", run: runBankingEngine, gfmiWeight: 0.9 },
  { key: "property", run: runPropertyEngine, gfmiWeight: 0.7 },
  { key: "global_sovereign_debt", run: runGlobalSovereignDebtEngine, gfmiWeight: 0.8 },
  { key: "emerging_market_debt", run: runEmergingMarketDebtEngine, gfmiWeight: 0.7 },
  { key: "energy", run: runEnergyEngine, gfmiWeight: 0.6 },
  { key: "geopolitical", run: runGeopoliticalEngine, gfmiWeight: 0.6 },
  { key: "derivatives_leverage", run: runDerivativesLeverageEngine, gfmiWeight: 0.7 },
  { key: "crypto_stablecoins", run: runCryptoEngine, gfmiWeight: 0.4 },
  { key: "cyber_infrastructure", run: runCyberEngine, gfmiWeight: 0.4 },
  { key: "trade_economic_policy", run: runTradePolicyEngine, gfmiWeight: 0.5 },
  { key: "supply_chains", run: runSupplyChainsEngine, gfmiWeight: 0.6 },
  { key: "china", run: runChinaEngine, gfmiWeight: 0.6 },
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
