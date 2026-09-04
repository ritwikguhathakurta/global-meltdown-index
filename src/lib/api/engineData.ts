import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { EngineRow } from "./types";

export async function getLatestEngine(engineKey: string): Promise<EngineRow[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("risk_engine_scores")
    .select("*")
    .eq("engine_key", engineKey)
    .order("as_of", { ascending: false })
    .limit(3); // short/medium/long for the latest as_of
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EngineRow[];
}

export async function getLatestGfmi() {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("gfmi_scores")
    .select("*")
    .order("as_of", { ascending: false })
    .limit(2); // current + previous, for change display
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLatestIndiaRegime() {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("india_regime")
    .select("*")
    .order("as_of", { ascending: false })
    .limit(3);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRecentCentralBankEvents(limit = 25) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("central_bank_events")
    .select("*")
    .order("event_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSourceRegistry() {
  const db = await createServerSupabase();
  const { data, error } = await db.from("sources").select("*").order("tier", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRecentPipelineRuns(limit = 20) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("pipeline_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
