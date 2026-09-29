import type { MetricPoint } from "../metrics/store";

/**
 * World Bank Open Data API — free, no key, official (same family as
 * worldBankEmDebt.ts / worldBankCommodities.ts). Confirmed live: indicator
 * MS.MIL.XPND.CD (military expenditure, current USD) for a fixed set of
 * geopolitically significant countries. This is the absolute-scale companion
 * to sipriMilex.ts's %-of-GDP ratio — same underlying SIPRI-sourced data as
 * republished by the World Bank, but as a dollar figure rather than a ratio,
 * so the two are complementary, not duplicative.
 *
 * Country slugs match sipriMilex.ts's SIPRI_COUNTRIES so both feed the same
 * per-country geopolitical.military_spend_* metric-key family.
 */
const WB_MILITARY_COUNTRIES: { iso3: string; slug: string }[] = [
  { iso3: "USA", slug: "usa" },
  { iso3: "CHN", slug: "china" },
  { iso3: "RUS", slug: "russia" },
  { iso3: "IND", slug: "india" },
  { iso3: "GBR", slug: "uk" },
  { iso3: "FRA", slug: "france" },
  { iso3: "DEU", slug: "germany" },
  { iso3: "JPN", slug: "japan" },
  { iso3: "KOR", slug: "south_korea" },
  { iso3: "SAU", slug: "saudi_arabia" },
  { iso3: "ISR", slug: "israel" },
  { iso3: "IRN", slug: "iran" },
  { iso3: "TUR", slug: "turkey" },
  { iso3: "PAK", slug: "pakistan" },
  { iso3: "UKR", slug: "ukraine" },
  { iso3: "POL", slug: "poland" },
  { iso3: "BRA", slug: "brazil" },
  { iso3: "AUS", slug: "australia" },
  { iso3: "EGY", slug: "egypt" },
];
const ISO3_LIST = WB_MILITARY_COUNTRIES.map((c) => c.iso3).join(";");
const ISO3_TO_SLUG = new Map(WB_MILITARY_COUNTRIES.map((c) => [c.iso3, c.slug]));

type WbObservation = { countryiso3code: string; date: string; value: number | null };

export async function fetchWorldBankMilitary(): Promise<MetricPoint[]> {
  const currentYear = new Date().getUTCFullYear();
  const url = `https://api.worldbank.org/v2/country/${ISO3_LIST}/indicator/MS.MIL.XPND.CD?format=json&per_page=500&date=2015:${currentYear}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`World Bank military expenditure: HTTP ${res.status}`);
  const json = (await res.json()) as [unknown, WbObservation[] | null];
  const rows = json[1] ?? [];

  // The whole 2015-current range is already fetched in one call — backfilling every published
  // year (not just the latest) costs nothing extra and gives real multi-year history immediately,
  // the same choice made in sipriMilex.ts.
  const points: MetricPoint[] = [];
  for (const row of rows) {
    if (row.value === null) continue;
    const slug = ISO3_TO_SLUG.get(row.countryiso3code);
    if (!slug) continue;
    points.push({
      metric_key: `geopolitical.military_spend_usd.${slug}`,
      observed_at: `${row.date}-12-31`,
      value: row.value,
      unit: "USD",
      source_key: "world_bank",
      source_tier: 1,
      frequency: "annual",
    });
  }
  if (points.length === 0) throw new Error("World Bank military expenditure: no data parsed for any tracked country");
  return points;
}
