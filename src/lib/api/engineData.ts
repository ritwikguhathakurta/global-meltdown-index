import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { computeIndiaSeasonalNotes } from "@/lib/engines/indiaSeasonality";
import { getCentralBankLiquidityTable as computeCentralBankLiquidityTable, type CentralBankLiquidityRow } from "@/lib/engines/liquidityRegime";
import { getCountryCreditTable as computeCountryCreditTable, type CountryCreditRow } from "@/lib/engines/creditRegime";
import { getCountryEmDebtTable as computeCountryEmDebtTable, type CountryEmDebtRow } from "@/lib/engines/emDebtRegime";
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

export async function getRecentPipelineRuns(limit = 20): Promise<PipelineRunRow[]> {
  const db = await createServerSupabase();
  return safe<PipelineRunRow[]>(
    () => db.from("pipeline_runs").select("*").order("started_at", { ascending: false }).limit(limit),
    []
  );
}
