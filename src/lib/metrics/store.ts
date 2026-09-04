import type { SupabaseClient } from "@supabase/supabase-js";
import type { Point } from "./stats";

export type MetricPoint = {
  metric_key: string;
  observed_at: string; // ISO date/timestamp
  value: number;
  unit?: string;
  source_key: string;
  source_tier: number;
  frequency?: "daily" | "weekly" | "monthly" | "quarterly";
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
): Promise<{ t: string; v: number } | null> {
  const { data, error } = await db
    .from("metric_series")
    .select("observed_at, value")
    .eq("metric_key", metricKey)
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`fetchLatest(${metricKey}): ${error.message}`);
  return data ? { t: data.observed_at as string, v: data.value as number } : null;
}
