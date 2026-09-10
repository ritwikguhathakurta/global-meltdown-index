import type { MetricPoint } from "../metrics/store";

/**
 * Credit-to-GDP Gap, from the BIS (Bank for International Settlements)
 * Total Credit statistics — free, no-auth, no-key SDMX REST API at
 * stats.bis.org. Dataflow WS_CREDIT_GAP, key
 * `Q.<COUNTRY>.P.A.C` = Quarterly, Private non-financial sector borrowers,
 * All-sector lenders, credit-to-GDP Gap (actual minus long-run HP-filter
 * trend) — the exact BIS/Basel III countercyclical-capital-buffer signal,
 * i.e. the standard central-bank early-warning indicator for a credit boom
 * (a large positive gap means credit has grown well beyond its long-run
 * trend relative to GDP, the standard leading signal for a future credit
 * bust/correction — not a market-priced spread, a structural quantity-side
 * signal, disclosed as such wherever it's used).
 *
 * Originally added for China (as a practical, free, officially-published
 * stand-in for "China credit impulse" — a literal Biggs-Mayer-Pick credit
 * impulse would require deriving a growth-of-growth-rate metric ourselves
 * from raw PBOC flow data, more fabrication-adjacent than consuming BIS's
 * own official, already-computed series). Verified this same dataflow
 * covers the full G7 too (checked directly against the live API, not
 * assumed from documentation) — extended to UK, Canada and Japan to fill a
 * real gap on the Credit tab: no free corporate bond OAS/spread index
 * exists for GBP, CAD or JPY (checked FRED's full ICE BofA Indices release
 * and the Bank of England's own database directly), but this BIS series
 * does exist for all three, is correctly risk-signed (unlike a raw loan- or
 * credit-growth figure, which is directionally ambiguous — growth can mean
 * either "conditions easing" or "bubble building" without detrending), and
 * uses the exact same mechanism/methodology already proven here for China.
 * Two alternatives suggested for these three (a Bank of England "domestic
 * credit growth" IADB series, and Statistics Canada's National Balance
 * Sheet Accounts table 38-10-0238-01) were checked and not used: no single
 * clean BoE IADB series code for aggregate domestic credit growth was
 * found, and StatCan's suggested table turned out (verified directly via
 * its own metadata) to cover *household* credit only, not the combined
 * household+corporate credit market debt it was described as — and even a
 * correct table would still be a raw, undetrended level rather than the
 * properly-detrended gap this BIS series already provides.
 */
const COUNTRY_METRIC_KEYS: Record<string, string> = {
  CN: "china.credit_impulse",
  GB: "credit.uk_credit_gap",
  CA: "credit.canada_credit_gap",
  JP: "credit.japan_credit_gap",
  // Added for the Property Systemic Risk engine (propertySystemicRisk.ts) —
  // verified live directly against this same dataflow before adding (US/DE/
  // FR/IT/IN all return real, fresh-through-2025-Q4 data), completing full
  // nine-country coverage of BANKING_COUNTRIES for a genuine credit-leverage
  // domain rather than the three-country subset Banking's Credit domain has.
  US: "credit.us_credit_gap",
  DE: "credit.germany_credit_gap",
  FR: "credit.france_credit_gap",
  IT: "credit.italy_credit_gap",
  IN: "credit.india_credit_gap",
};

async function fetchCreditGap(countryCode: string): Promise<MetricPoint[]> {
  const metricKey = COUNTRY_METRIC_KEYS[countryCode];
  const url = `https://stats.bis.org/api/v1/data/BIS,WS_CREDIT_GAP,1.0/Q.${countryCode}.P.A.C?format=csv&startPeriod=2000`;
  const res = await fetch(url, { headers: { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`BIS credit-to-GDP gap (${countryCode}): HTTP ${res.status}`);
  const csv = await res.text();

  const lines = csv.trim().split("\n");
  const header = lines[0].split(",");
  const periodIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  if (periodIdx === -1 || valueIdx === -1) throw new Error(`BIS credit-to-GDP gap (${countryCode}): unexpected CSV header`);

  const points: MetricPoint[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const period = cols[periodIdx];
    const m = period?.match(/^(\d{4})-Q([1-4])$/);
    if (!m) continue;
    const v = parseFloat(cols[valueIdx]);
    if (Number.isNaN(v)) continue;
    const quarterEndMonth = [null, "03-31", "06-30", "09-30", "12-31"][Number(m[2])];
    points.push({
      metric_key: metricKey,
      observed_at: `${m[1]}-${quarterEndMonth}`,
      value: v,
      unit: "pp of GDP (gap)",
      source_key: "bis",
      source_tier: 1,
      frequency: "quarterly",
    });
  }
  if (points.length === 0) throw new Error(`BIS credit-to-GDP gap (${countryCode}): no data parsed from response`);
  return points;
}

export async function fetchChinaCreditGap(): Promise<MetricPoint[]> {
  return fetchCreditGap("CN");
}

export async function fetchUkCreditGap(): Promise<MetricPoint[]> {
  return fetchCreditGap("GB");
}

export async function fetchCanadaCreditGap(): Promise<MetricPoint[]> {
  return fetchCreditGap("CA");
}

export async function fetchJapanCreditGap(): Promise<MetricPoint[]> {
  return fetchCreditGap("JP");
}

export async function fetchUsCreditGap(): Promise<MetricPoint[]> {
  return fetchCreditGap("US");
}

export async function fetchGermanyCreditGap(): Promise<MetricPoint[]> {
  return fetchCreditGap("DE");
}

export async function fetchFranceCreditGap(): Promise<MetricPoint[]> {
  return fetchCreditGap("FR");
}

export async function fetchItalyCreditGap(): Promise<MetricPoint[]> {
  return fetchCreditGap("IT");
}

export async function fetchIndiaCreditGap(): Promise<MetricPoint[]> {
  return fetchCreditGap("IN");
}
