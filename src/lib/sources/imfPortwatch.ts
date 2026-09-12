import type { MetricPoint } from "../metrics/store";

/**
 * IMF PortWatch — Daily Chokepoint Transit Calls and Trade Volume Estimates.
 * Free, official (IMF), Tier 2. AIS-derived daily vessel transit counts and
 * capacity (deadweight-tonnage-equivalent proxy) for 28 global maritime
 * chokepoints, updated weekly (data itself runs a few days behind). Verified
 * live against the underlying ArcGIS FeatureServer before wiring in:
 * https://portwatch.imf.org/pages/data-and-methodology
 *
 * Energy Systemic Risk engine (energySystemicRisk.ts) — Shipping/Chokepoint
 * domain. This is the first genuinely free, official chokepoint-level feed
 * found for this project; it directly supersedes the "no free chokepoint
 * data exists" assumption from the original GESRI build, which relied on
 * GSCPI alone as a shipping-stress proxy.
 */
const FEATURE_SERVER_URL =
  "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query";

// Stable portid -> slug map, built from a live distinct-values query against
// the FeatureServer (see conversation history) rather than derived from
// portname text, which could change formatting upstream without notice.
export const CHOKEPOINT_SLUGS: Record<string, string> = {
  chokepoint1: "suez_canal",
  chokepoint2: "panama_canal",
  chokepoint3: "bosporus_strait",
  chokepoint4: "bab_el_mandeb",
  chokepoint5: "malacca_strait",
  chokepoint6: "hormuz",
  chokepoint7: "cape_of_good_hope",
  chokepoint8: "gibraltar",
  chokepoint9: "dover_strait",
  chokepoint10: "oresund_strait",
  chokepoint11: "taiwan_strait",
  chokepoint12: "korea_strait",
  chokepoint13: "tsugaru_strait",
  chokepoint14: "luzon_strait",
  chokepoint15: "lombok_strait",
  chokepoint16: "ombai_strait",
  chokepoint17: "bohai_strait",
  chokepoint18: "torres_strait",
  chokepoint19: "sunda_strait",
  chokepoint20: "makassar_strait",
  chokepoint21: "magellan_strait",
  chokepoint22: "yucatan_channel",
  chokepoint23: "windward_passage",
  chokepoint24: "mona_passage",
  chokepoint25: "balabac_strait",
  chokepoint26: "bering_strait",
  chokepoint27: "mindoro_strait",
  chokepoint28: "kerch_strait",
};

type PortwatchFeature = {
  attributes: {
    date: string; // "YYYY-MM-DD"
    portid: string;
    portname: string;
    n_total: number | null;
    n_tanker: number | null;
    n_dry_bulk: number | null;
    n_container: number | null;
    capacity: number | null;
    capacity_tanker: number | null;
  };
};

type FeatureServerResponse = {
  features?: PortwatchFeature[];
  exceededTransferLimit?: boolean;
  error?: { message: string };
};

const PAGE_SIZE = 2000;

async function queryPage(whereClause: string, offset: number): Promise<PortwatchFeature[]> {
  const url = new URL(FEATURE_SERVER_URL);
  url.searchParams.set("where", whereClause);
  url.searchParams.set("outFields", "date,portid,portname,n_total,n_tanker,n_dry_bulk,n_container,capacity,capacity_tanker");
  url.searchParams.set("f", "json");
  url.searchParams.set("orderByFields", "date ASC");
  url.searchParams.set("resultOffset", String(offset));
  url.searchParams.set("resultRecordCount", String(PAGE_SIZE));

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`IMF PortWatch: HTTP ${res.status}`);
  const json = (await res.json()) as FeatureServerResponse;
  if (json.error) throw new Error(`IMF PortWatch: ${json.error.message}`);
  return json.features ?? [];
}

export async function fetchImfPortwatchChokepoints(sinceIso: string): Promise<MetricPoint[]> {
  const sinceDate = sinceIso.slice(0, 10);
  const whereClause = `date >= DATE '${sinceDate}'`;
  const allFeatures: PortwatchFeature[] = [];
  let offset = 0;
  for (let page = 0; page < 50; page++) {
    // hard cap: 50 pages * 2000 = 100k rows, far beyond any realistic backfill window
    const features = await queryPage(whereClause, offset);
    allFeatures.push(...features);
    if (features.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const points: MetricPoint[] = [];
  for (const f of allFeatures) {
    const a = f.attributes;
    const slug = CHOKEPOINT_SLUGS[a.portid];
    if (!slug) continue; // unrecognized portid — skip rather than guess a key
    const date = a.date.slice(0, 10);
    if (typeof a.n_total === "number") {
      points.push({
        metric_key: `energy.chokepoint.${slug}.transits_total`,
        observed_at: date,
        value: a.n_total,
        unit: "vessels/day",
        source_key: "imf_portwatch",
        source_tier: 2,
        frequency: "daily",
      });
    }
    if (typeof a.n_tanker === "number") {
      points.push({
        metric_key: `energy.chokepoint.${slug}.transits_tanker`,
        observed_at: date,
        value: a.n_tanker,
        unit: "vessels/day",
        source_key: "imf_portwatch",
        source_tier: 2,
        frequency: "daily",
      });
    }
    if (typeof a.capacity === "number") {
      points.push({
        metric_key: `energy.chokepoint.${slug}.capacity_total`,
        observed_at: date,
        value: a.capacity,
        unit: "dwt_equivalent",
        source_key: "imf_portwatch",
        source_tier: 2,
        frequency: "daily",
      });
    }
  }
  return points;
}
