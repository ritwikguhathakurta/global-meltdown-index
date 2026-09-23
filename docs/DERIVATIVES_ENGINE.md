# Derivatives & Leverage Intelligence

Page: `/dashboard/derivatives` ("Derivatives / Leverage" in nav) · Code: `src/lib/derivatives/` (pure TypeScript, no server imports) plus the page-level server wrapper `src/lib/api/derivativesData.ts` and UI in `src/app/dashboard/derivatives/` · API: the GFMI-registered engine is still served at `GET /api/derivatives` · Tests: `npm run test:derivatives`.

This was built against a 151-section institutional spec (`Derivative_Engine.pdf`) asking for OTC/listed derivatives, margin, collateral, positioning, counterparty risk, options Greeks/gamma, CCP data, DTCC/ISDA feeds and ML-based early warning. Per this repo's "every number is real, nothing faked" discipline, most of the spec's most demanding asks require paid/licensed data or a labeled ground-truth dataset that does not exist for free — those are explicitly **not built**, disclosed on the page's own Sources & Limitations tab, not silently omitted. What follows is the real, free-data subset that was built, all under the one existing "Derivatives / Leverage" nav entry and route — no new nav item, no second GFMI-registry engine, per explicit instruction.

## Two independent things share this one page

1. **The registered GFMI engine** (`src/lib/engines/derivativesLeverage.ts`, `derivatives_leverage`, GFMI weight 0.7) — a real CFTC-COT-based positioning proxy, widened from 2 to 6 markets (E-mini S&P 500, VIX futures, 10Y Treasury leveraged-funds, gold/crude/natural-gas managed-money). It still uses the generic `EngineResult`/`composeEngineResult` shape every other registry engine uses. Widening its market coverage changed its GFMI contribution as an expected side effect (more inputs → different z-scores), not a bug.
2. **The page-level analytical layer** (`src/lib/derivatives/`) — GLI, CRI, MSI, CSI, FDR, DLS, CALCI, PCI and the Global Leverage Regime label. These are **not** registered in `gfmi.ts`'s composite — same architectural role as `src/lib/carry/` for the Funding Carry page. Deeper GFMI dependency-graph integration (spec §121) is a materially bigger, separate change to `gfmi.ts` itself and is deliberately deferred, not silently done.

## Data quality is explicit, everywhere

Every reading and composite index carries a `DataQuality` tag (`src/lib/derivatives/types.ts`):

- **REAL** — a genuine observation (BIS OTC notional, CFTC COT positions, NY Fed repo rates, bank leverage ratios, VIX/MOVE, Binance funding rate/OI).
- **MODEL_ESTIMATE** — a heuristic built from real proxies standing in for something no free source publishes (margin calls, collateral haircuts, forced-selling flows). MSI, CSI, FDR, DLS and CALCI are MODEL_ESTIMATE by construction; every card carrying this badge states its exact formula in `methodology`. GLI, PCI and CRI combine real observations into a genuine index and are REAL (CRI is MODEL_ESTIMATE only insofar as the *combination* of real bank-leverage and credit-spread data into one "counterparty risk" number is this page's own heuristic, not a published index).
- **UNAVAILABLE** — no data, shown as such, never silently dropped.

## New real data sources (verified live before building)

- **`bisOtcDerivatives.ts`** — BIS SDMX API, `WS_OTC_DERIV2`: OTC derivatives notional outstanding by risk category (total, FX, rates, equity, commodity, credit), semiannual, worldwide, net-net basis. BIS's own headline cross-cut — confirmed against real, current data (~$845tn total for 2025-S2, matching BIS's own published aggregate). Gross market value at the same "all instruments" cross-cut and the exchange-traded dataflow (`WS_XTD_DERIV`, no published worldwide total) were checked and are **not** built — see the page's Sources tab for why.
- **`cftcCot.ts` extended** — Disaggregated COT (crude oil, natural gas, gold; producer/merchant, swap dealer, managed-money categories) and Traders-in-Financial-Futures (2/5/10/30Y Treasury futures; dealer, asset manager, leveraged-funds categories). Every market name was verified against the *current* report date, not assumed — several contracts have been renamed since this repo's original Legacy-COT list was written (e.g. the main NYMEX WTI contract is now "WTI FINANCIAL CRUDE OIL", not "CRUDE OIL, LIGHT SWEET", which stopped updating in Nov 2021).
- **`nyFedRepoRates.ts`** — NY Fed Markets Data API: SOFR/TGCR/BGCR with percentile bands and volume, free, no key.
- **`binancePerpetuals.ts`** — Binance Futures public API: BTC/ETH perpetual funding rate and open interest. Tier 3 (a single commercial exchange), labeled as such everywhere it's shown.
- **MOVE index** added to `yahooIndex.ts`'s existing pattern (same mechanism as VIX).
- **`bankSecFilings.ts` extended** — `DerivativeNotionalAmount`/`DerivativeAssets`/`DerivativeLiabilities` XBRL concepts, where each bank actually tags them (not every bank does — confirmed live: Wells Fargo doesn't tag the notional concept the same way JPMorgan/Goldman/PNC do; shown as UNAVAILABLE for that bank, not estimated).

## Not built, and why (see also the page's own Sources & Limitations tab)

DTCC GTR/Trade Information Warehouse and ISDA SwapsInfo/Margin Survey (no verified free access), WFE/FIA (subscription/member data), live options chains/Greeks/dealer gamma/gamma walls/max pain/vanna/charm (no free source exists anywhere, global or India — matches `derivativesLeverage.ts`'s own pre-existing disclosure), NSE/BSE/MCX/NCDEX/SEBI/CCIL India exchange data (no verified feasible free connector found), 13F/N-PORT/Form PF position-level detail, CCP-level (CME/ICE/LCH/Eurex) margin/default-fund data, and ML/precision-recall/AUC-validated backtesting (no labeled ground-truth dataset exists — the Historical Reference tab is a factual crisis table instead, explicitly not a scored backtest). An LLM-powered "Ask Derivatives" was also not added: this repo currently discloses exactly two LLM-computed surfaces (see `CLAUDE.md`) and a third is a decision for the user to make explicitly, not something to add quietly.

## Tests

`src/lib/derivatives/tests/engine.test.ts` (13 checks): positioning-crowding threshold logic, PCI/GLI/CRI/MSI/CSI computation and UNAVAILABLE fallbacks, the CALCI amplification behavior (stress amplifies leverage rather than averaging with it), scenario-calculator monotonicity, and the historical reference table's structural completeness.
