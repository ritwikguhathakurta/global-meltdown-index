import type { MetricPoint } from "../metrics/store";

/**
 * A genuine daily SPOT price for a petrochemical feedstock — the closest
 * thing to a free, ToS-clean "spot price scraper" for this app's Chemicals
 * section. Requested as a scraper of some free internet source; the obvious
 * candidate (SunSirs, which publishes real daily spot prices for ~40
 * industrial chemicals) was tested live and found to sit behind a Huawei
 * Cloud WAF bot-detection JS challenge on every page (homepage, sector
 * listing, and product-detail pages alike) — a plain server-side fetch gets
 * the challenge page, not data. This project already has a standing rule
 * against solving bot challenges to reach blocked content (see
 * rbiLiquidity.ts's own doc comment), so that source was dropped rather than
 * bypassed.
 *
 * EIA's `petroleum/pri/spt` dataset (US Energy Information Administration,
 * Open Data API v2, already used by eiaApi.ts) is a real, free, keyed-but-
 * unrestricted, Tier-1 official API — not a scrape at all, and immune to the
 * bot-challenge problem entirely. Its facet list was checked live
 * (`/v2/petroleum/pri/spt/facet/product/`) and has exactly 9 products: 8 are
 * refined transportation fuels or crude oil (already out of scope for
 * Chemicals, and crude oil/WTI/Brent are already covered by this app's
 * energy engines) — only ONE, Propane, is a genuine petrochemical feedstock
 * (propane dehydrogenation -> propylene, one of Chemicals' own primary
 * building blocks). This connector is intentionally narrow: it adds one
 * real daily spot series, not a broad multi-chemical feed, because that's
 * the entire genuine overlap between "free," "spot," "chemicals-relevant,"
 * and "not behind a bot wall."
 *
 * Series EER_EPLLPA_PF4_Y44MB_DPG: Mont Belvieu, TX Propane Spot Price FOB,
 * $/GAL, published on trading days (no weekend/holiday rows) — left in its
 * native EIA unit rather than converted to USD/MT, since a gallon-to-tonne
 * conversion requires an assumed propane density this app has no need to
 * invent.
 */

const SERIES_ID = "EER_EPLLPA_PF4_Y44MB_DPG";
export const CHEMICAL_PROPANE_SPOT_METRIC_KEY = "chemical.propane.spot_price";

type EiaSpotRow = { period: string; value: string | number | null };
type EiaSpotResponse = { response?: { data?: EiaSpotRow[] } };

export async function fetchEiaChemicalFeedstockSpot(apiKey: string): Promise<MetricPoint[]> {
  const url = new URL("https://api.eia.gov/v2/petroleum/pri/spt/data/");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("frequency", "daily");
  url.searchParams.set("data[0]", "value");
  url.searchParams.set("facets[series][]", SERIES_ID);
  url.searchParams.set("sort[0][column]", "period");
  url.searchParams.set("sort[0][direction]", "desc");
  // Trading days only, so 30 rows is ~6 weeks — plenty for a day-over-day
  // trend read; re-fetched and re-upserted (idempotent) on every run.
  url.searchParams.set("length", "30");

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`EIA petroleum/pri/spt: HTTP ${res.status}`);
  const json = (await res.json()) as EiaSpotResponse;
  const rows = json.response?.data ?? [];

  const points: MetricPoint[] = [];
  for (const r of rows) {
    const value = typeof r.value === "string" ? parseFloat(r.value) : r.value;
    if (value === null || value === undefined || Number.isNaN(value)) continue;
    points.push({
      metric_key: CHEMICAL_PROPANE_SPOT_METRIC_KEY,
      observed_at: r.period,
      value,
      unit: "USD/GAL",
      source_key: "eia_api",
      source_tier: 1,
      frequency: "daily",
    });
  }
  return points;
}
