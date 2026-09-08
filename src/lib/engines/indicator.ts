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
  bundesbank: 1,
  boe: 1,
  boc: 1,
  chinabond: 1,
  bis: 1,
  gov_cn_statistics: 1,
  imf_article_iv: 1,
  statcan: 1,
  rbi_liquidity: 1,
  rbi_gsec_auctions: 1,
  ecb_sdw: 1,
  boj_stats: 1,
  mof_japan: 1,
  world_bank: 1,
  damodaran_nyu: 2,
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

  // Freshness is computed from when the pipeline last successfully verified this
  // is the newest data the source has (lastVerifiedAt), not from the data's own
  // reference-period date (t) — see the last_verified_at migration/store.ts for
  // why: a monthly or annual figure with real publication lag baked into its own
  // dating would otherwise always read as more stale than it actually is. asOf
  // below still shows the true reference-period date for display.
  const status = freshnessFor(latestPoint?.lastVerifiedAt ?? latestPoint?.t ?? null, frequency);
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
  if (metricKey === "yield.germany_10y") return "bundesbank";
  if (metricKey === "yield.uk_10y") return "boe";
  if (metricKey === "yield.canada_10y") return "boc";
  if (metricKey === "yield.japan_10y") return "mof_japan";
  if (metricKey === "yield.china_10y" || metricKey === "credit.china_corp_aaa_10y") return "chinabond";
  if (metricKey === "china.credit_impulse" || metricKey === "credit.uk_credit_gap" || metricKey === "credit.canada_credit_gap" || metricKey === "credit.japan_credit_gap") return "bis";
  if (
    metricKey === "china.pmi_new_orders" ||
    metricKey === "china.property_sales" ||
    metricKey === "china.developer_financing" ||
    metricKey === "supplychain.china_supplier_delivery_time"
  )
    return "gov_cn_statistics";
  if (metricKey === "china.lgfv_debt") return "imf_article_iv";
  if (metricKey === "supplychain.canada_inventory_sales_ratio") return "statcan";
  if (metricKey === "liquidity.uk_boe_reserves" || metricKey === "rate.uk_sonia" || metricKey === "rate.uk_bank_rate") return "boe";
  if (metricKey === "liquidity.canada_boc_assets" || metricKey === "rate.canada_corra" || metricKey === "rate.canada_target") return "boc";
  if (metricKey === "rate.ecb_estr") return "ecb_sdw";
  if (metricKey === "rate.japan_call_rate") return "boj_stats";
  if (metricKey === "india.rbi_net_liquidity" || metricKey === "india.wacr") return "rbi_liquidity";
  if (
    metricKey === "india.tbill_91d" ||
    metricKey === "india.tbill_364d" ||
    metricKey === "india.gsec_medium_yield" ||
    metricKey === "india.gsec_long_yield"
  )
    return "rbi_gsec_auctions";
  return "fred";
}
