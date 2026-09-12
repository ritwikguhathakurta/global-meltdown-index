import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLatestForKeys } from "../metrics/store";
import { EIA_COUNTRIES } from "../sources/eiaApi";

/**
 * Country Energy Balance — spec §6 ("For every country calculate: Production
 * + Imports - Exports + Inventory Change = Domestic Energy Availability...
 * Energy Import Dependency... Energy Self-Sufficiency"). Real EIA API v2
 * country-level petroleum production/consumption (eiaApi.ts), not a
 * composite score — a plain per-country balance table, matching the spec's
 * own framing rather than folding into energySystemicRisk.ts's global GESRI
 * composite (same "new layer, don't double count" discipline as elsewhere).
 *
 * Petroleum only (oil production/consumption in kbpd) — EIA's free
 * international dataset does not carry country-level natural gas or coal
 * balances at the same granularity; disclosed, not fabricated.
 */

export type CountryEnergyBalanceRow = {
  countryLabel: string;
  slug: string;
  production: number | null;
  consumption: number | null;
  asOf: string | null;
  netImports: number | null; // consumption - production; negative = net exporter
  importDependencyPct: number | null; // netImports / consumption * 100
  selfSufficiencyPct: number | null; // production / consumption * 100
};

const COUNTRY_LABELS: Record<string, string> = {
  us: "United States",
  saudi_arabia: "Saudi Arabia",
  russia: "Russia",
  canada: "Canada",
  iraq: "Iraq",
  uae: "UAE",
  iran: "Iran",
  kuwait: "Kuwait",
  qatar: "Qatar",
  norway: "Norway",
  brazil: "Brazil",
  australia: "Australia",
  china: "China",
  india: "India",
  japan: "Japan",
  south_korea: "South Korea",
};

export async function getCountryEnergyBalanceTable(db: SupabaseClient): Promise<CountryEnergyBalanceRow[]> {
  const keys = EIA_COUNTRIES.flatMap((c) => [`energy.country.${c.slug}.oil_production`, `energy.country.${c.slug}.oil_consumption`]);
  const latest = await fetchLatestForKeys(db, keys);

  return EIA_COUNTRIES.map((c) => {
    const prod = latest.get(`energy.country.${c.slug}.oil_production`);
    const cons = latest.get(`energy.country.${c.slug}.oil_consumption`);
    const production = prod?.v ?? null;
    const consumption = cons?.v ?? null;
    const netImports = production !== null && consumption !== null ? Math.round((consumption - production) * 10) / 10 : null;
    const importDependencyPct = netImports !== null && consumption !== null && consumption !== 0 ? Math.round((netImports / consumption) * 1000) / 10 : null;
    const selfSufficiencyPct = production !== null && consumption !== null && consumption !== 0 ? Math.round((production / consumption) * 1000) / 10 : null;
    const asOf = prod?.t ?? cons?.t ?? null;
    return {
      countryLabel: COUNTRY_LABELS[c.slug] ?? c.slug,
      slug: c.slug,
      production,
      consumption,
      asOf,
      netImports,
      importDependencyPct,
      selfSufficiencyPct,
    };
  }).sort((a, b) => (b.importDependencyPct ?? -Infinity) - (a.importDependencyPct ?? -Infinity));
}
