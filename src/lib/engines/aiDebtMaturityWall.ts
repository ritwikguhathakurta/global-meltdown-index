import type { EngineContext, EngineResult, Horizon } from "./types";
import { composeEngineResult, type WeightedIndicator } from "./compose";
import { loadAllCompanies, derivedRef } from "./aiCompanyMetrics";

/**
 * AI Debt Maturity Wall engine (V3 §19). V3 asks for a full 2026-2032+
 * ladder; SEC XBRL debt-maturity-schedule tags reliably give only the next
 * three years for most filers (and Nvidia doesn't tag a maturity schedule
 * at all — it shows up as UNAVAILABLE for that company, not zero), so this
 * is scoped to what's actually disclosed. The score is a coverage ratio:
 * next-12-months debt maturities relative to cash + trailing-twelve-month
 * free cash flow — i.e. can the company plausibly refinance/repay what's
 * coming due out of what it already has and generates, without needing
 * fresh external financing at whatever rate the market offers at the time.
 */
export async function runAiDebtMaturityWallEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const companies = await loadAllCompanies(ctx.db);

  const inputs: WeightedIndicator[] = companies.map((c) => ({
    ref: derivedRef(`ai.${c.ticker}.maturity_y1_coverage`, `${c.name} Y1 Debt Maturity / (Cash + TTM FCF)`, "leading", c.maturityY1CoverageRatio, c.statusByKey.maturityY1),
    series: c.maturityY1CoverageRatio,
    weight: 1.0,
    zDirection: 1,
  }));

  return composeEngineResult({
    engineKey: "ai_debt_maturity_wall",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["EASILY_COVERED", "COMFORTABLE", "MANAGEABLE", "TIGHT", "REFINANCING_RISK"],
    inputs,
    triggerDesc:
      "A rising ratio of near-term debt maturities to available cash-plus-FCF, especially if it rises for several companies at once heading into the same window, is the leading signal — it means more of the balance sheet depends on successfully refinancing at whatever rate/appetite the credit market offers at that time, rather than being self-funded.",
    transmissionMechanism:
      "A company that cannot cover near-term maturities from cash and internally generated cash flow must refinance in the market; if that coincides with wider credit spreads (see Credit and AI Credit/Financing engines) or a risk-off period, the refinancing cost can jump sharply or, in a severe case, market access can become uncertain.",
    amplifiers: [
      "Simultaneous AI Credit/Financing engine deterioration (already-elevated leverage makes fresh refinancing harder to place)",
      "Simultaneous broad Credit engine widening (a sector-specific wall colliding with an unfavorable market-wide credit window)",
      "Multiple tracked companies facing large maturities in the same year (concentration risk this per-company view doesn't itself aggregate)",
    ],
    invalidationConditions: ["The coverage ratio declines or stabilizes across most tracked companies", "A company proactively refinances/extends a maturity well ahead of its due date (not tracked in real time — would show up as a later reduction in the Y1 figure)"],
    confirmationConditions: ["A tracked company reports difficulty accessing debt markets on favorable terms", "Credit spreads widen specifically around a known maturity window"],
    notYetHappened: ["No confirmed refinancing stress has been detected in the tracked coverage ratios"],
    contradictoryEvidence: ["Nvidia does not tag a debt-maturity schedule in its SEC filings (immaterial debt load) and is UNAVAILABLE here, not zero-risk by measurement — it is simply not disclosed in a form this engine can read"],
    methodologyVersion: "v0.1-secedgar",
  });
}
