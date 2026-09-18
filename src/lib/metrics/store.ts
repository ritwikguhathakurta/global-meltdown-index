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

/** PostgREST caps any unpaginated response at 1000 rows (this project's
 * Supabase project uses the default db-max-rows). A long daily series —
 * BOJ's call rate since 1998, BoE's Bank Rate since 2000, etc. — has far
 * more than 1000 observations, so an unpaginated `.select()` here silently
 * returned only the OLDEST 1000 rows (the query orders ascending), cutting
 * every such series off decades early with no error raised anywhere.
 * Discovered live: BoE's Bank Rate cut off in December 2003, making a
 * genuine 2003 rate hike look like "the most recent move, 39 days ago" on
 * the Banking tab. Paginates with `.range()` until a page comes back
 * shorter than the page size, so every caller gets the FULL series
 * regardless of how far back `sinceIso` reaches. */
const FETCH_PAGE_SIZE = 1000;

export async function fetchSeries(
  db: SupabaseClient,
  metricKey: string,
  sinceIso: string
): Promise<Point[]> {
  const points: Point[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await db
      .from("metric_series")
      .select("observed_at, value")
      .eq("metric_key", metricKey)
      .gte("observed_at", sinceIso)
      .order("observed_at", { ascending: true })
      .range(offset, offset + FETCH_PAGE_SIZE - 1);
    if (error) throw new Error(`fetchSeries(${metricKey}): ${error.message}`);
    const page = data ?? [];
    for (const r of page) points.push({ t: r.observed_at as string, v: r.value as number });
    if (page.length < FETCH_PAGE_SIZE) break;
    offset += FETCH_PAGE_SIZE;
  }
  return points;
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
 * latest, and the second row seen per key is its previous reading (for a
 * trend indicator), exposed as `previous`.
 *
 * Same missing-pagination risk as fetchSeries above: an `.in()` filter
 * across many metric keys can easily exceed the 1000-row cap on its own
 * (e.g. EM Debt's dozens of daily per-country keys), which would silently
 * drop whichever keys' rows didn't make it into the first page. Paginates,
 * with an early exit once every requested key already has both a latest
 * and a previous reading (the only two rows per key this function ever
 * uses) — the common case resolves in one page; a hard cap keeps a
 * pathological single-observation key (previous permanently null) from
 * forcing a full-history scan.
 */
const FETCH_LATEST_MAX_PAGES = 20;

export async function fetchLatestForKeys(
  db: SupabaseClient,
  metricKeys: string[]
): Promise<Map<string, { t: string; v: number; lastVerifiedAt: string; previous: { t: string; v: number } | null }>> {
  const result = new Map<string, { t: string; v: number; lastVerifiedAt: string; previous: { t: string; v: number } | null }>();
  if (metricKeys.length === 0) return result;
  const pending = new Set(metricKeys);

  for (let page = 0; page < FETCH_LATEST_MAX_PAGES && pending.size > 0; page++) {
    const { data, error } = await db
      .from("metric_series")
      .select("metric_key, observed_at, value, last_verified_at")
      .in("metric_key", metricKeys)
      .order("observed_at", { ascending: false })
      .range(page * FETCH_PAGE_SIZE, page * FETCH_PAGE_SIZE + FETCH_PAGE_SIZE - 1);
    if (error) throw new Error(`fetchLatestForKeys: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      const key = row.metric_key as string;
      const existing = result.get(key);
      if (!existing) {
        result.set(key, { t: row.observed_at as string, v: row.value as number, lastVerifiedAt: row.last_verified_at as string, previous: null });
      } else if (!existing.previous) {
        existing.previous = { t: row.observed_at as string, v: row.value as number };
        pending.delete(key);
      }
    }
    if (rows.length < FETCH_PAGE_SIZE) break; // no more data at all
  }
  return result;
}
