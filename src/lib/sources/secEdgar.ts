import type { MetricPoint } from "../metrics/store";

/**
 * SEC EDGAR XBRL company-facts API — free, official, no key (just a
 * descriptive User-Agent per SEC's fair-use policy), Tier 1. Backs the AI
 * Financial Sustainability / Valuation / Credit-Financing / Debt-Maturity-Wall
 * engines (V3 §16-19, §21-ish). This is the highest-risk-of-silent-error
 * connector in the codebase: companies use inconsistent XBRL tags for the
 * same concept, and change tags over time (e.g. Microsoft stopped tagging
 * `CostOfRevenue` in 2018; Alphabet's `RevenueFromContractWithCustomer...`
 * tag went stale in 2025 while it kept using the plain `Revenues` tag).
 * Two defenses against that, verified against live data before shipping:
 *
 * 1. Tag fallback lists are picked by RECENCY across all candidates, not by
 *    "first tag that has any data" — a tag a company abandoned years ago
 *    must never silently win over one it's still using.
 * 2. Cash-flow-statement items (operating cash flow, capex, D&A) are
 *    reported as YEAR-TO-DATE cumulative figures in most companies' 10-Qs,
 *    not discrete quarters (income-statement items usually ARE discrete).
 *    De-cumulation groups facts by shared period `start` date (a YTD chain:
 *    Q1, H1, 9-month, FY all share the fiscal year's start) and takes
 *    successive differences — this also recovers the Q4 figure, which is
 *    never separately filed, as (FY total - 9-month YTD). It's a no-op for
 *    companies that already report discretely (each quarter is its own
 *    start-date group of size one).
 */

export type SecCompanyDef = { ticker: string; cik: string; name: string };

export const AI_COMPANIES: SecCompanyDef[] = [
  { ticker: "msft", cik: "0000789019", name: "Microsoft" },
  { ticker: "googl", cik: "0001652044", name: "Alphabet" },
  { ticker: "amzn", cik: "0001018724", name: "Amazon" },
  { ticker: "meta", cik: "0001326801", name: "Meta Platforms" },
  { ticker: "orcl", cik: "0001341439", name: "Oracle" },
  { ticker: "nvda", cik: "0001045810", name: "Nvidia" },
  { ticker: "amd", cik: "0000002488", name: "AMD" },
  { ticker: "avgo", cik: "0001730168", name: "Broadcom" },
];

export type XbrlFact = { start?: string; end: string; val: number; form: string; filed: string; fy?: number; fp?: string };
export type CompanyFacts = { facts?: { "us-gaap"?: Record<string, { units?: Record<string, XbrlFact[]> }> } };

// Income-statement-style items: usually already discrete per quarter, but run through the
// same de-cumulation path anyway since it's a no-op when facts are already discrete.
// `unit` matters: everything is tagged under the "USD" unit EXCEPT per-share figures, which
// XBRL tags under "USD/shares" — using the wrong unit key silently returns zero facts.
const DURATION_CONCEPTS: { metricKey: string; tags: string[]; allowNegative: boolean; unit: "USD" | "USD/shares" }[] = [
  { metricKey: "revenue", tags: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"], allowNegative: false, unit: "USD" },
  { metricKey: "operating_income", tags: ["OperatingIncomeLoss"], allowNegative: true, unit: "USD" },
  { metricKey: "op_cash_flow", tags: ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"], allowNegative: true, unit: "USD" },
  { metricKey: "capex", tags: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets", "PaymentsForCapitalImprovements"], allowNegative: false, unit: "USD" },
  { metricKey: "depreciation", tags: ["DepreciationDepletionAndAmortization", "DepreciationAmortizationAndAccretionNet", "DepreciationAndAmortization", "Depreciation"], allowNegative: false, unit: "USD" },
  // Another tag-drift case (see file header): Microsoft, Alphabet, Amazon and Nvidia all
  // switched from InterestExpense to InterestExpenseNonoperating starting FY2025 — without this
  // tag, recency-based selection was correctly picking InterestExpense, but that tag simply
  // stopped being filed, so the "most recent" data under it was stuck at mid-2024.
  { metricKey: "interest_expense", tags: ["InterestExpense", "InterestExpenseDebt", "InterestExpenseNonoperating"], allowNegative: false, unit: "USD" },
  { metricKey: "eps_diluted", tags: ["EarningsPerShareDiluted"], allowNegative: true, unit: "USD/shares" },
];

const INSTANT_CONCEPTS: { metricKey: string; tags: string[]; unit: "USD" }[] = [
  { metricKey: "cash", tags: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"], unit: "USD" },
  { metricKey: "debt_noncurrent", tags: ["LongTermDebtNoncurrent"], unit: "USD" },
  { metricKey: "debt_current", tags: ["LongTermDebtCurrent", "DebtCurrent"], unit: "USD" },
  { metricKey: "debt_maturity_y1", tags: ["LongTermDebtMaturitiesRepaymentsOfPrincipalInNextTwelveMonths", "DebtInstrumentMaturitiesRepaymentsOfPrincipalInNextTwelveMonths"], unit: "USD" },
  { metricKey: "debt_maturity_y2", tags: ["LongTermDebtMaturitiesRepaymentsOfPrincipalInYearTwo"], unit: "USD" },
  { metricKey: "debt_maturity_y3", tags: ["LongTermDebtMaturitiesRepaymentsOfPrincipalInYearThree"], unit: "USD" },
];

export async function fetchCompanyFacts(cik: string): Promise<CompanyFacts> {
  const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
    headers: { "User-Agent": "GlobalMeltdownIndex research contact@globalmeltdownindex.net" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`SEC EDGAR companyfacts CIK${cik}: HTTP ${res.status}`);
  return (await res.json()) as CompanyFacts;
}

export function extractDiscreteQuarterly(facts: CompanyFacts, tags: string[], allowNegative: boolean, unit: "USD" | "USD/shares"): { end: string; val: number }[] {
  const byKey = new Map<string, XbrlFact>();
  for (const tag of tags) {
    const usd = facts.facts?.["us-gaap"]?.[tag]?.units?.[unit];
    if (!usd) continue;
    for (const f of usd) {
      if (f.form !== "10-Q" && f.form !== "10-K") continue;
      if (!f.start || !f.end) continue;
      const key = `${f.start}|${f.end}`;
      const existing = byKey.get(key);
      if (!existing || f.filed > existing.filed) byKey.set(key, f);
    }
  }
  const byStart = new Map<string, XbrlFact[]>();
  for (const f of byKey.values()) {
    const arr = byStart.get(f.start!) ?? [];
    arr.push(f);
    byStart.set(f.start!, arr);
  }
  const discreteByEnd = new Map<string, number>();
  for (const group of byStart.values()) {
    group.sort((a, b) => (a.end < b.end ? -1 : 1));
    let prevVal = 0;
    for (const f of group) {
      discreteByEnd.set(f.end, f.val - prevVal);
      prevVal = f.val;
    }
  }
  return [...discreteByEnd.entries()]
    .map(([end, val]) => ({ end, val }))
    .filter((p) => allowNegative || p.val >= 0)
    .sort((a, b) => (a.end < b.end ? -1 : 1));
}

export function extractInstant(facts: CompanyFacts, tags: string[]): { end: string; val: number }[] {
  const byEnd = new Map<string, XbrlFact>();
  for (const tag of tags) {
    const usd = facts.facts?.["us-gaap"]?.[tag]?.units?.USD;
    if (!usd) continue;
    for (const f of usd) {
      if (f.form !== "10-Q" && f.form !== "10-K") continue;
      const existing = byEnd.get(f.end);
      if (!existing || f.filed > existing.filed) byEnd.set(f.end, f);
    }
  }
  return [...byEnd.entries()].map(([end, f]) => ({ end, val: f.val })).sort((a, b) => (a.end < b.end ? -1 : 1));
}

export async function fetchSecEdgarCompanyMetrics(company: SecCompanyDef): Promise<MetricPoint[]> {
  const facts = await fetchCompanyFacts(company.cik);
  const points: MetricPoint[] = [];

  for (const def of DURATION_CONCEPTS) {
    const series = extractDiscreteQuarterly(facts, def.tags, def.allowNegative, def.unit);
    const displayUnit = def.unit === "USD/shares" ? "USD/share" : "USD";
    for (const p of series) {
      points.push({
        metric_key: `ai.${company.ticker}.${def.metricKey}`,
        observed_at: p.end,
        value: p.val,
        unit: displayUnit,
        source_key: "sec_edgar",
        source_tier: 1,
        frequency: "quarterly",
        raw: { cik: company.cik },
      });
    }
  }

  for (const def of INSTANT_CONCEPTS) {
    const series = extractInstant(facts, def.tags);
    for (const p of series) {
      points.push({
        metric_key: `ai.${company.ticker}.${def.metricKey}`,
        observed_at: p.end,
        value: p.val,
        unit: def.unit,
        source_key: "sec_edgar",
        source_tier: 1,
        frequency: "quarterly",
        raw: { cik: company.cik },
      });
    }
  }

  return points;
}
