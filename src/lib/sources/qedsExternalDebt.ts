import type { MetricPoint } from "../metrics/store";

/**
 * Patches the external_debt_to_gni structural indicator for the two
 * countries where World Bank WDI's own ratio indicator (DT.DOD.DECT.GN.ZS)
 * has no data at all: Czech Republic and Hungary. Both are upper-income
 * economies outside the scope of WDI's International Debt Statistics
 * module (which is restricted to IDA/IBRD Debtor Reporting System
 * economies), but both DO report to the Quarterly External Debt Statistics
 * SDDS (QEDS) — a separate, broader-coverage World Bank product accessible
 * via the same api.worldbank.org API under source=22, giving raw gross
 * external debt position (all sectors, all instruments) in USD.
 *
 * Verified live: Czech Republic $273.6bn, Hungary $313.6bn (both 2026 Q1) —
 * current, sensible figures. The ratio itself (this stock divided by World
 * Bank's own GNI-in-USD level, fetched separately in worldBankEmDebt.ts) is
 * computed at read time in emDebtRegime.ts, exactly like the BIS
 * corporate-FX-debt/GDP indicator.
 *
 * Checked and explicitly NOT used: QEDS's short-term
 * (remaining-maturity-under-1-year) external debt series for these same
 * two countries returns mostly stale (2016) or literal-zero values —
 * a real data-quality problem, not a coverage gap, so short_term_debt_to_
 * reserves stays genuinely unavailable for these countries rather than
 * risk a bad signal. QEDS's "debt service" series are forward-looking,
 * maturity-bucketed scheduled payments (a refinancing-wall view), not a
 * trailing-12-month actual comparable to WDI's external_debt_service_to_
 * exports ratio — a real methodological mismatch, so that indicator also
 * stays unavailable for these two countries rather than being faked with
 * a different concept under the same label. Poland, Malaysia and South
 * Korea were checked too: Poland and Korea have no QEDS SDDS data at all
 * for this series (checked directly, all pages), and Malaysia's most
 * recent QEDS observation is from 2016 — too stale to use as current.
 */

const GAP_COUNTRIES = [
  { iso3: "CZE", key: "czech_republic" },
  { iso3: "HUN", key: "hungary" },
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

type WbObservation = { date: string; value: number | null };

async function fetchExternalDebtStock(iso3: string, countryKey: string): Promise<MetricPoint[]> {
  const url = `https://api.worldbank.org/v2/country/${iso3}/indicator/DT.DOD.DECT.CD.AR.EN.US?source=22&format=json&per_page=100&date=2015:${new Date().getUTCFullYear()}`;
  const res = await fetchWithRetry(url);
  const json = (await res.json()) as [unknown, WbObservation[] | null];
  const rows = (json[1] ?? []).filter((r): r is { date: string; value: number } => r.value !== null);

  const points: MetricPoint[] = [];
  for (const row of rows) {
    const m = row.date.match(/^(\d{4})Q([1-4])$/);
    if (!m) continue;
    const quarterEndMonth = [null, "03-31", "06-30", "09-30", "12-31"][Number(m[2])];
    points.push({
      metric_key: `emdebt.${countryKey}.external_debt_stock_usd`,
      observed_at: `${m[1]}-${quarterEndMonth}`,
      value: row.value,
      unit: "USD",
      source_key: "world_bank_qeds",
      source_tier: 1,
      frequency: "quarterly",
    });
  }
  return points;
}

export async function fetchQedsExternalDebtGapFillers(): Promise<MetricPoint[]> {
  const results: MetricPoint[] = [];
  for (const c of GAP_COUNTRIES) {
    try {
      results.push(...(await fetchExternalDebtStock(c.iso3, c.key)));
    } catch (e) {
      console.error(`QEDS external debt stock (${c.key}): ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}
