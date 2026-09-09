import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { pctChangeOverDays, rollingSum, zToRiskScore, type Point } from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";
import { BANK_COMPANIES, type BankCompanyDef } from "../sources/bankSecFilings";

/**
 * Bank-level layer for the Banking Systemic Risk engine — see
 * bankSecFilings.ts for the full story of why this reads SEC EDGAR XBRL
 * (Total Assets, Equity, Deposits, Loans, Net Income) rather than the
 * FFIEC CDR bulk data the spec itself asks for (verified live and found
 * Cloudflare-blocked at the actual file endpoint; FFIEC's SOAP webservice
 * does have the real CET1/leverage/RWA data but needs registered CDR
 * credentials this deployment doesn't have yet — a disclosed future
 * upgrade path, not a permanent gap).
 *
 * UNIVERSE: the twelve individually-listed US bank holding companies in
 * BANK_COMPANIES (all eight US G-SIBs plus four large super-regionals).
 * Every other jurisdiction's bank-level layer (UK, Eurozone, Japan, Canada,
 * China, India G-SIBs/D-SIBs) is NOT covered — those banks either aren't
 * SEC filers or (where they are, as ADRs) don't consistently tag the same
 * balance-sheet concepts the way US filers do; checked, disclosed as
 * deferred, not attempted this pass.
 *
 * THREE COMPUTED RATIOS (all standard GAAP concepts, cross-sectionally
 * z-scored against the other eleven banks — same "peer group, not a
 * universal threshold" principle as every other engine in this app):
 *  - Leverage Ratio = Total Equity / Total Assets x 100. NOT the Basel III
 *    CET1 ratio (risk-weighted, and CET1 is a subset of total equity) — a
 *    genuine but different capital-adequacy measure, same disclosed
 *    substitution as the country-level Capital domain's World Bank ratio.
 *  - Deposit Growth (YoY %) — a real funding-stability signal (spec's own
 *    "deposit growth/decline" concept, §23), though not disclosed
 *    separately as insured vs. uninsured (no free source breaks deposits
 *    out that way per bank).
 *  - ROA proxy = trailing-twelve-month Net Income / latest Total Assets x
 *    100 (spec's own profitability-resilience concept, §53).
 *
 * BANK RISK SCORE = Leverage 40% (lower ratio = higher risk) + Deposit
 * Growth 30% (declining/negative growth = higher risk) + ROA 30% (lower
 * profitability = higher risk), cross-sectionally z-scored and blended. This
 * is a deliberately coarser, single composite score — NOT the country-level
 * engine's full five-domain/seven-stage model — since bank-level data here
 * doesn't yet include credit quality (NPL), liquidity (LCR/HQLA) or market
 * (CDS/equity) inputs per bank; disclosed as a first-pass bank screen, not
 * the complete picture spec §82-90 asks for.
 */

export type BankLevelRow = {
  key: string;
  name: string;
  gsib: boolean;
  totalAssets: { value: number | null; asOf: string | null };
  totalEquity: { value: number | null; asOf: string | null };
  totalDeposits: { value: number | null; asOf: string | null };
  totalLoans: { value: number | null; asOf: string | null };
  leverageRatio: number | null;
  leverageScore: number | null;
  depositGrowthYoy: number | null;
  depositGrowthScore: number | null;
  roa: number | null;
  roaScore: number | null;
  riskScore: number | null;
  dataCompleteness: number;
};

function latestPoint(points: Point[]): Point | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (a.t > b.t ? a : b));
}

function crossSectionalZ(values: Map<string, number>): Map<string, number> {
  const z = new Map<string, number>();
  const arr = Array.from(values.values());
  if (arr.length < 4) return z;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  const sd = Math.sqrt(variance);
  for (const [k, v] of values) z.set(k, sd > 0 ? (v - mean) / sd : 0);
  return z;
}

export async function getBankLevelTable(db: SupabaseClient): Promise<BankLevelRow[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDaysFor("quarterly"));
  const sinceIso = since.toISOString();

  const seriesByCompany = new Map(
    await Promise.all(
      BANK_COMPANIES.map(async (co) => {
        const [assets, equity, deposits, loans, netIncome] = await Promise.all([
          fetchSeries(db, `bank.${co.key}.total_assets`, sinceIso),
          fetchSeries(db, `bank.${co.key}.total_equity`, sinceIso),
          fetchSeries(db, `bank.${co.key}.total_deposits`, sinceIso),
          fetchSeries(db, `bank.${co.key}.total_loans`, sinceIso),
          fetchSeries(db, `bank.${co.key}.net_income`, sinceIso),
        ]);
        return [co.key, { co, assets, equity, deposits, loans, netIncome }] as const;
      })
    )
  );

  const leverageValues = new Map<string, number>();
  const depositGrowthValues = new Map<string, number>();
  const roaValues = new Map<string, number>();

  const prelim = BANK_COMPANIES.map((co) => {
    const s = seriesByCompany.get(co.key)!;
    const assetsLast = latestPoint(s.assets);
    const equityLast = latestPoint(s.equity);
    const depositsLast = latestPoint(s.deposits);
    const loansLast = latestPoint(s.loans);
    const ttmNetIncome = latestPoint(rollingSum(s.netIncome, 4));

    const leverageRatio = assetsLast && equityLast && assetsLast.v > 0 ? Math.round((equityLast.v / assetsLast.v) * 10000) / 100 : null;
    const depositGrowthYoy = pctChangeOverDays(s.deposits, 365);
    const roa = ttmNetIncome && assetsLast && assetsLast.v > 0 ? Math.round((ttmNetIncome.v / assetsLast.v) * 10000) / 100 : null;

    if (leverageRatio !== null) leverageValues.set(co.key, leverageRatio);
    if (depositGrowthYoy !== null) depositGrowthValues.set(co.key, depositGrowthYoy);
    if (roa !== null) roaValues.set(co.key, roa);

    return { co, assetsLast, equityLast, depositsLast, loansLast, leverageRatio, depositGrowthYoy, roa };
  });

  const leverageZ = crossSectionalZ(leverageValues);
  const depositGrowthZ = crossSectionalZ(depositGrowthValues);
  const roaZ = crossSectionalZ(roaValues);

  return prelim.map(({ co, assetsLast, equityLast, depositsLast, loansLast, leverageRatio, depositGrowthYoy, roa }) => {
    const leverageScore = leverageZ.has(co.key) ? zToRiskScore(leverageZ.get(co.key) ?? null, -1) : null;
    const depositGrowthScore = depositGrowthZ.has(co.key) ? zToRiskScore(depositGrowthZ.get(co.key) ?? null, -1) : null;
    const roaScore = roaZ.has(co.key) ? zToRiskScore(roaZ.get(co.key) ?? null, -1) : null;

    const riskParts = [
      leverageScore !== null ? { score: leverageScore, weight: 0.4 } : null,
      depositGrowthScore !== null ? { score: depositGrowthScore, weight: 0.3 } : null,
      roaScore !== null ? { score: roaScore, weight: 0.3 } : null,
    ].filter((p): p is { score: number; weight: number } => p !== null);
    const riskScore =
      riskParts.length > 0 ? Math.round(riskParts.reduce((a, b) => a + b.score * b.weight, 0) / riskParts.reduce((a, b) => a + b.weight, 0)) : null;

    const applicable = [leverageScore, depositGrowthScore, roaScore];
    const dataCompleteness = Math.round((applicable.filter((v) => v !== null).length / applicable.length) * 100) / 100;

    return {
      key: co.key,
      name: co.name,
      gsib: co.gsib,
      totalAssets: { value: assetsLast?.v ?? null, asOf: assetsLast?.t ?? null },
      totalEquity: { value: equityLast?.v ?? null, asOf: equityLast?.t ?? null },
      totalDeposits: { value: depositsLast?.v ?? null, asOf: depositsLast?.t ?? null },
      totalLoans: { value: loansLast?.v ?? null, asOf: loansLast?.t ?? null },
      leverageRatio,
      leverageScore,
      depositGrowthYoy,
      depositGrowthScore,
      roa,
      roaScore,
      riskScore,
      dataCompleteness,
    };
  });
}

export type { BankCompanyDef };
