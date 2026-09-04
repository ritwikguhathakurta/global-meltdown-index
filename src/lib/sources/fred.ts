import type { MetricPoint } from "../metrics/store";

/**
 * FRED (Federal Reserve Bank of St. Louis) — free, official, Tier 1 source.
 * Requires FRED_API_KEY (instant self-serve signup at fred.stlouisfed.org/docs/api/api_key.html).
 */

export type FredSeriesDef = {
  metricKey: string;
  seriesId: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  unit: string;
};

// Phase-1 series manifest. Extend this list as new engines come online —
// this is the single place that maps a MacroSignal metric to a FRED series.
export const FRED_SERIES: FredSeriesDef[] = [
  { metricKey: "yield.us02y", seriesId: "DGS2", frequency: "daily", unit: "%" },
  { metricKey: "yield.us05y", seriesId: "DGS5", frequency: "daily", unit: "%" },
  { metricKey: "yield.us10y", seriesId: "DGS10", frequency: "daily", unit: "%" },
  { metricKey: "yield.us30y", seriesId: "DGS30", frequency: "daily", unit: "%" },
  { metricKey: "rate.fed_funds_effective", seriesId: "DFF", frequency: "daily", unit: "%" },
  { metricKey: "rate.sofr", seriesId: "SOFR", frequency: "daily", unit: "%" },
  { metricKey: "liquidity.fed_balance_sheet", seriesId: "WALCL", frequency: "weekly", unit: "USD mm" },
  { metricKey: "liquidity.reverse_repo", seriesId: "RRPONTSYD", frequency: "daily", unit: "USD bn" },
  { metricKey: "liquidity.m2", seriesId: "M2SL", frequency: "monthly", unit: "USD bn" },
  { metricKey: "liquidity.treasury_general_account", seriesId: "WTREGEN", frequency: "weekly", unit: "USD bn" },
  { metricKey: "fx.dxy_broad", seriesId: "DTWEXBGS", frequency: "daily", unit: "index" },
  { metricKey: "vol.vix", seriesId: "VIXCLS", frequency: "daily", unit: "index" },
  { metricKey: "credit.hy_oas", seriesId: "BAMLH0A0HYM2", frequency: "daily", unit: "%" },
  { metricKey: "credit.ig_oas", seriesId: "BAMLC0A0CM", frequency: "daily", unit: "%" },
  { metricKey: "credit.em_oas", seriesId: "BAMLEMCBPIOAS", frequency: "daily", unit: "%" },
  { metricKey: "sovereign.us_debt_to_gdp", seriesId: "GFDEGDQ188S", frequency: "quarterly", unit: "%" },
  { metricKey: "yield.japan_10y_proxy", seriesId: "IRLTLT01JPM156N", frequency: "monthly", unit: "%" },
  { metricKey: "macro.us_cpi_yoy", seriesId: "CPIAUCSL", frequency: "monthly", unit: "index" },
  { metricKey: "equity.sp500", seriesId: "SP500", frequency: "daily", unit: "index" },
  { metricKey: "equity.nasdaq_composite", seriesId: "NASDAQCOM", frequency: "daily", unit: "index" },
  { metricKey: "equity.djia", seriesId: "DJIA", frequency: "daily", unit: "index" },
  { metricKey: "equity.nikkei225", seriesId: "NIKKEI225", frequency: "daily", unit: "index" },
  { metricKey: "commodity.brent", seriesId: "DCOILBRENTEU", frequency: "daily", unit: "USD/bbl" },
  { metricKey: "commodity.wti", seriesId: "DCOILWTICO", frequency: "daily", unit: "USD/bbl" },
];

export async function fetchFredSeries(
  def: FredSeriesDef,
  apiKey: string,
  sinceIso: string
): Promise<MetricPoint[]> {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", def.seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("observation_start", sinceIso.slice(0, 10));

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`FRED ${def.seriesId}: HTTP ${res.status}`);
  const json = (await res.json()) as { observations?: { date: string; value: string }[] };

  return (json.observations ?? [])
    .filter((o) => o.value !== ".")
    .map((o) => ({
      metric_key: def.metricKey,
      observed_at: o.date,
      value: Number(o.value),
      unit: def.unit,
      source_key: "fred",
      source_tier: 1,
      frequency: def.frequency,
      raw: { series_id: def.seriesId },
    }));
}
