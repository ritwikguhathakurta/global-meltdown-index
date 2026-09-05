import type { EngineContext, EngineResult, Horizon } from "./types";
import { composeEngineResult, type WeightedIndicator } from "./compose";
import { loadAllCompanies, derivedRef } from "./aiCompanyMetrics";

/**
 * AI Valuation engine (V3 §16, "AI Valuation" in the engine list). Free data
 * supports trailing P/E (stock price ÷ trailing-twelve-month diluted EPS,
 * both from free sources — Yahoo and SEC EDGAR respectively) but not
 * forward P/E, since forward earnings estimates are analyst-consensus data
 * behind paid terminals. Trailing P/E is a coincident/lagging valuation
 * read, not a leading one — flagged honestly rather than dressed up as
 * forward-looking.
 */
export async function runAiValuationEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const companies = await loadAllCompanies(ctx.db);

  const inputs: WeightedIndicator[] = companies.map((c) => ({
    ref: derivedRef(`ai.${c.ticker}.trailing_pe`, `${c.name} Trailing P/E`, "lagging", c.trailingPE, c.statusByKey.price),
    series: c.trailingPE,
    weight: 1.0,
    zDirection: 1,
  }));

  return composeEngineResult({
    engineKey: "ai_valuation",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["UNDEMANDING", "NORMAL", "ELEVATED", "STRETCHED", "EXTREME"],
    inputs,
    triggerDesc:
      "Trailing P/E ratios rising to multi-year highs across most of the tracked basket simultaneously (not one company's idiosyncratic re-rating) would indicate the market is pricing in a sustained, synchronized earnings/growth narrative across the sector — the kind of consensus positioning that is vulnerable to a shared disappointment.",
    transmissionMechanism:
      "Elevated valuations raise the bar for what counts as 'good enough' earnings to sustain the price, so a shared disappointment (a demand, margin, or capex-return surprise common to several companies) can trigger simultaneous multiple compression across the basket rather than an isolated single-stock move.",
    amplifiers: [
      "Simultaneous Market Concentration engine deterioration (these companies are disproportionately represented in cap-weighted indices)",
      "Simultaneous AI Financial Sustainability deterioration (valuations resting on a capex/revenue trend that is itself under strain)",
    ],
    invalidationConditions: ["Trailing P/E ratios decline or stabilize toward their trailing-year median across most of the basket"],
    confirmationConditions: ["A shared earnings disappointment across multiple tracked companies in the same reporting season", "Simultaneous multiple compression alongside deteriorating AI Financial Sustainability or Credit/Financing readings"],
    notYetHappened: ["No confirmed synchronized multiple compression across the tracked basket has been detected"],
    contradictoryEvidence: ["Trailing P/E is backward-looking by construction (uses reported, not forward, earnings) — a genuine forward-looking re-rating could be underway without yet showing up in a trailing ratio"],
    methodologyVersion: "v0.1-secedgar",
  });
}
