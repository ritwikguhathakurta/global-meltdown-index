# Funding Carry & Arbitrage Intelligence engine

Page: `/dashboard/funding-carry` · Code: `src/lib/carry/` (pure TypeScript, no server imports) and `src/app/dashboard/funding-carry/` (client UI) · API: `POST /api/carry/calculate` (authenticated, rate-limited) · Tests: `npm run test:carry`.

**Decision support only.** Nothing here contacts a bank or executes a loan, derivative, order or hedge. Quotes entered by the user are kept in the browser (`localStorage`); the audit JSON export is the record.

## Conventions (fixed; never changed elsewhere)

| Item | Convention |
|---|---|
| Rates | decimals internally (7.10% = 0.0710, 1 bp = 0.0001); UI converts |
| Perspective | borrower; cash flow **+ received / − paid** |
| Economic cost | positive number; benefit positive in the attribution layer (two sign systems, never mixed) |
| Arbitrage | INR alternative cost − candidate cost (positive = candidate cheaper) |
| Saving | alternative cost − candidate cost |
| Headroom | arbitrage − minimum required saving |
| USD carry | direct USD cost − synthetic USD cost; INR carry = direct INR cost − synthetic INR cost; path carry = direct INR cost − path effective cost |
| FX pair | `{base, quote}` = quote units per 1 base (`USD/INR` = INR per USD); stored with explicit definition |
| FX bid / ask | bid = dealer buys base; ask = dealer sells base. **Callers never pick a side**: `convertRate(from→to)` and `buyCost` derive the adverse side from the direction (`fx.ts`) |
| Forward premium | annual, compounded: `F(t) = spot × (1+p)^t`; p of the FROM currency vs the TO currency (positive = costs more to buy FROM forward) |
| Time axis | `t = k / paymentFrequency`; coupons accrue by the deal's day count on unadjusted dates; payment dates roll to the next weekday |
| Effective funding rate | annual-effective IRR of the borrower's cash flows (`cashflow.ts`); no absolute values, no sign flipping; structures without an inflow and an outflow → `INVALID_CASH_FLOW_STRUCTURE` |
| Rounding | none internally; presentation only |

## Cash-flow model (`evaluate.ts`)

A **route** is `start currency → (edge)* → INR` over the user's dealer quotes (the funding graph, up to 3 hops, `routes.ts`). Edge types:

* **CCS** — borrower receives the FROM leg (matching its liability) and pays a fixed rate in TO: `rate_TO = flat_quote + (rate_FROM − benchmark_FROM)`; principal exchanged at inception and maturity at the same executable spot. Benchmark portions cancel exactly, so no floating forecast is needed. The lender spread passes through 1:1 at rate level.
* **FX forward / swap / NDF** — every payment converted at `spot × (1+p)^t` on the adverse side; the excess over the t0 reference rate is tagged as hedge cost.
* **Option / collar / hedge cost** — annual premium / cost added to the FROM rate (pay-off asymmetry is not modelled).
* **RBI concessional swap** — principal-only: sell USD to RBI at the FBIL reference, buy back at maturity at `spot × (1 + r/m)^(m·t)`; interest is hedged by the market forward quote or flagged UNHEDGED.

For every route the ledgers are built explicitly (borrowing, each swap's legs, fees, tax, unhedged share). Validators check that every non-INR currency nets to zero (hedged share), signs, units, FX round trip, principal reconciliation, NPV/IRR consistency and attribution reconciliation. A failed critical validator → `MODEL_VALIDATION_FAILED` (no signal).

**Mid vs executable**: each route is evaluated twice. Executable uses the adverse side of every bid/offer; `slippage = executable − mid`. An advantage that exists only at mid raises `FALSE_ARBITRAGE`.

**Attribution** (exact): share of each category in the effective rate = `r* × PV_k / ΣPV_interest`, so the waterfall sums to the IRR. Views reconciled: cash flow ↔ IRR ↔ NPV ↔ attribution.

## Reverse / break-even (`reverse.ts`)

Every threshold is solved **backwards through the full cash-flow model** by bisection on `arbitrage(x) − target = 0`: maximum lender spread, maximum total hedge cost, maximum quote on each hedge leg ("basis headroom"), break-even INR alternative, break-even funding amount (fixed INR costs) and tenor. The additive check `R_FCY,max = INR hurdle − min arbitrage − (hedge + fees + other)` is displayed next to the exact solve.

## Signals (`analyze.ts`, `signals.ts`)

`EXECUTE` requires: regulatory not blocked (POTENTIALLY_ELIGIBLE → tag `CONFIRM REGULATORY`), executable **A-quality fresh** data, effective cost < hurdle, minimum saving met, liquidity and risk limits satisfied, all critical validators pass. Illustrative/model/scenario inputs can never reach EXECUTE. Three independent rankings (theoretical / executable / risk-adjusted) are never merged.

## Regulatory engine (`regulatory.ts`)

Date-versioned rule packs (`rbi_rules/<date>/`), each rule with `rule_id, effective_from/to, source, source_url, document_date, rule_version, applicability, borrower_type, currency, minimum_maturity, maximum_amount, end_use, hedging_requirement, swap_eligibility, reporting_requirement, status, provenance`.

Provenance: `CONFIRMED_PRIMARY | DERIVED | USER_PROVIDED | NEEDS_CONFIRMATION`. "ELIGIBLE" requires every relied-on rule to be primary-confirmed or user-verified; otherwise the best answer is "POTENTIALLY ELIGIBLE".

Rules captured (retrieved 2026-09-21 from secondary summaries — **DERIVED, verify against the RBI text**):

* `2026-02-16` ECB framework — FEMA (Borrowing and Lending) (First Amendment) Regulations 2026 / A.P. (DIR) Circular 22: eligible borrowers (non-individual residents, LLPs; not trusts), recognised lenders, MAMP 3y (manufacturing 1–3y up to USD 150m), no hard all-in-cost ceiling (arm's length for related parties; one summary mentions a swap-related cap — `NEEDS_CONFIRMATION`), limit = higher of USD 1bn / 300% net worth, end-use negative list, no mandatory hedge, LRN before drawdown / Form ECB 2. The RBI Master Direction page confirms the old ECB Parts 1–12 were deleted on 16 Feb 2026.
* `2026-06-08` USD/INR forex swap facility — RBI/2026-27/100 (FMOD.MAOG.No.S-57/01.06.016/2026-27): only eligible PSU ECBs (avg maturity ≥ 3y, drawn 8 Jun–31 Dec 2026) and AD-bank OFCBs (≥ 3y); USD-only swap at a fixed 1.5% p.a. compounded semi-annually; tenor coterminous with repayment, max 5 years; open until 15 Jan 2027. The summary does not say who bears the cost — flagged.

## Assumptions and limitations

See the "Assumptions & limitations" card on the Audit tab (kept in the UI so users see it). Not built: ML/RL forecasting (needs point-in-time dealer CCS/basis history that free sources do not provide), historical walk-forward backtest, server-side alert delivery (Telegram/e-mail/webhook), a separate FastAPI/Streamlit/Postgres/Redis stack (the engine lives in the existing Next.js app), call/put/make-whole/break-cost pricing, OIS/CSA discounting curves.

## Tests

`src/lib/carry/tests/golden.test.ts` (the spec's 7.10% / 3.90% / 0.85% / 1.50% / 0.20% case → 6.45% effective, 65 bp arbitrage, **computed not hard-coded**) and `engine.test.ts` (25 checks: cancellation, path consistency, zero-cost synthetic, par-loan IRR under amortisation, day counts/leap years, bid/offer discipline, stale/illustrative gating, edge cases, hedge-ratio FX asymmetry, forward strip, attribution reconciliation with tax, reverse-solve round trip, sensitivity monotonicity, regulatory gating and versioning).
