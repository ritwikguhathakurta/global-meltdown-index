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
import { getBojDecisionImpact as computeBojDecisionImpact, type BojDecisionImpact } from "@/lib/engines/bojDecisionImpact";
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
import { getChinaSystemicRiskResult as computeChinaSystemicRiskResult, type ChinaSystemicRiskResult } from "@/lib/engines/chinaSystemicRisk";
import { getEnergySystemicRiskResult as computeEnergySystemicRiskResult, type EnergySystemicRiskResult } from "@/lib/engines/energySystemicRisk";
import { getCountryEnergyBalanceTable as computeCountryEnergyBalanceTable, type CountryEnergyBalanceRow, getCountryRenewablesTable as computeCountryRenewablesTable, type CountryRenewablesRow } from "@/lib/engines/energyCountryBalance";
import { getEnergyTradeNetworkGraph as computeEnergyTradeNetworkGraph, type EnergyTradeNetworkResult } from "@/lib/engines/energyTradeNetwork";
import { getEnergyBacktestResult as computeEnergyBacktestResult, type EnergyBacktestResult } from "@/lib/engines/energyBacktest";
import { getCommodityHeatmap as computeCommodityHeatmap, type CommodityHeatmapResult } from "@/lib/engines/commodities";
import { getCommodityBalances as computeCommodityBalances, type CommodityBalanceResult } from "@/lib/engines/commodityBalance";
import {
  getSoybeanCountryBalances as computeSoybeanCountryBalances,
  getSoybeanTradeConcentration as computeSoybeanTradeConcentration,
  getChinaSoybeanImportDemand as computeChinaSoybeanImportDemand,
  type SoybeanCountryRow,
  type SoybeanTradeConcentration,
  type ChinaImportDemand,
} from "@/lib/engines/oilseedsCountry";
import { getSoybeanCrushMargin as computeSoybeanCrushMargin, type CrushMarginResult } from "@/lib/engines/oilseedsCrush";
import { getVegetableOilSpreads as computeVegetableOilSpreads, type OilSpreadRow } from "@/lib/engines/oilseedsSpreads";
import {
  getSoyPalmPairsSpread as computeSoyPalmPairsSpread,
  getPalmWtiPairsSpread as computePalmWtiPairsSpread,
  type CointegratedPairSpread,
} from "@/lib/engines/oilseedsPairsCointegration";
import {
  getPalmOilIndividualDiagnostics as computePalmOilIndividualDiagnostics,
  getSoybeanOilIndividualDiagnostics as computeSoybeanOilIndividualDiagnostics,
  getWtiCrudeIndividualDiagnostics as computeWtiCrudeIndividualDiagnostics,
  type IndividualDiagnostics,
} from "@/lib/engines/individualMeanReversion";
import { getDailyReport as computeDailyReport, type DailyReport } from "@/lib/engines/dailyReport";
import { getOilseedPositioning as computeOilseedPositioning, type OilseedPositioningRow } from "@/lib/engines/oilseedsPositioning";
import { getSeAsiaPalmBalances as computeSeAsiaPalmBalances, type SeAsiaPalmResult } from "@/lib/engines/oilseedsSeAsia";
import { getEnsoState as computeEnsoState, type EnsoState } from "@/lib/engines/oilseedsEnso";
import { getOilseedsPriceCycles as computeOilseedsPriceCycles, type PriceCycleResult } from "@/lib/engines/oilseedsPriceCycles";
import { getOilseedsSeasonality as computeOilseedsSeasonality, type SeasonalityResult } from "@/lib/engines/oilseedsSeasonality";
import { getOilseedsRainfall as computeOilseedsRainfall, type RainfallRegionResult } from "@/lib/engines/oilseedsRainfall";
import { getOilseedsPriceHeatmap as computeOilseedsPriceHeatmap, type OilseedsHeatmapResult } from "@/lib/engines/oilseedsPriceHeatmap";
import { getOilseedsRainfallImpact as computeOilseedsRainfallImpact, type RainfallImpactResult } from "@/lib/engines/oilseedsRainfallImpact";
import { getCommodityPriceHeatmapForCategory as computeCommodityPriceHeatmapForCategory, type CommodityPriceHeatmapResult } from "@/lib/engines/commodityPriceHeatmap";
import { getCommodityPriceCyclesForCategory as computeCommodityPriceCyclesForCategory } from "@/lib/engines/commodityPriceCycles";
import {
  getCommodityCountryBalance as computeCommodityCountryBalance,
  getCommodityCountryBalancesForCategory as computeCommodityCountryBalancesForCategory,
  type CommodityCountryBalanceResult,
} from "@/lib/engines/commodityCountryBalance";
import type { CommodityCategory } from "@/lib/commodities/taxonomy";
import type { CountryBalanceCommodityDef } from "@/lib/commodities/countryBalanceTaxonomy";
import { getChemicalsOverview as computeChemicalsOverview, type ChemicalsOverviewResult } from "@/lib/engines/chemicals";
import { getOleochemicals as computeOleochemicals, type OleochemicalsResult } from "@/lib/engines/oleochemicals";
import { CHEMICAL_PRODUCTS, priceHsCodesFor } from "@/lib/commodities/chemicalProductsDatabase";
import { massiveFuturesMetricKey } from "@/lib/sources/massiveFutures";
import { getChemicalPriceHsCodes, chemicalHsMetricKey } from "@/lib/sources/unComtradeChemicalPrices";
import { getEuropeanGrid as computeEuropeanGrid, type EuropeanGridResult } from "@/lib/engines/europeanGrid";
import { fetchLatestForKeys } from "@/lib/metrics/store";
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

export async function getBojDecisionImpact(): Promise<BojDecisionImpact | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeBojDecisionImpact(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
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

export async function getChinaSystemicRiskResult(): Promise<ChinaSystemicRiskResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeChinaSystemicRiskResult(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getEnergySystemicRiskResult(): Promise<EnergySystemicRiskResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeEnergySystemicRiskResult(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getCountryEnergyBalanceTable(): Promise<CountryEnergyBalanceRow[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeCountryEnergyBalanceTable(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getCountryRenewablesTable(): Promise<CountryRenewablesRow[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeCountryRenewablesTable(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getEnergyTradeNetworkGraph(): Promise<EnergyTradeNetworkResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeEnergyTradeNetworkGraph(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getEnergyBacktestResult(): Promise<EnergyBacktestResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeEnergyBacktestResult(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getCommodityHeatmap(): Promise<CommodityHeatmapResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeCommodityHeatmap(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getCommodityBalances(): Promise<CommodityBalanceResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeCommodityBalances(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getSoybeanCountryBalances(): Promise<SoybeanCountryRow[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeSoybeanCountryBalances(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export type SoybeanTradeIntelligence = {
  concentration: SoybeanTradeConcentration;
  chinaImportDemand: ChinaImportDemand;
};

export async function getSoybeanTradeIntelligence(): Promise<SoybeanTradeIntelligence | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    const [countries, chinaImportDemand] = await Promise.all([computeSoybeanCountryBalances(db), computeChinaSoybeanImportDemand(db)]);
    const concentration = computeSoybeanTradeConcentration(countries);
    return { concentration, chinaImportDemand };
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getSoybeanCrushMargin(): Promise<CrushMarginResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeSoybeanCrushMargin(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getVegetableOilSpreads(): Promise<OilSpreadRow[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeVegetableOilSpreads(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getSoyPalmPairsSpread(): Promise<CointegratedPairSpread | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeSoyPalmPairsSpread(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getPalmWtiPairsSpread(): Promise<CointegratedPairSpread | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computePalmWtiPairsSpread(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getPalmOilIndividualDiagnostics(): Promise<IndividualDiagnostics | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computePalmOilIndividualDiagnostics(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getSoybeanOilIndividualDiagnostics(): Promise<IndividualDiagnostics | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeSoybeanOilIndividualDiagnostics(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getWtiCrudeIndividualDiagnostics(): Promise<IndividualDiagnostics | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeWtiCrudeIndividualDiagnostics(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getDailyReport(): Promise<DailyReport | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeDailyReport(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getOilseedPositioning(): Promise<OilseedPositioningRow[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeOilseedPositioning(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getSeAsiaPalmBalances(): Promise<SeAsiaPalmResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeSeAsiaPalmBalances(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getEnsoState(): Promise<EnsoState | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeEnsoState(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getOilseedsPriceCycles(): Promise<PriceCycleResult[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeOilseedsPriceCycles(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getOilseedsSeasonality(): Promise<SeasonalityResult[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeOilseedsSeasonality(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getOilseedsPriceHeatmap(): Promise<OilseedsHeatmapResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeOilseedsPriceHeatmap(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getOilseedsRainfallImpact(): Promise<RainfallImpactResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeOilseedsRainfallImpact(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

/**
 * Generic per-category versions of the Multi-Timeframe Price Heatmap and
 * Price Cycle Engine (originally built Oilseeds-only, see
 * commodityPriceHeatmap.ts/commodityPriceCycles.ts) — used by the other
 * commodity-category pages (Base Metals, Precious Metals, Critical
 * Minerals, Grains, Soft Commodities, Livestock/Dairy, Fertilizers,
 * Forestry).
 */
export async function getCommodityPriceHeatmapForCategory(
  category: CommodityCategory,
  dailySeriesMetricKeyBySlug?: Record<string, string>
): Promise<CommodityPriceHeatmapResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeCommodityPriceHeatmapForCategory(db, category, dailySeriesMetricKeyBySlug);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getCommodityPriceCyclesForCategory(category: CommodityCategory) {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeCommodityPriceCyclesForCategory(db, category);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

/** Country balance sheet for a single USDA-PSD-covered commodity (Wheat, Corn, Rice, Cotton, Sugar, Coffee, Beef, Chicken, Pork). */
export async function getCommodityCountryBalance(commoditySlug: string): Promise<CommodityCountryBalanceResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeCommodityCountryBalance(db, commoditySlug);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getCommodityCountryBalancesForCategory(
  category: CountryBalanceCommodityDef["category"]
): Promise<CommodityCountryBalanceResult[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeCommodityCountryBalancesForCategory(db, category);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getChemicalsOverview(): Promise<ChemicalsOverviewResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeChemicalsOverview(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getOleochemicals(): Promise<OleochemicalsResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeOleochemicals(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getEuropeanGrid(): Promise<EuropeanGridResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeEuropeanGrid(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export async function getOilseedsRainfall(): Promise<RainfallRegionResult[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeOilseedsRainfall(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}


export type OilseedsHistoryResult = {
  prices: { slug: string; label: string; unit: string; points: { t: string; v: number }[] }[];
  balances: { slug: string; label: string; unit: string; attribute: string; points: { t: string; v: number }[] }[];
  countryBalances: { slug: string; label: string; attribute: string; points: { t: string; v: number }[] }[];
  seAsia: { slug: string; label: string; unit: string; points: { t: string; v: number }[] }[];
};

export async function getOilseedsHistory(): Promise<OilseedsHistoryResult | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    const { fetchSeries } = await import("@/lib/metrics/store");
    const { COMMODITIES } = await import("@/lib/commodities/taxonomy");
    const { BALANCE_COMMODITIES } = await import("@/lib/commodities/balanceTaxonomy");
    const { SOYBEAN_COUNTRIES } = await import("@/lib/commodities/oilseedsTaxonomy");

    const since = new Date();
    since.setUTCFullYear(since.getUTCFullYear() - 10);
    const sinceIso = since.toISOString();

    const priceSlugs = ["soybeans", "soybean_oil", "soybean_meal", "rapeseed_oil", "sunflower_oil", "palm_oil", "palm_kernel_oil", "coconut_oil"];
    const priceDefs = COMMODITIES.filter((c) => priceSlugs.includes(c.slug));
    const prices = await Promise.all(
      priceDefs.map(async (c) => ({
        slug: c.slug,
        label: c.label,
        unit: c.unit,
        points: await fetchSeries(db, `commodity.${c.slug}.price`, sinceIso),
      }))
    );

    const balanceSlugs = ["soybeans", "soybean_oil", "soybean_meal", "rapeseed_seed", "rapeseed_oil", "sunflowerseed", "sunflower_oil", "palm_oil", "palm_kernel_oil", "coconut_oil"];
    const balanceDefs = BALANCE_COMMODITIES.filter((c) => balanceSlugs.includes(c.slug));
    const balanceAttrs: { attr: string; label: string }[] = [
      { attr: "production", label: "Production" },
      { attr: "consumption", label: "Consumption" },
      { attr: "ending_stocks", label: "Ending Stocks" },
    ];
    const balances = (
      await Promise.all(
        balanceDefs.flatMap((c) =>
          balanceAttrs.map(async (a) => ({
            slug: c.slug,
            label: `${c.label} — ${a.label}`,
            unit: c.unit,
            attribute: a.attr,
            points: await fetchSeries(db, `commodity.${c.slug}.${a.attr}`, sinceIso),
          }))
        )
      )
    ).filter((b) => b.points.length > 0);

    const countryAttrs: { attr: string; label: string }[] = [
      { attr: "production", label: "Production" },
      { attr: "crush", label: "Crush" },
      { attr: "imports", label: "Imports" },
      { attr: "exports", label: "Exports" },
      { attr: "ending_stocks", label: "Ending Stocks" },
    ];
    const countryBalances = (
      await Promise.all(
        SOYBEAN_COUNTRIES.flatMap((c) =>
          countryAttrs.map(async (a) => ({
            slug: c.slug,
            label: `${c.label} — Soybean ${a.label}`,
            attribute: a.attr,
            points: await fetchSeries(db, `commodity.soybeans.country.${c.slug}.${a.attr}`, sinceIso),
          }))
        )
      )
    ).filter((b) => b.points.length > 0);

    const seAsiaSeries: { slug: string; label: string; unit: string }[] = [
      { slug: "commodity.palm_oil.indonesia.production", label: "Indonesia — Oil Palm (CPO, all ownership, annual)", unit: "million MT" },
      { slug: "commodity.palm_oil.indonesia.production_monthly_large_estate", label: "Indonesia — Oil Palm, Large Estates Only (monthly)", unit: "million MT" },
      { slug: "commodity.coconut.indonesia.production", label: "Indonesia — Coconut, all ownership (annual)", unit: "million MT" },
      { slug: "commodity.palm_oil.malaysia.export.cpo", label: "Malaysia — CPO Exports (monthly)", unit: "million MT" },
      { slug: "commodity.palm_oil.malaysia.export.palm_oil", label: "Malaysia — Palm Oil Exports, total (monthly)", unit: "million MT" },
      { slug: "commodity.palm_oil.malaysia.export.palm_kernel_oil", label: "Malaysia — Palm Kernel Oil Exports, total (monthly)", unit: "million MT" },
      { slug: "commodity.palm_oil.malaysia.export.biodiesel", label: "Malaysia — Biodiesel Exports (monthly)", unit: "million MT" },
      { slug: "commodity.palm_oil.malaysia.export.total", label: "Malaysia — Oil Palm Products Exports, TOTAL (monthly)", unit: "million MT" },
      { slug: "commodity.palm_oil.cme_futures_price", label: "CME Crude Palm Oil Calendar Swap Futures (CPO=F, daily)", unit: "USD/MT" },
    ];
    const seAsia = (
      await Promise.all(
        seAsiaSeries.map(async (s) => ({
          slug: s.slug,
          label: s.label,
          unit: s.unit,
          points: await fetchSeries(db, s.slug, sinceIso),
        }))
      )
    ).filter((s) => s.points.length > 0);

    return { prices, balances, countryBalances, seAsia };
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export type GridSnapshot = { gridKey: string; gridLabel: string; loadMw: number | null; generationMw: number | null; marginMw: number | null; asOf: string | null };

// Each entry here is one live US/regional grid-operator connector wired into
// ingest.ts (isoNe.ts, caisoOutlook.ts, ...). Adding a new ISO only needs a
// new entry here plus its own source file — no page/rendering changes.
const GRID_DEFS: { key: string; label: string }[] = [
  { key: "iso_ne", label: "New England (ISO-NE)" },
  { key: "caiso", label: "California (CAISO)" },
  { key: "nyiso", label: "New York (NYISO)" },
  { key: "miso", label: "Midcontinent (MISO)" },
  { key: "pjm", label: "Mid-Atlantic (PJM)" },
  { key: "ercot", label: "Texas (ERCOT)" },
  { key: "spp", label: "Southwest Power Pool (SPP)" },
];

export async function getGridSnapshots(): Promise<GridSnapshot[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    const keys = GRID_DEFS.flatMap((g) => [`energy.grid.${g.key}.load_mw`, `energy.grid.${g.key}.generation_mw`, `energy.grid.${g.key}.margin_mw`]);
    const latest = await fetchLatestForKeys(db, keys);
    return GRID_DEFS.map((g) => {
      const load = latest.get(`energy.grid.${g.key}.load_mw`);
      const gen = latest.get(`energy.grid.${g.key}.generation_mw`);
      const margin = latest.get(`energy.grid.${g.key}.margin_mw`);
      return {
        gridKey: g.key,
        gridLabel: g.label,
        loadMw: load?.v ?? null,
        generationMw: gen?.v ?? null,
        marginMw: margin?.v ?? null,
        asOf: load?.t ?? gen?.t ?? margin?.t ?? null,
      };
    }).filter((g) => g.loadMw !== null || g.generationMw !== null);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

export type ChemicalProductPrice = {
  value: number;
  previous: number | null;
  asOf: string;
  unit: string;
  basis: "spot" | "ppi" | "export_unit_value" | "import_unit_value";
};

/**
 * Latest value + previous reading (for TrendIndicator) for every Chemical
 * Products Master row that has real live pricing, keyed by product SLUG
 * (not by metric key — several rows share one underlying series, e.g. every
 * C6-C18 fatty acid resolves to the same UN Comtrade HS 3823 code, but each
 * still needs its own row in the result).
 *
 * Three distinct bases, preferred in this order per product:
 * 1. `spot` — a genuine daily traded spot price (chemicalProductsDatabase.ts's
 *    liveSpotMetricKey, currently only Propane via eiaChemicalFeedstockSpot.ts),
 *    unit "USD/GAL". The only tier that's an actual spot price, not a proxy.
 * 2. `ppi` — a real FRED Producer Price Index proxy (chemicalProductsDatabase.ts's
 *    livePriceMetricKey), monthly, unit "index 1982=100".
 * 3. `export_unit_value` / `import_unit_value` — UN Comtrade average unit
 *    value (declared customs value ÷ net weight) from the United States'
 *    own trade data (unComtradeChemicalPrices.ts), annual, unit "USD/MT".
 *    Export is preferred; import is used only when the US has no export
 *    data at all for that HS code (e.g. a chemical it's a net importer of).
 */
export async function getChemicalProductPrices(): Promise<Map<string, ChemicalProductPrice>> {
  const result = new Map<string, ChemicalProductPrice>();
  if (!isSupabaseConfigured) return result;
  try {
    const db = await createServerSupabase();
    const spotKeys = CHEMICAL_PRODUCTS.map((p) => p.liveSpotMetricKey).filter((k): k is string => Boolean(k));
    const ppiKeys = CHEMICAL_PRODUCTS.map((p) => p.livePriceMetricKey).filter((k): k is string => Boolean(k));
    const hsCodes = getChemicalPriceHsCodes().flatMap((c) => [c.primary, ...(c.fallback ? [c.fallback] : [])]);
    const hsKeys = hsCodes.flatMap((code) => [chemicalHsMetricKey(code, "export"), chemicalHsMetricKey(code, "import")]);
    const latest = await fetchLatestForKeys(db, [...new Set([...spotKeys, ...ppiKeys, ...hsKeys])]);

    for (const p of CHEMICAL_PRODUCTS) {
      if (p.liveSpotMetricKey) {
        const row = latest.get(p.liveSpotMetricKey);
        if (row) result.set(p.slug, { value: row.v, previous: row.previous?.v ?? null, asOf: row.t, unit: "USD/GAL", basis: "spot" });
        continue;
      }
      if (p.livePriceMetricKey) {
        const row = latest.get(p.livePriceMetricKey);
        if (row) result.set(p.slug, { value: row.v, previous: row.previous?.v ?? null, asOf: row.t, unit: "index 1982=100", basis: "ppi" });
        continue;
      }
      const codes = priceHsCodesFor(p);
      if (!codes) continue;
      // Try the primary code's export, then import, then (only if the
      // primary code has no data at all) the same two on the fallback code —
      // mirrors fetchChemicalHsUnitValue's own fetch-order so the read side
      // never disagrees with what the ingest side actually tried.
      const candidates: { key: string; basis: ChemicalProductPrice["basis"] }[] = [
        { key: chemicalHsMetricKey(codes.primary, "export"), basis: "export_unit_value" },
        { key: chemicalHsMetricKey(codes.primary, "import"), basis: "import_unit_value" },
        ...(codes.fallback
          ? [
              { key: chemicalHsMetricKey(codes.fallback, "export"), basis: "export_unit_value" as const },
              { key: chemicalHsMetricKey(codes.fallback, "import"), basis: "import_unit_value" as const },
            ]
          : []),
      ];
      const match = candidates.map((c) => ({ ...c, row: latest.get(c.key) })).find((c) => c.row);
      if (!match?.row) continue;
      result.set(p.slug, { value: match.row.v, previous: match.row.previous?.v ?? null, asOf: match.row.t, unit: "USD/MT", basis: match.basis });
    }
    return result;
  } catch (e) {
    console.error((e as Error).message);
    return result;
  }
}

export type FeedstockReferencePrice = { value: number; previous: number | null; asOf: string; unit: string };

/**
 * Crude Oil (WTI) and Natural Gas (Henry Hub) — real daily futures
 * settlement prices via Massive (massiveFutures.ts), shown on the Chemicals
 * overview page as upstream feedstock reference prices, directly closing
 * that page's own long-standing disclosed gap ("There is no free global
 * chemical spot-price source"). These are feedstocks, not finished
 * chemicals — genuinely different from the FRED PPI indices the rest of
 * that page shows, and labeled as such rather than implied to be a chemical
 * product's own price.
 */
export async function getChemicalFeedstockReferencePrices(): Promise<Map<string, FeedstockReferencePrice>> {
  const result = new Map<string, FeedstockReferencePrice>();
  if (!isSupabaseConfigured) return result;
  try {
    const db = await createServerSupabase();
    const keys = [massiveFuturesMetricKey("crude_oil"), massiveFuturesMetricKey("natural_gas")];
    const latest = await fetchLatestForKeys(db, keys);
    const bySlug: [string, string][] = [
      ["crude_oil", massiveFuturesMetricKey("crude_oil")],
      ["natural_gas", massiveFuturesMetricKey("natural_gas")],
    ];
    for (const [slug, key] of bySlug) {
      const row = latest.get(key);
      if (row) result.set(slug, { value: row.v, previous: row.previous?.v ?? null, asOf: row.t, unit: slug === "crude_oil" ? "USD/bbl" : "USD/MMBtu" });
    }
    return result;
  } catch (e) {
    console.error((e as Error).message);
    return result;
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
