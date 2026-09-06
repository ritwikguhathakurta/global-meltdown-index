import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLatest, fetchSeries } from "../metrics/store";
import { freshnessFor } from "../quality/freshness";
import { lookbackDaysFor } from "../metrics/lookback";
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
  ny_fed_gscpi: 1,
  gpr_index: 2,
  coingecko: 3,
  aws_status: 1,
  azure_status: 1,
  gcp_status: 1,
  sec_edgar: 1,
};

export async function buildIndicator(
  db: SupabaseClient,
  key: string,
  label: string,
  classification: "leading" | "coincident" | "lagging",
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annual" = "daily",
  unit?: string
): Promise<{ ref: IndicatorRef; series: Point[] }> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDaysFor(frequency));
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

const YAHOO_FALLBACK_KEYS = new Set([
  "equity.russell2000",
  "equity.nifty50",
  "equity.dax",
  "equity.ftse100",
  "equity.cac40",
  "equity.ftsemib",
  "equity.tsx_composite",
  "equity.shanghai_composite",
  "equity.spy_cap_weighted",
  "equity.rsp_equal_weighted",
  "equity.qqq_cap_weighted",
  "equity.qqqe_equal_weighted",
  "privatecredit.bdc_arcc",
  "privatecredit.bdc_main",
  "privatecredit.bdc_fsk",
  "privatecredit.bdc_obdc",
  "privatecredit.bdc_bxsl",
  "ai.msft.price",
  "ai.googl.price",
  "ai.amzn.price",
  "ai.meta.price",
  "ai.orcl.price",
  "ai.nvda.price",
  "ai.amd.price",
  "ai.avgo.price",
  "crypto.btc_price_usd",
  "crypto.eth_price_usd",
]);

function guessSourceKey(metricKey: string): string {
  if (metricKey.startsWith("fx.")) return "frankfurter";
  if (YAHOO_FALLBACK_KEYS.has(metricKey)) return "yahoo_finance";
  if (metricKey.startsWith("cot.")) return "cftc_cot";
  if (metricKey === "supplychain.gscpi") return "ny_fed_gscpi";
  if (metricKey.startsWith("geopolitical.gpr")) return "gpr_index";
  if (metricKey.startsWith("crypto.")) return "coingecko";
  if (metricKey === "cyber.aws_status_events_7d") return "aws_status";
  if (metricKey === "cyber.azure_status_events_7d") return "azure_status";
  if (metricKey === "cyber.gcp_status_events_7d") return "gcp_status";
  if (metricKey.startsWith("ai.") && !metricKey.endsWith(".price")) return "sec_edgar";
  return "fred";
}
