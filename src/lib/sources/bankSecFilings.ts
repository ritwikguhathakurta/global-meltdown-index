import type { MetricPoint } from "../metrics/store";
import { fetchCompanyFacts, extractDiscreteQuarterly, extractInstant } from "./secEdgar";

/**
 * Bank-level layer for the Banking Systemic Risk engine (bankingSystemicRisk.ts
 * / bankLevel.ts) — added after the FFIEC CDR bulk-download route (the spec's
 * own recommended source for CET1/LCR/NSFR) was checked live and found to be
 * blocked: the actual file-serving endpoint
 * (ffiec.gov/npw/FinancialReport/ReturnBHCFZipFiles) returns Cloudflare's
 * bot-challenge response to a plain server-side request (verified directly —
 * response header `Cf-Mitigated: challenge`), and Chicago Fed's own mirror of
 * the same bulk files stops at 2021-Q1 (verified: bhcf2103.csv = 200,
 * bhcf2203.csv onward = 404) — five years stale, not a current feed. FFIEC's
 * SOAP webservice (which does expose real CET1/leverage/RWA data from FR
 * Y-9C) was also checked directly with a registered CDR account's
 * WS-Security credentials: authentication genuinely succeeds, but every
 * operation (TestUserAccess, RetrieveReportingPeriods,
 * RetrievePanelOfReporters) returns the identical
 * `Server.MethodUnavailable: This service is no longer available` fault —
 * FFIEC has retired the entire legacy webservice, with no documented v2/REST
 * replacement found. A confirmed dead end, not a gap pending credentials.
 *
 * This module instead reuses the SEC EDGAR XBRL company-facts machinery
 * already proven out for the AI engines (see secEdgar.ts) to pull real,
 * current, per-bank balance-sheet data for individually-listed US bank
 * holding companies — all eight US G-SIBs plus four large super-regionals,
 * the closest free substitute for a "bank_master" universe. What this gives:
 * Total Assets, Total Stockholders' Equity, Total Deposits, Total Loans and
 * Net Income, all standard `us-gaap` XBRL concepts reliably tagged the same
 * way across every bank checked (verified live against JPMorgan, Goldman
 * Sachs and Truist before committing to the tag list below — Goldman and
 * Morgan Stanley are more trading- than deposit-funded but still tag
 * `Deposits`, so the concept generalizes even to them).
 *
 * What this does NOT give, and is disclosed as unavailable rather than
 * estimated: the literal Basel III CET1 ratio, LCR, NSFR, or risk-weighted
 * assets. Those are regulatory (not GAAP) concepts and are not standardized
 * XBRL tags — each bank that discloses them at all uses its own custom
 * extension-taxonomy element names in its Pillar 3/10-K capital tables, not
 * a common tag comparable across banks the way `Assets` is. bankLevel.ts
 * instead computes a genuine, comparable LEVERAGE ratio (Equity/Assets) from
 * these two clean GAAP concepts as the free proxy — the same "computed
 * leverage ratio, not risk-weighted CET1" caveat already disclosed for the
 * country-level Capital domain's World Bank data (see
 * bankFinancialSoundness.ts).
 */

export type BankCompanyDef = { key: string; cik: string; name: string; gsib: boolean };

/** All eight US G-SIBs (per the Fed's own G-SIB surcharge list) plus four
 * large non-G-SIB super-regionals — CIKs verified against SEC's own
 * company_tickers.json mapping, not typed from memory. */
export const BANK_COMPANIES: BankCompanyDef[] = [
  { key: "jpm", cik: "0000019617", name: "JPMorgan Chase & Co.", gsib: true },
  { key: "bac", cik: "0000070858", name: "Bank of America Corp.", gsib: true },
  { key: "c", cik: "0000831001", name: "Citigroup Inc.", gsib: true },
  { key: "wfc", cik: "0000072971", name: "Wells Fargo & Company", gsib: true },
  { key: "gs", cik: "0000886982", name: "Goldman Sachs Group Inc.", gsib: true },
  { key: "ms", cik: "0000895421", name: "Morgan Stanley", gsib: true },
  { key: "bny", cik: "0001390777", name: "Bank of New York Mellon Corp.", gsib: true },
  { key: "stt", cik: "0000093751", name: "State Street Corp.", gsib: true },
  { key: "usb", cik: "0000036104", name: "US Bancorp", gsib: false },
  { key: "pnc", cik: "0000713676", name: "PNC Financial Services Group, Inc.", gsib: false },
  { key: "tfc", cik: "0000092230", name: "Truist Financial Corp.", gsib: false },
  { key: "cof", cik: "0000927628", name: "Capital One Financial Corp.", gsib: false },
];

const INSTANT_CONCEPTS: { metricKey: string; tags: string[] }[] = [
  { metricKey: "total_assets", tags: ["Assets"] },
  { metricKey: "total_equity", tags: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"] },
  { metricKey: "total_deposits", tags: ["Deposits"] },
  // Recency-based tag selection (see secEdgar.ts) handles the CECL-era
  // (ASU 2016-13, ~2020+) transition between these — verified all three
  // exist for at least one sampled bank each.
  { metricKey: "total_loans", tags: ["LoansAndLeasesReceivableNetReportedAmount", "FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss", "LoansAndLeasesReceivableNetOfDeferredIncome"] },
];

const DURATION_CONCEPTS: { metricKey: string; tags: string[]; allowNegative: boolean }[] = [
  { metricKey: "net_income", tags: ["NetIncomeLoss"], allowNegative: true },
];

export async function fetchBankCompanyMetrics(company: BankCompanyDef): Promise<MetricPoint[]> {
  const facts = await fetchCompanyFacts(company.cik);
  const points: MetricPoint[] = [];

  for (const def of INSTANT_CONCEPTS) {
    const series = extractInstant(facts, def.tags);
    for (const p of series) {
      points.push({
        metric_key: `bank.${company.key}.${def.metricKey}`,
        observed_at: p.end,
        value: p.val,
        unit: "USD",
        source_key: "sec_edgar",
        source_tier: 1,
        frequency: "quarterly",
        raw: { cik: company.cik },
      });
    }
  }

  for (const def of DURATION_CONCEPTS) {
    const series = extractDiscreteQuarterly(facts, def.tags, def.allowNegative, "USD");
    for (const p of series) {
      points.push({
        metric_key: `bank.${company.key}.${def.metricKey}`,
        observed_at: p.end,
        value: p.val,
        unit: "USD",
        source_key: "sec_edgar",
        source_tier: 1,
        frequency: "quarterly",
        raw: { cik: company.cik },
      });
    }
  }

  return points;
}

export async function fetchAllBankSecFilings(): Promise<MetricPoint[]> {
  const results: MetricPoint[] = [];
  for (const company of BANK_COMPANIES) {
    try {
      results.push(...(await fetchBankCompanyMetrics(company)));
    } catch (e) {
      console.error(`SEC EDGAR bank filings (${company.key}): ${(e as Error).message}`);
    }
    // SEC's fair-use policy asks for a modest request rate — same courtesy
    // gap already used between sequential external-API calls elsewhere in
    // this project (g7Fiscal.ts, bankFinancialSoundness.ts).
    await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}
