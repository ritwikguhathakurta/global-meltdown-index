import type { MetricPoint } from "../metrics/store";
import { EM_DEBT_COUNTRIES } from "./worldBankEmDebt";

/**
 * Corporate FX debt, from BIS's International Debt Securities statistics
 * (WS_DEBT_SEC2_PUB — free, no-key SDMX REST API at stats.bis.org, same
 * mechanism already used for the Credit tab's credit-to-GDP gaps in
 * bisCreditGap.ts). Verified live for all 14 tracked economies: amounts
 * outstanding of foreign-currency-denominated international debt securities
 * issued by each country's non-financial corporations (e.g. India $27.0bn,
 * Mexico $132.0bn, China $61.0bn as of 2026-Q1 — all plausible against known
 * market sizes).
 *
 * This is the "Corporate FX Debt Engine" component the EM Debt spec asked
 * for and this engine previously declined to build (see emDebtRegime.ts) —
 * World Bank QEDS and national statistics don't expose a clean, comparable
 * corporate-sector FX-debt figure across all 14 countries, but BIS's own
 * compiled international-debt-securities dataset does, at quarterly
 * frequency. The dimension key was discovered empirically against the live
 * API (BIS's own documentation describes the dimensions but not which
 * specific codes are actually populated for a given country) — verify any
 * future change against the API directly rather than trusting this comment.
 *
 * Key: FREQ.ISSUER_RES.ISSUER_NAT.ISSUER_BUS_IMM.ISSUER_BUS_ULT.MARKET.
 * ISSUE_TYPE.ISSUE_CUR_GROUP.ISSUE_CUR.ISSUE_OR_MAT.ISSUE_RE_MAT.ISSUE_RATE.
 * ISSUE_RISK.ISSUE_COL.MEASURE
 *   = Q.<ISO2>.3P.J.1.C.A.F.TO1.A.A.A.A.A.I
 * (quarterly; issuer resident in <ISO2>; nationality "3P" = all countries
 * excluding residents; ISSUER_BUS_IMM "J" = non-financial corporations;
 * MARKET "C" = international markets; ISSUE_CUR_GROUP "F" = foreign
 * currencies; ISSUE_CUR "TO1" = total across all foreign currencies; the
 * remaining maturity/rate/risk/collateral dimensions "A" = all/total;
 * MEASURE "I" = amounts outstanding.)
 *
 * This captures foreign-currency bonds issued in international markets —
 * the classic "original sin" FX-mismatch exposure — not FX-denominated bank
 * loans or domestically-issued FX debt, which BIS does not compile at this
 * granularity for free. Disclosed as a partial (bond-market-only) proxy for
 * total corporate FX debt, not the full picture.
 */

const ISO2_BY_ISO3: Record<string, string> = {
  BRA: "BR",
  MEX: "MX",
  ZAF: "ZA",
  TUR: "TR",
  IND: "IN",
  IDN: "ID",
  CHN: "CN",
  PHL: "PH",
  POL: "PL",
  HUN: "HU",
  CZE: "CZ",
  THA: "TH",
  MYS: "MY",
  KOR: "KR",
};

const QUARTER_END_MONTH: Record<string, string> = { "1": "03-31", "2": "06-30", "3": "09-30", "4": "12-31" };

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

async function fetchCorporateFxDebtForCountry(iso3: string, countryKey: string): Promise<MetricPoint[]> {
  const iso2 = ISO2_BY_ISO3[iso3];
  const key = `Q.${iso2}.3P.J.1.C.A.F.TO1.A.A.A.A.A.I`;
  const url = `https://stats.bis.org/api/v1/data/BIS,WS_DEBT_SEC2_PUB,1.0/${key}?format=csv&startPeriod=2015`;
  const res = await fetchWithRetry(url);
  const csv = await res.text();

  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const periodIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  const unitMultIdx = header.indexOf("UNIT_MULT");
  if (periodIdx === -1 || valueIdx === -1) throw new Error(`BIS corporate FX debt (${countryKey}): unexpected CSV header`);

  const points: MetricPoint[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const period = cols[periodIdx];
    const m = period?.match(/^(\d{4})-Q([1-4])$/);
    if (!m) continue;
    const raw = parseFloat(cols[valueIdx]);
    if (Number.isNaN(raw)) continue;
    const unitMult = unitMultIdx !== -1 ? parseInt(cols[unitMultIdx], 10) || 0 : 6;
    const value = raw * Math.pow(10, unitMult);
    points.push({
      metric_key: `emdebt.${countryKey}.corporate_fx_debt_usd`,
      observed_at: `${m[1]}-${QUARTER_END_MONTH[m[2]]}`,
      value,
      unit: "USD",
      source_key: "bis",
      source_tier: 1,
      frequency: "quarterly",
      raw: { seriesKey: key },
    });
  }
  return points;
}

export async function fetchBisCorporateFxDebt(): Promise<MetricPoint[]> {
  const results: MetricPoint[] = [];
  for (const c of EM_DEBT_COUNTRIES) {
    try {
      const points = await fetchCorporateFxDebtForCountry(c.iso3, c.key);
      results.push(...points);
    } catch (e) {
      console.error(`BIS corporate FX debt (${c.key}): ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}
