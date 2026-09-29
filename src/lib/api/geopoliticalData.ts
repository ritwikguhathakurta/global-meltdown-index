import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchSeries } from "@/lib/metrics/store";
import type { Point } from "@/lib/metrics/stats";
import { buildCountryMilitaryRows, computeMilitaryBuildup } from "@/lib/geopolitical/military";
import { computeSanctionsIntensity } from "@/lib/geopolitical/sanctions";
import { computeEscalation } from "@/lib/geopolitical/escalation";
import { buildChokepointRows, computeChokepointStress } from "@/lib/geopolitical/chokepoints";
import { computeGewi } from "@/lib/geopolitical/gewi";
import { HISTORICAL_GEO_EVENTS } from "@/lib/geopolitical/historical";
import { SIPRI_COUNTRIES } from "@/lib/sources/sipriMilex";
import { CHOKEPOINT_SLUGS } from "@/lib/sources/imfPortwatch";
import type { CompositeIndex, CountryMilitaryRow, ChokepointRow } from "@/lib/geopolitical/types";

const OFAC_PROGRAMS = ["russia", "iran", "north_korea", "cuba", "venezuela", "syria", "belarus", "ukraine_related", "terrorism", "weapons_proliferation"];
const CHOKEPOINTS = [
  { slug: "suez_canal", label: "Suez Canal" },
  { slug: "panama_canal", label: "Panama Canal" },
  { slug: "hormuz", label: "Strait of Hormuz" },
  { slug: "malacca_strait", label: "Strait of Malacca" },
  { slug: "bab_el_mandeb", label: "Bab el-Mandeb" },
  { slug: "bosporus_strait", label: "Bosporus Strait" },
  { slug: "cape_of_good_hope", label: "Cape of Good Hope" },
  { slug: "taiwan_strait", label: "Taiwan Strait" },
];

export type GeopoliticalPageData = {
  fetchedAt: string;
  indices: { gewi: CompositeIndex; militaryBuildup: CompositeIndex; sanctionsIntensity: CompositeIndex; escalation: CompositeIndex; chokepointStress: CompositeIndex };
  militaryRows: CountryMilitaryRow[];
  chokepointRows: ChokepointRow[];
  historicalEvents: typeof HISTORICAL_GEO_EVENTS;
};

export async function getGeopoliticalPageData(): Promise<GeopoliticalPageData | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    const sinceLong = new Date(Date.now() - 80 * 365 * 86_400_000).toISOString(); // SIPRI history back to 1949
    const since2y = new Date(Date.now() - 780 * 86_400_000).toISOString();

    const [pctGdpSeriesList, usdSeriesList, sdnSeriesList, chokepointSeriesList, goldsteinSeries, conflictShareSeries, gprThreatsSeries] = await Promise.all([
      Promise.all(SIPRI_COUNTRIES.map((c) => fetchSeries(db, `geopolitical.military_spend_pct_gdp.${c.slug}`, sinceLong).catch(() => [] as Point[]))),
      Promise.all(SIPRI_COUNTRIES.map((c) => fetchSeries(db, `geopolitical.military_spend_usd.${c.slug}`, sinceLong).catch(() => [] as Point[]))),
      Promise.all(OFAC_PROGRAMS.map((p) => fetchSeries(db, `geopolitical.ofac_sdn_count.${p}`, since2y).catch(() => [] as Point[]))),
      Promise.all(CHOKEPOINTS.map((c) => fetchSeries(db, `energy.chokepoint.${c.slug}.transits_total`, since2y).catch(() => [] as Point[]))),
      fetchSeries(db, "geopolitical.gdelt.avg_goldstein", since2y).catch(() => [] as Point[]),
      fetchSeries(db, "geopolitical.gdelt.conflict_event_share", since2y).catch(() => [] as Point[]),
      fetchSeries(db, "geopolitical.gpr_threats", since2y).catch(() => [] as Point[]),
    ]);

    const spendPctGdpByCountry: Record<string, Point[]> = {};
    const spendUsdByCountry: Record<string, Point[]> = {};
    SIPRI_COUNTRIES.forEach((c, i) => {
      spendPctGdpByCountry[c.slug] = pctGdpSeriesList[i];
      spendUsdByCountry[c.slug] = usdSeriesList[i];
    });
    const militaryRows = buildCountryMilitaryRows({ countries: SIPRI_COUNTRIES.map((c) => ({ slug: c.slug, label: c.name })), spendPctGdpByCountry, spendUsdByCountry });
    const militaryBuildup = computeMilitaryBuildup(militaryRows);

    const sdnCountsByProgram: Record<string, Point[]> = {};
    OFAC_PROGRAMS.forEach((p, i) => (sdnCountsByProgram[p] = sdnSeriesList[i]));
    const sanctionsIntensity = computeSanctionsIntensity(sdnCountsByProgram);

    const escalation = computeEscalation({ avgGoldstein: goldsteinSeries, conflictShare: conflictShareSeries, gprThreats: gprThreatsSeries });

    const transitsBySlug: Record<string, Point[]> = {};
    CHOKEPOINTS.forEach((c, i) => (transitsBySlug[c.slug] = chokepointSeriesList[i]));
    const chokepointRows = buildChokepointRows({ chokepoints: CHOKEPOINTS, transitsBySlug });
    const chokepointStress = computeChokepointStress(chokepointRows);

    const gewi = computeGewi([militaryBuildup, sanctionsIntensity, escalation, chokepointStress]);

    // CHOKEPOINT_SLUGS is imported only to keep a compile-time link to imfPortwatch.ts's slug
    // registry (so a future rename there is caught here) — not otherwise used.
    void CHOKEPOINT_SLUGS;

    return {
      fetchedAt: new Date().toISOString(),
      indices: { gewi, militaryBuildup, sanctionsIntensity, escalation, chokepointStress },
      militaryRows,
      chokepointRows,
      historicalEvents: HISTORICAL_GEO_EVENTS,
    };
  } catch (e) {
    console.error(`getGeopoliticalPageData: ${(e as Error).message}`);
    return null;
  }
}
