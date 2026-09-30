import type { MetricPoint } from "../metrics/store";

/**
 * A fresher, IMF-WEO-sourced general-government-gross-debt/GDP reading for
 * the six non-US G7 economies whose primary `sovereign.*_debt_to_gdp` series
 * (fred.ts, OECD-basis annual data) genuinely lags 1-2+ years — the exact
 * gap README.md's Treasury & Sovereign section names, which previously
 * concluded "IMF's own WEO database, the only plausible fresher source, is
 * Akamai-blocked." Re-checked live 2026-09-30: that conclusion was stale.
 * IMF's WEO SDMX API (api.imf.org, free, no key — the same endpoint already
 * used by imfFiscalGaps.ts and g7Fiscal.ts for other WEO indicators) serves
 * GGXWDG_NGDP (general government gross debt, % of GDP) for all six with no
 * block at all.
 *
 * This is deliberately NOT written into the existing `sovereign.*_debt_to_gdp`
 * metric keys. FRED's OECD-basis figure and IMF's own WEO figure use
 * different debt-coverage conventions and disagree by 1-2+ points of GDP on
 * the same overlapping year (verified live: Germany 2024 — FRED 63.9% vs IMF
 * 62.2%; China 2024 — FRED 88.3% vs IMF 90.4%). Appending IMF's newer years
 * onto the same series would read as a real 1-2pp jump that never happened —
 * the same "don't splice a differently-sourced tick into a series whose
 * statistics depend on internal consistency" rule CLAUDE.md documents for
 * live commodity quotes (see liveCommodityQuotes.ts). Instead this writes a
 * separate `sovereign.<country>_debt_to_gdp_imf_weo` series, all years IMF
 * publishes back to 2015 (the "fetch it once, keep everything" backfill
 * discipline already used for SIPRI/World Bank military spend), so the
 * fresher current-year reading is genuinely available for display but never
 * silently blended into the FRED-based series the registered Treasury &
 * Sovereign engine's z-score math already relies on.
 *
 * WEO mixes historical actuals with multi-year-ahead forecasts in the same
 * series with no reliable per-observation status flag (same caveat
 * documented in imfFiscalGaps.ts/g7Fiscal.ts) — capped here to observations
 * at least one full calendar year old, the same discipline already applied
 * to every other WEO-sourced series in this project, so a Fund staff
 * projection is never ingested as if it were a closed account.
 */

const WEO_BASE = "https://api.imf.org/external/sdmx/2.1/data/IMF.RES,WEO,9.0.0";

const COUNTRIES = [
  { iso3: "DEU", key: "germany" },
  { iso3: "ITA", key: "italy" },
  { iso3: "JPN", key: "japan" },
  { iso3: "GBR", key: "uk" },
  { iso3: "CHN", key: "china" },
  { iso3: "CAN", key: "canada" },
];

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" },
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(25_000),
      });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function parseObsList(xml: string): { year: string; value: number }[] {
  const obsMatches = xml.match(/<Obs[^>]*\/>/g) ?? [];
  const out: { year: string; value: number }[] = [];
  for (const obs of obsMatches) {
    const year = obs.match(/TIME_PERIOD="(\d{4})"/)?.[1];
    const valueStr = obs.match(/OBS_VALUE="(-?[0-9.]+)"/)?.[1];
    if (!year || !valueStr) continue;
    const value = Number(valueStr);
    if (Number.isNaN(value)) continue;
    out.push({ year, value });
  }
  return out;
}

export async function fetchImfWeoDebtFreshness(): Promise<MetricPoint[]> {
  const cutoffYear = new Date().getUTCFullYear() - 1;
  const results: MetricPoint[] = [];
  for (const c of COUNTRIES) {
    try {
      const url = `${WEO_BASE}/${c.iso3}.GGXWDG_NGDP.A?startPeriod=2015`;
      const res = await fetchWithRetry(url);
      const obs = parseObsList(await res.text());
      for (const o of obs) {
        if (Number(o.year) > cutoffYear) continue;
        results.push({
          metric_key: `sovereign.${c.key}_debt_to_gdp_imf_weo`,
          observed_at: `${o.year}-01-01`,
          value: o.value,
          unit: "% of GDP",
          source_key: "imf_weo",
          source_tier: 1,
          frequency: "annual",
        });
      }
    } catch (e) {
      console.error(`IMF WEO debt/GDP freshness (${c.key}): ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}
