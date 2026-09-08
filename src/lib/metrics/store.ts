import type { SupabaseClient } from "@supabase/supabase-js";
import type { Point } from "./stats";

export type MetricPoint = {
  metric_key: string;
  observed_at: string; // ISO date/timestamp
  value: number;
  unit?: string;
  source_key: string;
  source_tier: number;
  frequency?: "daily" | "weekly" | "monthly" | "quarterly" | "annual";
  raw?: unknown;
};

let sourceIdCache: Map<string, number> | null = null;

async function resolveSourceId(db: SupabaseClient, key: string): Promise<number | null> {
  if (!sourceIdCache) {
    const { data } = await db.from("sources").select("id, key");
    sourceIdCache = new Map((data ?? []).map((s: { key: string; id: number }) => [s.key, s.id]));
  }
  return sourceIdCache.get(key) ?? null;
}

export async function upsertMetrics(db: SupabaseClient, points: MetricPoint[]) {
  if (points.length === 0) return { inserted: 0 };
  // Stamped on every call, including one that re-confirms an already-stored value —
  // this is what freshness is computed from (see indicator.ts): "when did we last
  // successfully check this source and find this was the newest data it had", not
  // "when was this row first inserted" (that's the separate ingested_at column).
  const lastVerifiedAt = new Date().toISOString();
  const rows = [];
  for (const p of points) {
    const sourceId = await resolveSourceId(db, p.source_key);
    rows.push({
      metric_key: p.metric_key,
      observed_at: p.observed_at,
      value: p.value,
      unit: p.unit ?? null,
      source_id: sourceId,
      source_tier: p.source_tier,
      frequency: p.frequency ?? "daily",
      raw: p.raw ?? null,
      last_verified_at: lastVerifiedAt,
    });
  }
  const { error, count } = await db
    .from("metric_series")
    .upsert(rows, { onConflict: "metric_key,observed_at,source_id", count: "exact" });
  if (error) throw new Error(`upsertMetrics(${points[0]?.metric_key}): ${error.message}`);
  return { inserted: count ?? rows.length };
}

export async function fetchSeries(
  db: SupabaseClient,
  metricKey: string,
  sinceIso: string
): Promise<Point[]> {
  const { data, error } = await db
    .from("metric_series")
    .select("observed_at, value")
    .eq("metric_key", metricKey)
    .gte("observed_at", sinceIso)
    .order("observed_at", { ascending: true });
  if (error) throw new Error(`fetchSeries(${metricKey}): ${error.message}`);
  return (data ?? []).map((r) => ({ t: r.observed_at as string, v: r.value as number }));
}

export async function fetchLatest(
  db: SupabaseClient,
  metricKey: string
): Promise<{ t: string; v: number; lastVerifiedAt: string } | null> {
  const { data, error } = await db
    .from("metric_series")
    .select("observed_at, value, last_verified_at")
    .eq("metric_key", metricKey)
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`fetchLatest(${metricKey}): ${error.message}`);
  return data
    ? { t: data.observed_at as string, v: data.value as number, lastVerifiedAt: data.last_verified_at as string }
    : null;
}

/**
 * Batch version of fetchLatest for a whole set of metric keys in one query —
 * used by cross-sectional peer-group scoring (e.g. EM Debt: dozens of
 * per-country indicator keys need their latest value each) where one
 * fetchLatest() round trip per key would be needlessly slow. Rows come back
 * ordered by observed_at descending, so the first row seen per key is its
 * latest.
 */
export async function fetchLatestForKeys(
  db: SupabaseClient,
  metricKeys: string[]
): Promise<Map<string, { t: string; v: number; lastVerifiedAt: string }>> {
  const result = new Map<string, { t: string; v: number; lastVerifiedAt: string }>();
  if (metricKeys.length === 0) return result;
  const { data, error } = await db
    .from("metric_series")
    .select("metric_key, observed_at, value, last_verified_at")
    .in("metric_key", metricKeys)
    .order("observed_at", { ascending: false });
  if (error) throw new Error(`fetchLatestForKeys: ${error.message}`);
  for (const row of data ?? []) {
    const key = row.metric_key as string;
    if (!result.has(key)) {
      result.set(key, { t: row.observed_at as string, v: row.value as number, lastVerifiedAt: row.last_verified_at as string });
    }
  }
  return result;
}
