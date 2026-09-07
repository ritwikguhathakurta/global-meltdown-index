import type { MetricPoint } from "../metrics/store";

/**
 * FRED (Federal Reserve Bank of St. Louis) — free, official, Tier 1 source.
 * Requires FRED_API_KEY (instant self-serve signup at fred.stlouisfed.org/docs/api/api_key.html).
 */

export type FredSeriesDef = {
  metricKey: string;
  seriesId: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annual";
  unit: string;
};

// Phase-1 series manifest. Extend this list as new engines come online —
// this is the single place that maps a Global Meltdown Index metric to a FRED series.
export const FRED_SERIES: FredSeriesDef[] = [
  { metricKey: "yield.us02y", seriesId: "DGS2", frequency: "daily", unit: "%" },
  { metricKey: "yield.us05y", seriesId: "DGS5", frequency: "daily", unit: "%" },
  { metricKey: "yield.us10y", seriesId: "DGS10", frequency: "daily", unit: "%" },
  { metricKey: "yield.us30y", seriesId: "DGS30", frequency: "daily", unit: "%" },
  { metricKey: "rate.fed_funds_effective", seriesId: "DFF", frequency: "daily", unit: "%" },
  { metricKey: "rate.sofr", seriesId: "SOFR", frequency: "daily", unit: "%" },
  { metricKey: "liquidity.fed_balance_sheet", seriesId: "WALCL", frequency: "weekly", unit: "USD mm" },
  // Ample-vs-scarce reserves gauge (see liquidityRegime.ts): IORB is the rate the Fed
  // itself sets as the reserves-supply control lever; WRESBAL is the actual weekly level
  // of reserve balances (Fed H.4.1) — the direct "ample reserves framework" metric, a
  // cleaner signal than total balance-sheet size (WALCL also includes non-reserve assets).
  { metricKey: "rate.us_iorb", seriesId: "IORB", frequency: "daily", unit: "%" },
  { metricKey: "liquidity.fed_reserve_balances", seriesId: "WRESBAL", frequency: "weekly", unit: "USD mm" },
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
  { metricKey: "commodity.natgas_henry_hub", seriesId: "DHHNGSP", frequency: "daily", unit: "USD/MMBtu" },

  // Banking engine (V3 §22) — Fed H.8 weekly release + delinquency/charge-off series
  { metricKey: "banking.deposits_total", seriesId: "DPSACBW027SBOG", frequency: "weekly", unit: "USD bn" },
  { metricKey: "banking.delinquency_rate_all_loans", seriesId: "DRALACBS", frequency: "quarterly", unit: "%" },
  { metricKey: "banking.chargeoff_rate_all_loans", seriesId: "CORALACBS", frequency: "quarterly", unit: "%" },
  { metricKey: "banking.cre_delinquency_rate", seriesId: "DRCRELEXFACBS", frequency: "quarterly", unit: "%" },

  // Property/CRE engine (V3 §23)
  { metricKey: "property.mortgage_rate_30y", seriesId: "MORTGAGE30US", frequency: "weekly", unit: "%" },
  { metricKey: "property.housing_starts", seriesId: "HOUST", frequency: "monthly", unit: "thousands SAAR" },
  { metricKey: "property.building_permits", seriesId: "PERMIT", frequency: "monthly", unit: "thousands SAAR" },

  // Global Sovereign Debt engine (V3 §21 extended beyond the US). UK/Germany/Canada 10Y yields
  // moved to direct central-bank daily sources (src/lib/sources/govBondYields.ts) — the OECD MEI
  // monthly proxy below structurally lags 2-4 months and a genuinely daily free alternative was
  // found for those three. Italy and France stay here: no equally clean free daily source found.
  { metricKey: "yield.italy_10y", seriesId: "IRLTLT01ITM156N", frequency: "monthly", unit: "%" },
  { metricKey: "yield.france_10y", seriesId: "IRLTLT01FRM156N", frequency: "monthly", unit: "%" },
  // Verified against FRED's own series metadata: these are genuinely Annual, not Quarterly —
  // IMF-compiled general-government-debt ratios that publish once a year with a real
  // multi-month-to-multi-year compilation lag. Mislabeling them "quarterly" doesn't change their
  // (correctly stale) real-world age, but does miscalibrate the LIVE/RECENT/STALE thresholds
  // against the wrong publication cadence.
  { metricKey: "sovereign.germany_debt_to_gdp", seriesId: "GGGDTADEA188N", frequency: "annual", unit: "%" },
  { metricKey: "sovereign.italy_debt_to_gdp", seriesId: "GGGDTAITA188N", frequency: "annual", unit: "%" },
  { metricKey: "sovereign.japan_debt_to_gdp", seriesId: "GGGDTAJPA188N", frequency: "annual", unit: "%" },
  { metricKey: "sovereign.uk_debt_to_gdp", seriesId: "GGGDTAGBA188N", frequency: "annual", unit: "%" },
  { metricKey: "sovereign.china_debt_to_gdp", seriesId: "GGGDTACNA188N", frequency: "annual", unit: "%" },

  // Emerging-Market Debt engine (V3 §11)
  { metricKey: "credit.em_dollar_index", seriesId: "DTWEXEMEGS", frequency: "daily", unit: "index" },

  // Global Dollar Liquidity extension (V3 §27) — broad financial-conditions proxy
  { metricKey: "liquidity.chicago_fed_nfci", seriesId: "NFCI", frequency: "weekly", unit: "index" },

  // Trade/Economic Policy engine (V3 §23 of engine list / §73)
  { metricKey: "trade.us_goods_services_balance", seriesId: "BOPGSTB", frequency: "monthly", unit: "USD mm" },

  // China engine (V3 §24) — partial; PMI/property/credit-impulse have no free daily source
  { metricKey: "china.exports_cny", seriesId: "XTEXVA01CNM667S", frequency: "monthly", unit: "CNY" },
  { metricKey: "china.imports_cny", seriesId: "XTIMVA01CNM667S", frequency: "monthly", unit: "CNY" },
  { metricKey: "china.cpi_index", seriesId: "CHNCPIALLMINMEI", frequency: "monthly", unit: "index" },
  { metricKey: "china.interbank_rate_3m", seriesId: "IR3TIB01CNM156N", frequency: "monthly", unit: "%" },
  { metricKey: "property.hpi_real_china", seriesId: "QCNR628BIS", frequency: "quarterly", unit: "index_2010_100" },
  { metricKey: "credit.asia_em_oas", seriesId: "BAMLEMRACRPIASIAOAS", frequency: "daily", unit: "%" },

  // --- G7 coverage (requested explicitly: most engines above were US-only) ---

  // Canada — completes G7 sovereign coverage. 10Y yield moved to the Bank of Canada Valet API
  // (govBondYields.ts) — daily, vs. this FRED/OECD monthly proxy.
  { metricKey: "sovereign.canada_debt_to_gdp", seriesId: "GGGDTACAA188N", frequency: "annual", unit: "%" },

  // G7 real house price indices (BIS series, same methodology across all 7 -> genuinely
  // comparable, unlike mixing one country's nominal index with another's) — Property engine
  { metricKey: "property.hpi_real_us", seriesId: "QUSR628BIS", frequency: "quarterly", unit: "index_2010_100" },
  { metricKey: "property.hpi_real_canada", seriesId: "QCAR628BIS", frequency: "quarterly", unit: "index_2010_100" },
  { metricKey: "property.hpi_real_uk", seriesId: "QGBR628BIS", frequency: "quarterly", unit: "index_2010_100" },
  { metricKey: "property.hpi_real_germany", seriesId: "QDER628BIS", frequency: "quarterly", unit: "index_2010_100" },
  { metricKey: "property.hpi_real_france", seriesId: "QFRR628BIS", frequency: "quarterly", unit: "index_2010_100" },
  { metricKey: "property.hpi_real_italy", seriesId: "QITR628BIS", frequency: "quarterly", unit: "index_2010_100" },
  { metricKey: "property.hpi_real_japan", seriesId: "QJPR628BIS", frequency: "quarterly", unit: "index_2010_100" },

  // Euro-area corporate credit — Credit engine was US-only (HY/IG/EM OAS)
  { metricKey: "credit.euro_hy_oas", seriesId: "BAMLHE00EHYIOAS", frequency: "daily", unit: "%" },

  // Other G7 central banks — Global Liquidity and Banking engines were Fed-only
  { metricKey: "liquidity.ecb_balance_sheet", seriesId: "ECBASSETSW", frequency: "weekly", unit: "EUR mm" },
  { metricKey: "liquidity.boj_balance_sheet", seriesId: "JPNASSETS", frequency: "monthly", unit: "JPY bn" },
  { metricKey: "rate.ecb_deposit_facility", seriesId: "ECBDFR", frequency: "daily", unit: "%" },
  { metricKey: "rate.uk_short_term", seriesId: "IRSTCI01GBM156N", frequency: "monthly", unit: "%" },

  // Supply Chains engine (V3 §24) — extending beyond the single global NY Fed
  // GSCPI number to per-country OECD Business Tendency Survey (BTS) series,
  // mirrored on FRED. "Order Books: Current" is a net-balance survey (%
  // reporting above-normal minus % reporting below-normal): rising backlogs
  // relative to normal is a genuine capacity/delivery-strain signal, the same
  // concept GSCPI's own PMI sub-components draw on. Checked all G7 + China:
  // US/Germany/France/Italy have live Order Books series; the UK's own
  // OECD-submitted Order Books AND Finished Goods Stocks series were both
  // discontinued in March 2021 (confirmed via FRED's own series metadata),
  // and the UK's real-world equivalent (the CBI Industrial Trends Survey) is
  // behind Cloudflare bot-protection on cbi.org.uk — so the UK is the one G7
  // member still genuinely uncovered here, not silently dropped. Japan has
  // no Order Books series in this dataset at all, but does have "Finished
  // Goods Stocks: Current" (JPNBSFGLV02STSAQ, quarterly) — used as Japan's
  // proxy instead; interpreted the same direction (goods piling up unable to
  // move through the chain, the 2021-22 chip-shortage pattern where WIP/
  // finished-vehicle inventory rose because production couldn't ship), which
  // is a real but distinct reading from plain demand-weakness inventory
  // buildup — disclosed as an interpretive caveat on the methodology page.
  // Canada has no matching OECD/FRED series either (its own submission
  // stopped in 2023) — see statCan.ts for its direct-from-source connector.
  // China's proxy comes from NBS's own PMI supplier-delivery-time subindex
  // (see govCnStatistics.ts).
  { metricKey: "supplychain.us_order_books", seriesId: "BSOBLV02USM460S", frequency: "monthly", unit: "% balance" },
  { metricKey: "supplychain.germany_order_books", seriesId: "BSOBLV02DEM460S", frequency: "monthly", unit: "% balance" },
  { metricKey: "supplychain.france_order_books", seriesId: "BSOBLV02FRM460S", frequency: "monthly", unit: "% balance" },
  { metricKey: "supplychain.italy_order_books", seriesId: "BSOBLV02ITM460S", frequency: "monthly", unit: "% balance" },
  { metricKey: "supplychain.japan_finished_goods_stocks", seriesId: "JPNBSFGLV02STSAQ", frequency: "quarterly", unit: "% balance" },

  // India Yield Curve engine — long-end cross-check. RBI's own G-Sec auction
  // cutoffs (rbiYieldCurve.ts) only update the long end on weeks a 10Y+
  // security is actually auctioned; this OECD-mirrored monthly benchmark
  // fills the gap between those auctions. CCIL's own secondary-market Zero
  // Coupon Yield Curve was deliberately not used — its Terms of Use forbid
  // automated data collection and commercial use without written consent
  // (see rbiYieldCurve.ts and rbiLiquidity.ts for the full explanation).
  { metricKey: "india.gsec_10y", seriesId: "INDIRLTLT01STM", frequency: "monthly", unit: "%" },
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
