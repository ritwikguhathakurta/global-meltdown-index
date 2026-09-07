import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { computeIndiaSeasonalNotes } from "@/lib/engines/indiaSeasonality";
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

export async function getRecentPipelineRuns(limit = 20): Promise<PipelineRunRow[]> {
  const db = await createServerSupabase();
  return safe<PipelineRunRow[]>(
    () => db.from("pipeline_runs").select("*").order("started_at", { ascending: false }).limit(limit),
    []
  );
}
