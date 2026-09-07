import type { SupabaseClient } from "@supabase/supabase-js";
import type { EngineResult, Horizon } from "./types";
import { runGlobalLiquidityEngine } from "./globalLiquidity";
import { runCreditEngine } from "./credit";
import { runEquityFragilityEngine } from "./equityFragility";
import { runTreasuryEngine } from "./treasury";
import { runYenCarryEngine } from "./yenCarry";
import { runBankingEngine } from "./banking";
import { runPropertyEngine } from "./property";
import { runEmergingMarketDebtEngine } from "./emergingMarketDebt";
import { runEnergyEngine } from "./energy";
import { runGeopoliticalEngine } from "./geopolitical";
import { runDerivativesLeverageEngine } from "./derivativesLeverage";
import { runCryptoEngine } from "./crypto";
import { runCyberEngine } from "./cyber";
import { runTradePolicyEngine } from "./tradePolicy";
import { runSupplyChainsEngine } from "./supplyChains";
import { runChinaEngine } from "./china";
import { runIndiaLiquidityEngine } from "./indiaLiquidity";
import { runIndiaYieldCurveEngine } from "./indiaYieldCurve";
import { runMarketConcentrationEngine } from "./marketConcentration";
import { runPrivateCreditEngine } from "./privateCredit";
import { runAiFinancialSustainabilityEngine } from "./aiFinancialSustainability";
import { runAiValuationEngine } from "./aiValuation";
import { runAiCreditFinancingEngine } from "./aiCreditFinancing";
import { runAiDebtMaturityWallEngine } from "./aiDebtMaturityWall";
import { computeGfmi, engineResultToGfmiInput } from "./gfmi";

export const HORIZONS: Horizon[] = ["short", "medium", "long"];

/**
 * Engine registry. Each entry maps a V3 §4 engine to its runner and its
 * weight in the GFMI composite. 22 of 24 engines are implemented (as
 * standalone entries here — see below for the two that are folded into
 * others rather than duplicated). Corporate Credit is fulfilled by "credit"
 * (HY/IG/Euro/Asia OAS), Equity Valuation is folded into "equity_fragility",
 * and Global Sovereign Debt is folded into "us_treasury_sovereign" (which
 * covers the US plus the rest of the G7 and a China funding-rate proxy —
 * see treasury.ts) rather than each being duplicated as its own engine.
 * Private Credit,
 * Market Concentration and AI Valuation are all market-price proxies rather
 * than the structural data the spec envisions (no free source for the
 * former two; no free forward-earnings data for the latter) — see their
 * docstrings. AI Financial Sustainability/Credit-Financing/Debt-Maturity-Wall
 * run on real SEC EDGAR XBRL data for 8 large-cap AI-capex-relevant
 * companies (see aiCompanyMetrics.ts/secEdgar.ts). The one engine NOT
 * implemented is AI Circular Financing — V3 §18 itself says "never infer
 * undisclosed relationships as fact", and no free source publishes the
 * equity-investment/purchase-commitment/SPV web it asks for, so building it
 * would mean guessing at exactly the kind of relationship the spec warns
 * against inferring. China is explicitly partial (one indicator — developer
 * defaults — still genuinely unavailable free). India Liquidity is a new
 * addition beyond the original V3 §4 list, requested separately from India
 * Market Regime (indiaRegime.ts, a bullish/bearish equity-regime call on a
 * different scale, run outside this registry — see compute.ts) since
 * banking-system liquidity is a distinct concept from market direction.
 * India Yield Curve is a further addition — the short/medium/long shape of
 * India's sovereign curve and its inversion risk, built from RBI's own
 * primary-auction results (see indiaYieldCurve.ts) after CCIL, the natural
 * secondary-market source, was ruled out on its own Terms of Use.
 * None are stubbed with fake scores — see each engine file's docstring for
 * exactly what free data does and doesn't cover.
 */
export const ENGINE_REGISTRY = [
  { key: "global_liquidity", run: runGlobalLiquidityEngine, gfmiWeight: 1.1 },
  { key: "credit", run: runCreditEngine, gfmiWeight: 1.0 },
  { key: "equity_fragility", run: runEquityFragilityEngine, gfmiWeight: 0.9 },
  { key: "us_treasury_sovereign", run: runTreasuryEngine, gfmiWeight: 1.2 },
  { key: "yen_carry", run: runYenCarryEngine, gfmiWeight: 1.0 },
  { key: "banking", run: runBankingEngine, gfmiWeight: 0.9 },
  { key: "property", run: runPropertyEngine, gfmiWeight: 0.7 },
  { key: "emerging_market_debt", run: runEmergingMarketDebtEngine, gfmiWeight: 0.7 },
  { key: "energy", run: runEnergyEngine, gfmiWeight: 0.6 },
  { key: "geopolitical", run: runGeopoliticalEngine, gfmiWeight: 0.6 },
  { key: "derivatives_leverage", run: runDerivativesLeverageEngine, gfmiWeight: 0.7 },
  { key: "crypto_stablecoins", run: runCryptoEngine, gfmiWeight: 0.4 },
  { key: "cyber_infrastructure", run: runCyberEngine, gfmiWeight: 0.4 },
  { key: "trade_economic_policy", run: runTradePolicyEngine, gfmiWeight: 0.5 },
  { key: "supply_chains", run: runSupplyChainsEngine, gfmiWeight: 0.6 },
  { key: "china", run: runChinaEngine, gfmiWeight: 0.6 },
  { key: "india_liquidity", run: runIndiaLiquidityEngine, gfmiWeight: 0.4 },
  { key: "india_yield_curve", run: runIndiaYieldCurveEngine, gfmiWeight: 0.3 },
  { key: "market_concentration", run: runMarketConcentrationEngine, gfmiWeight: 0.5 },
  { key: "private_credit", run: runPrivateCreditEngine, gfmiWeight: 0.6 },
  { key: "ai_financial_sustainability", run: runAiFinancialSustainabilityEngine, gfmiWeight: 0.8 },
  { key: "ai_valuation", run: runAiValuationEngine, gfmiWeight: 0.6 },
  { key: "ai_credit_financing", run: runAiCreditFinancingEngine, gfmiWeight: 0.8 },
  { key: "ai_debt_maturity_wall", run: runAiDebtMaturityWallEngine, gfmiWeight: 0.6 },
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
