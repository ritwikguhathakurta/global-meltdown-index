import type { MetricPoint } from "../metrics/store";
import { COMMODITIES } from "../commodities/taxonomy";

/**
 * Critical-mineral commodity prices (Cobalt, Lithium, Manganese, Molybdenum,
 * Vanadium Pentoxide, a Rare Earth Elements basket) — free, no key, no
 * login, monthly since as early as 1990 depending on series.
 *
 * These are IMF Primary Commodity Price System (PCPS) series. IMF's own API
 * endpoints for this were checked live and are dead: the legacy
 * dataservices.imf.org/REST/SDMX_JSON.svc host does not resolve, and the
 * newer api.imf.org/external/sdmx/3.0 returns 404 for this dataset. DBnomics
 * (db.nomics.world, an open-source, no-auth data aggregator) mirrors the
 * same underlying IMF/PCPS dataset and was verified live: real monthly
 * values since 2012 (Cobalt since 1990) matching known market history (e.g.
 * Lithium's IMF series spikes to ~$410k/mt in Nov 2022 and crashes through
 * 2023-2025 — consistent with the real lithium carbonate price collapse on
 * a contained-metal basis).
 *
 * https://db.nomics.world/IMF/PCPS
 *
 * Graphite, Tungsten, and a distinct OPEC Reference Basket series were
 * checked directly against this same PCPS dataset and are absent — not
 * substituted or estimated; disclosed as a gap on the Commodities dashboard.
 */

const DBNOMICS_BASE = "https://api.db.nomics.world/v22/series/IMF/PCPS";

type DbnomicsSeriesResponse = {
  series: {
    docs: { period: string[]; value: number[] }[];
  };
};

function periodToIsoDate(period: string): string | null {
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const [, year, month] = m;
  return `${year}-${month}-01`;
}

export async function fetchCriticalMineralPrices(sinceIso: string): Promise<MetricPoint[]> {
  const minerals = COMMODITIES.filter((c) => c.source === "imf_pcps_dbnomics" && c.dbnomicsSeriesCode);
  const points: MetricPoint[] = [];

  for (const mineral of minerals) {
    const url = `${DBNOMICS_BASE}/M.W00.${mineral.dbnomicsSeriesCode}.USD?observations=1`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`DBnomics IMF/PCPS ${mineral.dbnomicsSeriesCode}: HTTP ${res.status}`);
    const json = (await res.json()) as DbnomicsSeriesResponse;
    const doc = json.series?.docs?.[0];
    if (!doc) continue;

    for (let i = 0; i < doc.period.length; i++) {
      const observedAt = periodToIsoDate(doc.period[i]);
      const value = doc.value[i];
      if (!observedAt || observedAt < sinceIso || value === null || Number.isNaN(value)) continue;
      points.push({
        metric_key: `commodity.${mineral.slug}.price`,
        observed_at: observedAt,
        value,
        unit: mineral.unit,
        source_key: "imf_pcps_dbnomics",
        source_tier: 1,
        frequency: "monthly",
      });
    }
  }
  return points;
}
