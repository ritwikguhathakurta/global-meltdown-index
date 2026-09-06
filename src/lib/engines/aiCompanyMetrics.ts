import type { SupabaseClient } from "@supabase/supabase-js";
import { buildIndicator } from "./indicator";
import { AI_COMPANIES } from "../sources/secEdgar";
import {
  ratioSeriesByDate,
  sumSeriesByDate,
  subtractSeriesByDate,
  rollingSum,
  divideByLastKnown,
} from "../metrics/stats";
import type { Point } from "../metrics/stats";
import type { IndicatorRef } from "./types";

/**
 * Derives the ratios the four AI engines need from the raw SEC EDGAR
 * quarterly series (see secEdgar.ts for how those are extracted). Computed
 * once per company here and shared across engines rather than duplicated,
 * since e.g. total debt and TTM EBITDA both feed more than one engine.
 * TTM (trailing-twelve-month) sums are used for flow measures compared
 * against a balance-sheet stock (debt, cash) so the ratio isn't distorted
 * by a single unusually large or small quarter.
 */
export type CompanyDerived = {
  ticker: string;
  name: string;
  revenue: { ref: IndicatorRef; series: Point[] };
  capexToRevenue: Point[];
  fcf: Point[];
  fcfMargin: Point[];
  totalDebt: Point[];
  netDebt: Point[];
  ttmEbitda: Point[];
  debtToEbitda: Point[];
  interestCoverage: Point[];
  ttmEpsSum: Point[];
  trailingPE: Point[];
  maturityY1CoverageRatio: Point[];
  maturitySchedule: { y1: Point[]; y2: Point[]; y3: Point[] };
  statusByKey: Record<string, IndicatorRef>;
};

export async function loadCompanyDerived(db: SupabaseClient, ticker: string, name: string): Promise<CompanyDerived> {
  const [
    revenue,
    operatingIncome,
    opCashFlow,
    capex,
    depreciation,
    interestExpense,
    epsDiluted,
    cash,
    debtNoncurrent,
    debtCurrent,
    maturityY1,
    maturityY2,
    maturityY3,
    price,
  ] = await Promise.all([
    buildIndicator(db, `ai.${ticker}.revenue`, `${name} Revenue`, "coincident", "quarterly", "USD"),
    buildIndicator(db, `ai.${ticker}.operating_income`, `${name} Operating Income`, "coincident", "quarterly", "USD"),
    buildIndicator(db, `ai.${ticker}.op_cash_flow`, `${name} Operating Cash Flow`, "coincident", "quarterly", "USD"),
    buildIndicator(db, `ai.${ticker}.capex`, `${name} Capex`, "leading", "quarterly", "USD"),
    buildIndicator(db, `ai.${ticker}.depreciation`, `${name} D&A`, "lagging", "quarterly", "USD"),
    buildIndicator(db, `ai.${ticker}.interest_expense`, `${name} Interest Expense`, "lagging", "quarterly", "USD"),
    buildIndicator(db, `ai.${ticker}.eps_diluted`, `${name} Diluted EPS`, "lagging", "quarterly", "USD/share"),
    buildIndicator(db, `ai.${ticker}.cash`, `${name} Cash`, "coincident", "quarterly", "USD"),
    buildIndicator(db, `ai.${ticker}.debt_noncurrent`, `${name} Long-Term Debt (Noncurrent)`, "coincident", "quarterly", "USD"),
    buildIndicator(db, `ai.${ticker}.debt_current`, `${name} Long-Term Debt (Current)`, "coincident", "quarterly", "USD"),
    // Debt-maturity schedules are disclosed in 10-Ks, not every 10-Q, so in practice these
    // refresh once a year per company — "annual" here calibrates staleness against that real
    // cadence instead of flagging a just-filed, fully-current schedule as STALE for most of the
    // year it's still the latest available figure.
    buildIndicator(db, `ai.${ticker}.debt_maturity_y1`, `${name} Debt Maturing in Y1`, "leading", "annual", "USD"),
    buildIndicator(db, `ai.${ticker}.debt_maturity_y2`, `${name} Debt Maturing in Y2`, "leading", "annual", "USD"),
    buildIndicator(db, `ai.${ticker}.debt_maturity_y3`, `${name} Debt Maturing in Y3`, "leading", "annual", "USD"),
    buildIndicator(db, `ai.${ticker}.price`, `${name} Stock Price`, "coincident", "daily", "USD"),
  ]);

  const capexToRevenue = ratioSeriesByDate(capex.series, revenue.series);
  const fcf = subtractSeriesByDate(opCashFlow.series, capex.series);
  const fcfMargin = ratioSeriesByDate(fcf, revenue.series);

  const totalDebt = sumSeriesByDate(debtNoncurrent.series, debtCurrent.series);
  const netDebt = subtractSeriesByDate(totalDebt, cash.series);

  const ttmOperatingIncome = rollingSum(operatingIncome.series, 4);
  const ttmDepreciation = rollingSum(depreciation.series, 4);
  const ttmInterestExpense = rollingSum(interestExpense.series, 4);
  const ttmEbitda = sumSeriesByDate(ttmOperatingIncome, ttmDepreciation);
  const debtToEbitda = ratioSeriesByDate(totalDebt, ttmEbitda);
  const interestCoverage = ratioSeriesByDate(ttmOperatingIncome, ttmInterestExpense);

  const ttmEpsSum = rollingSum(epsDiluted.series, 4);
  const trailingPE = divideByLastKnown(price.series, ttmEpsSum);

  const ttmFcf = rollingSum(fcf, 4);
  const availableLiquidity = sumSeriesByDate(cash.series, ttmFcf);
  const maturityY1CoverageRatio = ratioSeriesByDate(maturityY1.series, availableLiquidity);

  return {
    ticker,
    name,
    revenue,
    capexToRevenue,
    fcf,
    fcfMargin,
    totalDebt,
    netDebt,
    ttmEbitda,
    debtToEbitda,
    interestCoverage,
    ttmEpsSum,
    trailingPE,
    maturityY1CoverageRatio,
    maturitySchedule: { y1: maturityY1.series, y2: maturityY2.series, y3: maturityY3.series },
    statusByKey: {
      revenue: revenue.ref,
      capex: capex.ref,
      opCashFlow: opCashFlow.ref,
      operatingIncome: operatingIncome.ref,
      depreciation: depreciation.ref,
      interestExpense: interestExpense.ref,
      epsDiluted: epsDiluted.ref,
      cash: cash.ref,
      debtNoncurrent: debtNoncurrent.ref,
      debtCurrent: debtCurrent.ref,
      price: price.ref,
      maturityY1: maturityY1.ref,
    },
  };
}

export async function loadAllCompanies(db: SupabaseClient): Promise<CompanyDerived[]> {
  return Promise.all(AI_COMPANIES.map((c) => loadCompanyDerived(db, c.ticker, c.name)));
}

/** Builds a synthetic IndicatorRef for a derived (computed, not directly-fetched) per-company series. */
export function derivedRef(
  key: string,
  label: string,
  classification: "leading" | "coincident" | "lagging",
  series: Point[],
  basedOn: IndicatorRef
): IndicatorRef {
  return {
    key,
    label,
    classification,
    value: series.at(-1)?.v ?? null,
    unit: undefined,
    status: series.length > 0 ? basedOn.status : "UNAVAILABLE",
    sourceKey: "sec_edgar",
    sourceTier: 1,
    asOf: series.at(-1)?.t ?? null,
  };
}
