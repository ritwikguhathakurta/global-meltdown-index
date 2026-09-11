import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { computeIndiaSeasonalNotes } from "@/lib/engines/indiaSeasonality";
import { getCentralBankLiquidityTable as computeCentralBankLiquidityTable, type CentralBankLiquidityRow } from "@/lib/engines/liquidityRegime";
import { getCountryCreditTable as computeCountryCreditTable, type CountryCreditRow } from "@/lib/engines/creditRegime";
import { getCreditDataVerification as computeCreditDataVerification, type CreditVerificationRow } from "@/lib/engines/creditDataVerification";
import { getCountryEmDebtTable as computeCountryEmDebtTable, type CountryEmDebtRow } from "@/lib/engines/emDebtRegime";
import {
  getLiquiditySystemicRiskTable as computeLiquiditySystemicRiskTable,
  getLiquidityCompositeScore,
  getGlobalDollarLiquidityIndex as computeGlobalDollarLiquidityIndex,
  type CountryLiquidityRow,
  type LiquidityStageDef,
  type GlobalLiquidityCurrencyRow,
} from "@/lib/engines/liquiditySystemicRisk";
import { NBFI_MONITORING_REGISTRY } from "@/lib/data/nbfiRegistry";
import { getCountryG7DebtTable as computeCountryG7DebtTable, getG7CompositeScore, type CountryG7DebtRow, type G7CrisisStageDef } from "@/lib/engines/g7DebtRegime";
import { getCarryTradeTable as computeCarryTradeTable, getCarryCompositeScore, type CarryPairRow, type FundingCurrencyRow, type CarryStageDef } from "@/lib/engines/carryTrade";
import { getBankingSystemicRiskTable as computeBankingSystemicRiskTable, getBankingCompositeScore, type CountryBankingRow, type BankingStageDef } from "@/lib/engines/bankingSystemicRisk";
import { getBankLevelTable as computeBankLevelTable, type BankLevelRow } from "@/lib/engines/bankLevel";
import {
  getPropertySystemicRiskTable as computePropertySystemicRiskTable,
  getPropertyCompositeScore,
  type CountryPropertyRow,
  type PropertyStageDef,
} from "@/lib/engines/propertySystemicRisk";
import {
  getTreasuryRiskTable as computeTreasuryRiskTable,
  getTreasuryCompositeScore,
  getUsTreasuryCashPanel as computeUsTreasuryCashPanel,
  getUsAuctionHealthPanel as computeUsAuctionHealthPanel,
  type CountryTreasuryRow,
  type TreasuryStageDef,
  type UsTreasuryCashPanel,
  type UsAuctionTenorReading,
} from "@/lib/engines/treasuryRiskEngine";
import type { EngineRow } from "./types";

export type GfmiRow = {
  as_of: string;
  score: number | null;
  regime: string;
  confidence: number;
  components: Record<string, unknown>;
  amplifier_applied: number;
  override_triggered: string | null;
};

export type IndiaRegimeRow = {
  as_of: string;
  horizon: string;
  score: number | null;
  classification: string | null;
  confidence: number;
  top_positive: unknown;
  top_negative: unknown;
  invalidation_conditions: unknown;
  next_catalysts: unknown;
};

export type CentralBankEventRow = {
  id: number;
  institution: string;
  event_date: string;
  title: string;
  source_url: string;
};

export type SourceRow = {
  id: number;
  key: string;
  name: string;
  institution: string;
  url: string;
  tier: number;
  status: string;
};

export type PipelineRunRow = {
  id: number;
  run_date: string;
  stage: string;
  status: string;
  detail: unknown;
  started_at: string;
  finished_at: string | null;
};

/**
 * Every reader in this file degrades to an empty result instead of throwing
 * when the backend isn't configured or unreachable, so pages can render a
 * "no data yet" state (which already existed for the pre-first-pipeline-run
 * case) rather than crashing the whole route.
 */
async function safe<T>(fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>, fallback: T): Promise<T> {
  if (!isSupabaseConfigured) return fallback;
  try {
    const { data, error } = await fn();
    if (error) {
      console.error(error.message);
      return fallback;
    }
    return data ?? fallback;
  } catch (e) {
    console.error((e as Error).message);
    return fallback;
  }
}

export async function getLatestEngine(engineKey: string): Promise<EngineRow[]> {
  const db = await createServerSupabase();
  return safe<EngineRow[]>(
    () =>
      db
        .from("risk_engine_scores")
        .select("*")
        .eq("engine_key", engineKey)
        .order("as_of", { ascending: false })
        .limit(3), // short/medium/long for the latest as_of
    []
  );
}

export async function getAllEnginesLatest(horizon: "short" | "medium" | "long" = "short"): Promise<EngineRow[]> {
  const db = await createServerSupabase();
  return safe<EngineRow[]>(
    () =>
      db
        .from("risk_engine_scores")
        .select("*")
        .eq("horizon", horizon)
        .order("as_of", { ascending: false })
        .limit(40),
    []
  );
}

export async function getLatestGfmi(): Promise<GfmiRow[]> {
  const db = await createServerSupabase();
  return safe<GfmiRow[]>(
    () => db.from("gfmi_scores").select("*").order("as_of", { ascending: false }).limit(2), // current + previous
    []
  );
}

export async function getLatestIndiaRegime(): Promise<IndiaRegimeRow[]> {
  const db = await createServerSupabase();
  return safe<IndiaRegimeRow[]>(
    () => db.from("india_regime").select("*").order("as_of", { ascending: false }).limit(3),
    []
  );
}

export async function getRecentCentralBankEvents(limit = 25): Promise<CentralBankEventRow[]> {
  const db = await createServerSupabase();
  return safe<CentralBankEventRow[]>(
    () => db.from("central_bank_events").select("*").order("event_date", { ascending: false }).limit(limit),
    []
  );
}

export async function getSourceRegistry(): Promise<SourceRow[]> {
  const db = await createServerSupabase();
  return safe<SourceRow[]>(
    () => db.from("sources").select("*").order("tier", { ascending: true }),
    []
  );
}

export async function getIndiaSeasonalNotes(): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const db = await createServerSupabase();
    return await computeIndiaSeasonalNotes(db, new Date().toISOString());
  } catch (e) {
    console.error((e as Error).message);
    return [];
  }
}

export async function getCentralBankLiquidityTable(): Promise<CentralBankLiquidityRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const db = await createServerSupabase();
    return await computeCentralBankLiquidityTable(db);
  } catch (e) {
    console.error((e as Error).message);
    return [];
  }
}

export async function getCountryCreditTable(): Promise<CountryCreditRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const db = await createServerSupabase();
    return await computeCountryCreditTable(db);
  } catch (e) {
    console.error((e as Error).message);
    return [];
  }
}

export async function getCountryEmDebtTable(): Promise<CountryEmDebtRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const db = await createServerSupabase();
    return await computeCountryEmDebtTable(db);
  } catch (e) {
    console.error((e as Error).message);
    return [];
  }
}

export async function getG7DebtTable(): Promise<{ rows: CountryG7DebtRow[]; composite: { score: number | null; stage: G7CrisisStageDef | null } }> {
  const empty = { rows: [] as CountryG7DebtRow[], composite: { score: null, stage: null } };
  if (!isSupabaseConfigured) return empty;
  try {
    const db = await createServerSupabase();
    const rows = await computeCountryG7DebtTable(db);
    const composite = await getG7CompositeScore(db, rows);
    return { rows, composite };
  } catch (e) {
    console.error((e as Error).message);
    return empty;
  }
}

export async function getCarryTradeTable(): Promise<{ pairs: CarryPairRow[]; funding: FundingCurrencyRow[]; composite: { score: number | null; stage: CarryStageDef | null } }> {
  const empty = { pairs: [] as CarryPairRow[], funding: [] as FundingCurrencyRow[], composite: { score: null, stage: null } };
  if (!isSupabaseConfigured) return empty;
  try {
    const db = await createServerSupabase();
    const { pairs, funding } = await computeCarryTradeTable(db);
    const composite = getCarryCompositeScore(pairs);
    return { pairs, funding, composite };
  } catch (e) {
    console.error((e as Error).message);
    return empty;
  }
}

export async function getBankingSystemicRiskTable(): Promise<{ rows: CountryBankingRow[]; composite: { score: number | null; stage: BankingStageDef | null } }> {
  const empty = { rows: [] as CountryBankingRow[], composite: { score: null, stage: null } };
  if (!isSupabaseConfigured) return empty;
  try {
    const db = await createServerSupabase();
    const rows = await computeBankingSystemicRiskTable(db);
    const composite = getBankingCompositeScore(rows);
    return { rows, composite };
  } catch (e) {
    console.error((e as Error).message);
    return empty;
  }
}

export async function getBankLevelTable(): Promise<BankLevelRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const db = await createServerSupabase();
    return await computeBankLevelTable(db);
  } catch (e) {
    console.error((e as Error).message);
    return [];
  }
}

export async function getPropertySystemicRiskTable(): Promise<{ rows: CountryPropertyRow[]; composite: { score: number | null; stage: PropertyStageDef | null } }> {
  const empty = { rows: [] as CountryPropertyRow[], composite: { score: null, stage: null } };
  if (!isSupabaseConfigured) return empty;
  try {
    const db = await createServerSupabase();
    const rows = await computePropertySystemicRiskTable(db);
    const composite = getPropertyCompositeScore(rows);
    return { rows, composite };
  } catch (e) {
    console.error((e as Error).message);
    return empty;
  }
}

export async function getCreditDataVerificationTable(): Promise<CreditVerificationRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const db = await createServerSupabase();
    return await computeCreditDataVerification(db);
  } catch (e) {
    console.error((e as Error).message);
    return [];
  }
}

export async function getLiquiditySystemicRiskTable(): Promise<{ rows: CountryLiquidityRow[]; composite: { score: number | null; stage: LiquidityStageDef | null } }> {
  const empty = { rows: [] as CountryLiquidityRow[], composite: { score: null, stage: null } };
  if (!isSupabaseConfigured) return empty;
  try {
    const db = await createServerSupabase();
    const rows = await computeLiquiditySystemicRiskTable(db);
    const composite = getLiquidityCompositeScore(rows);
    return { rows, composite };
  } catch (e) {
    console.error((e as Error).message);
    return empty;
  }
}

export async function getGlobalDollarLiquidityIndex(): Promise<GlobalLiquidityCurrencyRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const db = await createServerSupabase();
    return await computeGlobalDollarLiquidityIndex(db);
  } catch (e) {
    console.error((e as Error).message);
    return [];
  }
}

export async function getTreasuryRiskTable(): Promise<{ rows: CountryTreasuryRow[]; composite: { score: number | null; stage: TreasuryStageDef | null } }> {
  const empty = { rows: [] as CountryTreasuryRow[], composite: { score: null, stage: null } };
  if (!isSupabaseConfigured) return empty;
  try {
    const db = await createServerSupabase();
    const rows = await computeTreasuryRiskTable(db);
    const composite = getTreasuryCompositeScore(rows);
    return { rows, composite };
  } catch (e) {
    console.error((e as Error).message);
    return empty;
  }
}

export async function getUsTreasuryCashPanel(): Promise<UsTreasuryCashPanel | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeUsTreasuryCashPanel(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getUsAuctionHealthPanel(): Promise<UsAuctionTenorReading[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const db = await createServerSupabase();
    return await computeUsAuctionHealthPanel(db);
  } catch (e) {
    console.error((e as Error).message);
    return [];
  }
}

export type NbfiCheckRow = {
  key: string;
  last_checked_at: string | null;
  check_status: string;
  note: string | null;
};

export async function getNbfiChecks(): Promise<NbfiCheckRow[]> {
  const db = await createServerSupabase();
  return safe<NbfiCheckRow[]>(() => db.from("nbfi_checks").select("*"), []);
}

export { NBFI_MONITORING_REGISTRY };

/**
 * Liquidity Transmission Panel — the "critical design decision" the
 * Liquidity spec itself calls out: liquidity as the TRANSMISSION layer
 * connecting the other systemic-risk engines, not just a sixth independent
 * 0-100 score sitting next to them. This reads each sibling engine's ALREADY
 * COMPUTED composite score (no new modeling, no fabricated correlation) and
 * reports which are simultaneously elevated right now — a genuine, if
 * simple, implementation of spec's own §133 "Liquidity Fragility
 * Convergence" ("at least three independent channels deteriorating
 * together"), reframed across ENGINES rather than sub-indicators within one
 * engine, since that's the level this app's architecture actually computes
 * independently-sourced scores at.
 *
 * EM Debt has no dedicated composite-score getter (emDebtRegime.ts) — an
 * equal-weighted mean of its rows' own vulnerabilityScore is computed here
 * for this panel only, exactly the same aggregation every other engine's own
 * getXCompositeScore already does internally.
 */
export type TransmissionEngineRow = {
  engine: string;
  score: number | null;
  elevated: boolean;
};

export type LiquidityTransmissionPanel = {
  rows: TransmissionEngineRow[];
  elevatedCount: number;
  convergence: boolean;
};

export async function getLiquidityTransmissionPanel(): Promise<LiquidityTransmissionPanel> {
  const empty: LiquidityTransmissionPanel = { rows: [], elevatedCount: 0, convergence: false };
  if (!isSupabaseConfigured) return empty;
  try {
    const db = await createServerSupabase();
    const [liquidityRows, bankingRows, propertyRows, g7Rows, carryData, emDebtRows] = await Promise.all([
      computeLiquiditySystemicRiskTable(db),
      computeBankingSystemicRiskTable(db),
      computePropertySystemicRiskTable(db),
      computeCountryG7DebtTable(db),
      computeCarryTradeTable(db),
      computeCountryEmDebtTable(db),
    ]);

    const liquidity = getLiquidityCompositeScore(liquidityRows);
    const banking = getBankingCompositeScore(bankingRows);
    const property = getPropertyCompositeScore(propertyRows);
    const g7 = await getG7CompositeScore(db, g7Rows);
    const { pairs } = carryData;
    const carry = getCarryCompositeScore(pairs);
    const emDebtWithData = emDebtRows.filter((r) => r.vulnerabilityScore !== null);
    const emDebtScore =
      emDebtWithData.length > 0
        ? Math.round(emDebtWithData.reduce((a, b) => a + (b.vulnerabilityScore as number), 0) / emDebtWithData.length)
        : null;

    const rows: TransmissionEngineRow[] = [
      { engine: "Liquidity", score: liquidity.score, elevated: (liquidity.score ?? 0) >= 60 },
      { engine: "Banking", score: banking.score, elevated: (banking.score ?? 0) >= 60 },
      { engine: "Property", score: property.score, elevated: (property.score ?? 0) >= 60 },
      { engine: "G7 Sovereign Debt", score: g7.score, elevated: (g7.score ?? 0) >= 60 },
      { engine: "EM Debt", score: emDebtScore, elevated: (emDebtScore ?? 0) >= 60 },
      { engine: "Carry Trade", score: carry.score, elevated: (carry.score ?? 0) >= 60 },
    ];
    const elevatedCount = rows.filter((r) => r.elevated).length;
    // Convergence requires Liquidity itself elevated PLUS at least two other
    // engines — the same "3+ independent channels" threshold spec's own
    // §133 uses, applied at engine granularity.
    const convergence = rows[0].elevated && elevatedCount >= 3;
    return { rows, elevatedCount, convergence };
  } catch (e) {
    console.error((e as Error).message);
    return empty;
  }
}

export type CentralBankFsrCheckRow = {
  key: string;
  last_checked_at: string | null;
  check_status: string;
  note: string | null;
};

export async function getCentralBankFsrChecks(): Promise<CentralBankFsrCheckRow[]> {
  const db = await createServerSupabase();
  return safe<CentralBankFsrCheckRow[]>(() => db.from("central_bank_fsr_checks").select("*"), []);
}

export async function getRecentPipelineRuns(limit = 20): Promise<PipelineRunRow[]> {
  const db = await createServerSupabase();
  return safe<PipelineRunRow[]>(
    () => db.from("pipeline_runs").select("*").order("started_at", { ascending: false }).limit(limit),
    []
  );
}
