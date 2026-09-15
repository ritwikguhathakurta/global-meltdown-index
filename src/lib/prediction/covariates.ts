/**
 * Real covariate series for the Prediction tab's multivariate model — every
 * entry here is an ALREADY-INGESTED metric_key from this app's own pipeline
 * (USDA PSD world balances, EIA world energy, FAOSTAT world production, or
 * the Fed's Broad Dollar Index), never a value computed just for this
 * feature. Mapping a price-taxonomy slug (src/lib/commodities/taxonomy.ts)
 * to a fundamentals slug (src/lib/commodities/balanceTaxonomy.ts) is
 * intentionally explicit and manual per row — they use different slug
 * spaces (e.g. price slug "wti_crude" vs. fundamentals slug
 * "petroleum_liquids_world"), and a wrong pairing here would silently mix
 * two different physical things, the same class of bug already caught once
 * this session (Nickel HS-code mismatch).
 *
 * USGS-sourced fundamentals (all metals, precious metals, critical
 * minerals, and both fertilizers) are deliberately NOT included here: MCS is
 * a current-year-summary publication with only ~2 years of history per
 * commodity (see countryBalanceTaxonomy.ts), nowhere near enough to fit or
 * backtest a regression. Forcing a "multivariate" model on 2 data points
 * would produce a meaningless number that looks precise — exactly what this
 * app's rules forbid. Those commodities fall back to the univariate
 * time-series path, same as anything else below whose covariates don't
 * clear the minimum-overlap bar the API route checks at request time.
 */

export type CovariateSeriesDef = {
  metricKey: string;
  label: string;
};

function psd(fundamentalsSlug: string): CovariateSeriesDef[] {
  return [
    { metricKey: `commodity.${fundamentalsSlug}.production`, label: "World production" },
    { metricKey: `commodity.${fundamentalsSlug}.consumption`, label: "World consumption" },
    { metricKey: `commodity.${fundamentalsSlug}.ending_stocks`, label: "World ending stocks" },
  ];
}

function worldEnergy(fundamentalsSlug: string): CovariateSeriesDef[] {
  return [
    { metricKey: `commodity.${fundamentalsSlug}.production`, label: "World production" },
    { metricKey: `commodity.${fundamentalsSlug}.consumption`, label: "World consumption" },
  ];
}

function faostatProduction(fundamentalsSlug: string): CovariateSeriesDef[] {
  return [{ metricKey: `commodity.${fundamentalsSlug}.production`, label: "World production" }];
}

/** price-taxonomy slug -> real fundamentals covariates, where a clean world-level match exists. */
const FUNDAMENTALS_BY_PRICE_SLUG: Record<string, CovariateSeriesDef[]> = {
  // Energy (EIA world aggregate; multiple benchmark price series share one physical fundamental)
  crude_oil_average: worldEnergy("petroleum_liquids_world"),
  brent_crude: worldEnergy("petroleum_liquids_world"),
  dubai_crude: worldEnergy("petroleum_liquids_world"),
  wti_crude: worldEnergy("petroleum_liquids_world"),
  natural_gas_us: worldEnergy("natural_gas_world"),
  natural_gas_europe: worldEnergy("natural_gas_world"),
  lng_japan: worldEnergy("natural_gas_world"),
  coal_australian: worldEnergy("coal_world"),
  coal_south_african: worldEnergy("coal_world"),

  // Grains (USDA PSD, direct slug match except rice/wheat benchmarks)
  barley: psd("barley"),
  maize: psd("maize"),
  sorghum: psd("sorghum"),
  rice_thai_5pct: psd("rice"),
  wheat_us_srw: psd("wheat"),
  wheat_us_hrw: psd("wheat"),

  // Oilseeds (USDA PSD, direct slug match)
  coconut_oil: psd("coconut_oil"),
  palm_oil: psd("palm_oil"),
  palm_kernel_oil: psd("palm_kernel_oil"),
  soybeans: psd("soybeans"),
  soybean_oil: psd("soybean_oil"),
  soybean_meal: psd("soybean_meal"),
  rapeseed_oil: psd("rapeseed_oil"),
  sunflower_oil: psd("sunflower_oil"),

  // Soft commodities (USDA PSD where tracked; FAOSTAT production-only otherwise)
  cocoa: faostatProduction("cocoa"),
  coffee_arabica: psd("coffee"), // USDA PSD tracks green coffee as one world balance, not split by arabica/robusta
  coffee_robusta: psd("coffee"),
  tea_avg: faostatProduction("tea"),
  cotton: psd("cotton"),
  rubber_tsr20: faostatProduction("rubber"),
  sugar_world: psd("sugar_world"),

  // Livestock
  beef: psd("beef"),
  chicken: psd("chicken"),

  // Forestry (only tobacco has a FAOSTAT match; the two log price series don't)
  tobacco_us: faostatProduction("tobacco"),
};

export const DXY_COVARIATE: CovariateSeriesDef = {
  metricKey: "fx.dxy_broad",
  label: "US Dollar Index (Fed Broad, DXY-style)",
};

/**
 * Every candidate covariate for a price slug: its category fundamentals (if
 * any real match exists) plus the dollar index, which applies to every
 * USD-denominated commodity here. The API route still verifies each one has
 * enough real overlapping history before using it — this function only says
 * what's worth trying, not what's guaranteed usable for a given commodity.
 */
export function getCandidateCovariates(priceSlug: string): CovariateSeriesDef[] {
  return [...(FUNDAMENTALS_BY_PRICE_SLUG[priceSlug] ?? []), DXY_COVARIATE];
}
