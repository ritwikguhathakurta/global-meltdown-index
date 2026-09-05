import type { EngineContext, EngineResult, Horizon } from "./types";
import { composeEngineResult, type WeightedIndicator } from "./compose";
import { loadAllCompanies, derivedRef } from "./aiCompanyMetrics";

/**
 * AI Financial Sustainability engine (V3 §16), built on real SEC EDGAR XBRL
 * data for the 8 large-cap companies most central to AI capex (see
 * secEdgar.ts for the 8 tickers and the tag-recency/de-cumulation
 * methodology). Two ratios per company: capex/revenue (is spending
 * outrunning the business that's supposed to fund it?) and free-cash-flow
 * margin (is the business still generating cash after that capex?).
 * "AI revenue" specifically is not disclosed as a discrete XBRL fact by any
 * of these companies, so total company revenue is used instead — this
 * engine measures capex intensity relative to the whole business, not an
 * AI-segment-specific ratio the data doesn't support.
 */
export async function runAiFinancialSustainabilityEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const companies = await loadAllCompanies(ctx.db);

  const inputs: WeightedIndicator[] = [];
  for (const c of companies) {
    inputs.push({
      ref: derivedRef(`ai.${c.ticker}.capex_to_revenue`, `${c.name} Capex / Revenue`, "leading", c.capexToRevenue, c.statusByKey.capex),
      series: c.capexToRevenue,
      weight: 1.0,
      zDirection: 1,
    });
    inputs.push({
      ref: derivedRef(`ai.${c.ticker}.fcf_margin`, `${c.name} FCF Margin`, "coincident", c.fcfMargin, c.statusByKey.opCashFlow),
      series: c.fcfMargin,
      weight: 0.8,
      zDirection: -1,
    });
  }

  return composeEngineResult({
    engineKey: "ai_financial_sustainability",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["SELF_FUNDING", "SUSTAINABLE", "STRETCHED", "CAPEX_OUTRUNNING_CASH", "UNSUSTAINABLE_PACE"],
    inputs,
    triggerDesc:
      "A rising capex/revenue ratio combined with a falling FCF margin across multiple companies simultaneously (not one company's own investment cycle) is the pattern that would indicate the sector as a whole is spending faster than the underlying businesses can fund — the leading indicator per V3 §17 is capex growth outpacing revenue growth, not the absolute capex level.",
    transmissionMechanism:
      "If capex continues outrunning operating cash generation, these companies must fund the gap with debt issuance, equity issuance, or drawing down cash reserves; a sustained inability to self-fund capex out of FCF is the mechanism by which an AI capex supercycle becomes a financing/credit story (see AI Credit/Financing engine) rather than staying a pure growth story.",
    amplifiers: [
      "Simultaneous AI Credit/Financing engine deterioration (debt-funded rather than cash-funded capex)",
      "Simultaneous AI Debt Maturity Wall pressure",
      "GPU/data-center demand softening while committed capex cannot be quickly reversed (contractual purchase commitments, not tracked here — no free structured source)",
    ],
    invalidationConditions: ["FCF margins stabilize or improve across most tracked companies", "Capex/revenue ratios plateau rather than continuing to rise"],
    confirmationConditions: ["Multiple companies report capex guidance cuts in the same quarter", "Simultaneous deceleration in reported AI/cloud revenue growth commentary (qualitative — not tracked numerically)"],
    notYetHappened: ["No confirmed synchronized FCF-margin deterioration across the tracked company basket yet"],
    contradictoryEvidence: ["This engine cannot see AI-specific revenue, GPU orders, backlog, or power-contract data (V3 §17) — only consolidated company-wide financials from quarterly SEC filings"],
    methodologyVersion: "v0.1-secedgar",
  });
}
