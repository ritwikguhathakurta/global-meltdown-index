import type { EngineContext, EngineResult, Horizon } from "./types";
import { composeEngineResult, type WeightedIndicator } from "./compose";
import { loadAllCompanies, derivedRef } from "./aiCompanyMetrics";

/**
 * AI Credit/Financing engine (V3 §16). Debt/EBITDA and interest coverage
 * computed on a trailing-twelve-month basis from real SEC EDGAR data, so a
 * single unusually large or small quarter doesn't distort the ratio. EBITDA
 * here is a proxy (operating income + D&A from the cash-flow statement),
 * not a company-reported "Adjusted EBITDA" figure with add-backs — flagged
 * so it isn't mistaken for the (higher, more flattering) number companies
 * sometimes present themselves.
 */
export async function runAiCreditFinancingEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const companies = await loadAllCompanies(ctx.db);

  const inputs: WeightedIndicator[] = [];
  for (const c of companies) {
    inputs.push({
      ref: derivedRef(`ai.${c.ticker}.debt_to_ebitda`, `${c.name} Debt / TTM EBITDA (proxy)`, "coincident", c.debtToEbitda, c.statusByKey.debtNoncurrent),
      series: c.debtToEbitda,
      weight: 1.0,
      zDirection: 1,
    });
    inputs.push({
      ref: derivedRef(`ai.${c.ticker}.interest_coverage`, `${c.name} Interest Coverage (TTM)`, "coincident", c.interestCoverage, c.statusByKey.interestExpense),
      series: c.interestCoverage,
      weight: 0.7,
      zDirection: -1,
    });
  }

  return composeEngineResult({
    engineKey: "ai_credit_financing",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["CONSERVATIVE", "NORMAL", "LEVERAGING_UP", "STRETCHED", "CREDIT_STRESS"],
    inputs,
    triggerDesc:
      "Rising Debt/EBITDA alongside falling interest coverage across multiple companies simultaneously indicates the sector is increasingly funding AI capex with debt rather than operating cash flow — the specific pattern V3 flags as 'AI debt sustainability' risk, distinct from the equity-valuation risk in the AI Valuation engine.",
    transmissionMechanism:
      "Rising leverage increases refinancing risk (see AI Debt Maturity Wall engine) and interest-rate sensitivity; if credit-rating agencies react to deteriorating coverage ratios, downgrades would raise these companies' cost of debt at the same time their capex needs are largest, compounding the pressure.",
    amplifiers: [
      "Simultaneous AI Financial Sustainability deterioration (the capex the debt is funding is itself outrunning revenue)",
      "Simultaneous Corporate Credit engine widening (a sector-specific move confirmed by the broader market)",
      "A credit-rating outlook action on any of the tracked companies (not tracked — no free ratings-action feed)",
    ],
    invalidationConditions: ["Debt/EBITDA stabilizes or declines across most tracked companies", "Interest coverage stabilizes or improves"],
    confirmationConditions: ["A credit-rating downgrade or negative outlook on a tracked company", "Widening credit spreads specifically in AI-sector-linked bonds (not separately tracked — see Credit engine for the broad-market read)"],
    notYetHappened: ["No confirmed synchronized leverage deterioration across the tracked basket has been detected"],
    contradictoryEvidence: ["EBITDA here is a proxy (operating income + D&A), not each company's own 'Adjusted EBITDA' definition, which typically excludes more items and would show a lower leverage ratio than computed here"],
    methodologyVersion: "v0.1-secedgar",
  });
}
