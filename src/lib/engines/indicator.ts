import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLatest, fetchSeries } from "../metrics/store";
import { freshnessFor } from "../quality/freshness";
import type { IndicatorRef } from "./types";
import type { Point } from "../metrics/stats";

const SOURCE_TIER_BY_KEY: Record<string, number> = {
  fred: 1,
  cftc_cot: 1,
  fed_press: 1,
  ecb_press: 1,
  boe_press: 1,
  rbi_press: 1,
  frankfurter: 1,
  yahoo_finance: 3,
};

export async function buildIndicator(
  db: SupabaseClient,
  key: string,
  label: string,
  classification: "leading" | "coincident" | "lagging",
  frequency: "daily" | "weekly" | "monthly" | "quarterly" = "daily",
  unit?: string
): Promise<{ ref: IndicatorRef; series: Point[] }> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 400);
  const [latestPoint, series] = await Promise.all([
    fetchLatest(db, key),
    fetchSeries(db, key, since.toISOString()),
  ]);

  const status = freshnessFor(latestPoint?.t ?? null, frequency);
  const sourceKey = guessSourceKey(key);

  return {
    ref: {
      key,
      label,
      classification,
      value: latestPoint?.v ?? null,
      unit,
      status,
      sourceKey,
      sourceTier: SOURCE_TIER_BY_KEY[sourceKey] ?? 3,
      asOf: latestPoint?.t ?? null,
    },
    series,
  };
}

const YAHOO_FALLBACK_KEYS = new Set(["equity.russell2000", "equity.nifty50"]);

function guessSourceKey(metricKey: string): string {
  if (metricKey.startsWith("fx.")) return "frankfurter";
  if (YAHOO_FALLBACK_KEYS.has(metricKey)) return "yahoo_finance";
  if (metricKey.startsWith("cot.")) return "cftc_cot";
  return "fred";
}
