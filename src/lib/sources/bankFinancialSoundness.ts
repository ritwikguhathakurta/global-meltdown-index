import type { MetricPoint } from "../metrics/store";

/**
 * Cross-country bank-soundness ratios for the Banking Systemic Risk engine
 * (bankingSystemicRisk.ts), from the World Bank's World Development
 * Indicators (WDI) — the same free, no-key api.worldbank.org product already
 * used for G7 GDP/growth/current-account (see g7Fiscal.ts). WDI's bank
 * ratios are themselves a mirror of IMF Financial Soundness Indicators (FSI)
 * data reported by each country's own regulator, republished with a real
 * lag that varies by country — verified live per-country before use, not
 * assumed uniform:
 *
 * FB.BNK.CAPA.ZS ("Bank capital to assets ratio") — a leverage ratio
 * (equity/total assets), NOT a risk-weighted CET1 ratio (no free source
 * publishes cross-country risk-weighted regulatory capital ratios outside
 * each regulator's own portal — checked, genuinely unavailable). Verified
 * live: fresh 2024-2025 values for US/UK/Germany/France/Italy/Canada/India;
 * Japan and China are both stale (2022 and 2021 respectively, i.e. a 4-5
 * year-old figure) — used anyway (a real historical data point, disclosed
 * with its true asOf date) rather than dropped, since a several-year-old
 * capital ratio is still more informative than none, but never mislabeled
 * as current.
 *
 * FB.AST.NPER.ZS ("Bank nonperforming loans to total gross loans") — fresh
 * (2024-2025) for all nine countries except Japan (2022).
 *
 * A third candidate, FD.RES.LIQU.AS.ZS ("Bank liquid reserves to bank
 * assets ratio"), was checked and rejected as this engine's liquidity input:
 * verified live to have NO data at all (not just stale — zero observations
 * in the 2015-2026 window queried) for six of the nine countries (UK,
 * Germany, France, Italy, Canada, China), leaving only US/Japan/India
 * covered. The Liquidity domain instead reuses each country's own
 * central-bank balance-sheet/reserves series already flowing from
 * globalLiquidity.ts/liquidityRegime.ts (weekly/monthly, far fresher) — see
 * bankingSystemicRisk.ts's LIQUIDITY_KEY map.
 *
 * The GFDD.SI.* series (the old, purpose-built "Global Financial
 * Development Database" bank indicators) were also checked and rejected:
 * World Bank's own metadata shows them last updated 2022-09-23 with no
 * observations after 2020-2021 for any country checked — superseded by the
 * FB.-prefixed WDI codes used here, which report the same underlying IMF
 * FSI concept but are still being refreshed.
 */

const WB_BASE = "https://api.worldbank.org/v2/country";

export type BankingCountry = { iso3: string; key: string; name: string };

/** G7 (reusing the same seven countries/keys as g7Fiscal.ts's G7_COUNTRIES)
 * plus China and India — the spec's own minimum country list (§7) trimmed to
 * the subset where free, verifiable bank-soundness data was actually found
 * live. The other thirteen listed in the spec (Eurozone as a standalone
 * aggregate distinct from its three G7 members, Australia, South Korea,
 * Singapore, Hong Kong, Brazil, Mexico, Indonesia, South Africa, Turkiye,
 * Saudi Arabia, UAE) are not covered — checked, no equally free/current
 * bank-soundness source verified for them this pass, disclosed as deferred
 * rather than estimated. */
export const BANKING_COUNTRIES: BankingCountry[] = [
  { iso3: "USA", key: "us", name: "United States" },
  { iso3: "JPN", key: "japan", name: "Japan" },
  { iso3: "DEU", key: "germany", name: "Germany" },
  { iso3: "FRA", key: "france", name: "France" },
  { iso3: "ITA", key: "italy", name: "Italy" },
  { iso3: "GBR", key: "uk", name: "United Kingdom" },
  { iso3: "CAN", key: "canada", name: "Canada" },
  { iso3: "CHN", key: "china", name: "China" },
  { iso3: "IND", key: "india", name: "India" },
];

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      try {
        const res = await fetch(url, { headers: { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" }, next: { revalidate: 0 }, signal: controller.signal });
        if (res.ok) return res;
        lastError = new Error(`HTTP ${res.status}`);
      } finally {
        clearTimeout(timeout);
      }
    } catch (e) {
      lastError = e;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

type WbObservation = { countryiso3code: string; date: string; value: number | null };

async function fetchBankingWorldBankIndicator(wbCode: string, metricSuffix: string, unit: string): Promise<MetricPoint[]> {
  const iso3List = BANKING_COUNTRIES.map((c) => c.iso3).join(";");
  const iso3ToKey = new Map(BANKING_COUNTRIES.map((c) => [c.iso3, c.key]));
  const currentYear = new Date().getUTCFullYear();
  const url = `${WB_BASE}/${iso3List}/indicator/${wbCode}?format=json&per_page=500&date=2015:${currentYear}`;
  const res = await fetchWithRetry(url);
  const json = (await res.json()) as [unknown, WbObservation[] | null];
  const rows = json[1] ?? [];

  const latestByCountry = new Map<string, WbObservation>();
  for (const row of rows) {
    if (row.value === null) continue;
    const existing = latestByCountry.get(row.countryiso3code);
    if (!existing || row.date > existing.date) latestByCountry.set(row.countryiso3code, row);
  }

  const points: MetricPoint[] = [];
  for (const [iso3, row] of latestByCountry) {
    const countryKey = iso3ToKey.get(iso3);
    if (!countryKey) continue;
    points.push({
      metric_key: `banking.${countryKey}.${metricSuffix}`,
      observed_at: `${row.date}-01-01`,
      value: row.value as number,
      unit,
      source_key: "world_bank",
      source_tier: 1,
      frequency: "annual",
    });
  }
  return points;
}

export async function fetchBankCapitalToAssetsRatio(): Promise<MetricPoint[]> {
  return fetchBankingWorldBankIndicator("FB.BNK.CAPA.ZS", "capital_to_assets_ratio", "%");
}

export async function fetchBankNplRatio(): Promise<MetricPoint[]> {
  return fetchBankingWorldBankIndicator("FB.AST.NPER.ZS", "npl_ratio", "%");
}

export async function fetchBankFinancialSoundnessData(): Promise<MetricPoint[]> {
  const results: MetricPoint[] = [];
  try {
    results.push(...(await fetchBankCapitalToAssetsRatio()));
  } catch (e) {
    console.error(`World Bank bank capital/assets ratio: ${(e as Error).message}`);
  }
  await new Promise((r) => setTimeout(r, 300));
  try {
    results.push(...(await fetchBankNplRatio()));
  } catch (e) {
    console.error(`World Bank bank NPL ratio: ${(e as Error).message}`);
  }
  return results;
}
