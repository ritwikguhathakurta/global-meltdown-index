/**
 * Analyst commentary on BOJ's 2026-09-18 rate decision (25bp hike, 1.00% ->
 * 1.25%, effective 2026-09-24).
 *
 * This is CURATED, HUMAN/CLAUDE-WRITTEN QUALITATIVE JUDGMENT, not a computed
 * metric — the same category as centralBankFsrRegistry.ts's `stance` fields,
 * and the same disclosure discipline as the LLM-analysis carve-out at
 * /dashboard/prediction (see openaiAnalysis.ts): a forward-looking rate-path
 * view cannot be a deterministic function of stored data the way this app's
 * z-scores/ADF tests/event studies are, so it is never presented as one.
 *
 * Every data point cited below (rate.japan_call_rate, yield.japan_10y,
 * fx.usdjpy, banking.equity_japan) was read live from metric_series on
 * 2026-09-18 before writing this — see the observedAsOf values — but the
 * INTERPRETATION and forward trajectory view are judgment, not fact. This
 * file is not wired into the daily pipeline and does not update itself; it
 * reflects one decision as of one date and should be revisited (or removed)
 * once superseded by BOJ's next move.
 */

export type DecisionCommentary = {
  institution: string;
  decisionDate: string;
  decisionSummary: string;
  writtenAsOf: string;
  dataSnapshot: { label: string; value: string; observedAsOf: string }[];
  shortTerm: string;
  mediumTerm: string;
  longTerm: string;
  trajectory: string;
};

export const BOJ_SEPT_2026_COMMENTARY: DecisionCommentary = {
  institution: "Bank of Japan",
  decisionDate: "2026-09-18",
  decisionSummary:
    "Target raised 25bp to 1.25% (from 1.00%), effective 2026-09-24 — read directly from BOJ's own decision PDF.",
  writtenAsOf: "2026-09-18",
  dataSnapshot: [
    { label: "USD/JPY", value: "154.04 -> 155.69 (Sep 11-17)", observedAsOf: "2026-09-17" },
    { label: "JGB 10y yield", value: "~2.99%", observedAsOf: "2026-09-17" },
    { label: "TOPIX Banks proxy (1631.T)", value: "42,300 -> 41,320 (Sep 14-18)", observedAsOf: "2026-09-18" },
    { label: "Realized call rate", value: "0.977% (settlement lags the new target)", observedAsOf: "2026-09-16" },
  ],
  shortTerm:
    "USDJPY weakened into the hike (154.04 -> 155.69, Sep 11-17) rather than strengthening — a 'sell the news' or " +
    "'not hawkish enough' reaction, not the textbook response. The TOPIX banks proxy fell over the same window " +
    "(42,300 -> 41,320) instead of rallying on NIM-expansion hopes, suggesting the market is currently weighting " +
    "growth/credit-quality drag over margin upside. Watch rate.japan_call_rate for the realized average to actually " +
    "cross toward ~1.2%+ after the 2026-09-24 effective date — until then the settlement series will keep lagging.",
  mediumTerm:
    "Carry-trade unwind risk rises with every hike, since it raises JPY funding costs — the same mechanism behind " +
    "the August 2024 unwind episode. The yen-carry page's live USDJPY overlay is the thing to watch for a fast, " +
    "disorderly move rather than the gradual drift seen so far. JGB 10y yield is already near 3%; further hikes plus " +
    "BOJ balance-sheet normalization compound Japan's debt-service math given its debt/GDP level. Bank margins " +
    "should eventually show a NIM tailwind in banking.equity_japan if the hike sticks and isn't offset by growth " +
    "concerns — whether the current equity dip fades or persists is the tell for which force is dominating.",
  longTerm:
    "This reads as a continuation of BOJ's slow, telegraphed normalization path rather than a regime break. This " +
    "app doesn't ingest Japan CPI or wage data, so this view isn't backed by a stored series here — it's macro " +
    "judgment based on BOJ's own stated reaction function (inflation + wage growth sustaining near 2%).",
  trajectory:
    "Absent a yen collapse or an inflation surprise, expect further hikes to keep following confirmed wage/price " +
    "data rather than come back-to-back — closer to a 'hike every other meeting' cadence than a sustained tightening " +
    "cycle. This is a probabilistic view, not a number this app computes or verifies against a data source.",
};
