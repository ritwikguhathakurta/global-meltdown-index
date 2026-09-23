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

DTCC GTR/Trade Information Warehouse (position-level, reporting-party/paid access) and ISDA SwapsInfo/Margin Survey (no verified free access), WFE/FIA (subscription/member data), live options chains/Greeks/dealer gamma/gamma walls/max pain/vanna/charm (no free source exists anywhere, global or India — matches `derivativesLeverage.ts`'s own pre-existing disclosure), BSE/MCX/NCDEX/SEBI/CCIL India data (BSE/MCX archive endpoints are bot-protected — confirmed live, 403 — unlike NSE's; NSE F&O itself **is** now built, see below), 13F/N-PORT/Form PF position-level detail, CCP-level (CME/ICE/LCH/Eurex) margin/default-fund data, the OCC Quarterly Report on Bank Derivatives Activities (confirmed live: PDF-only, no machine-readable table found — its multi-bank tables are exactly the kind of structured data that risks silent wrong-number extraction if PDF-parsed without a reliable layout), and ML/precision-recall/AUC-validated backtesting (no labeled ground-truth dataset exists — the Historical Reference tab is a factual crisis table instead, explicitly not a scored backtest). An LLM-powered "Ask Derivatives" was also not added: this repo currently discloses exactly two LLM-computed surfaces (see `CLAUDE.md`) and a third is a decision for the user to make explicitly, not something to add quietly.

## Phase 2 additions (corrections to the above, verified live)

Two Phase 1 disclosures turned out to be wrong and were corrected rather than left standing:

- **`nseFoBhavcopy.ts`** — NSE India's daily F&O bhavcopy ("UDiFF" format,
  `archives.nseindia.com/content/fo/...`) is free, official, and current — unlike
  the bot-protected main `nseindia.com` site, or the legacy bhavcopy path
  (`.../content/historical/DERIVATIVES/...`) which NSE stopped publishing after
  ~2024. Feeds NIFTY/BANKNIFTY futures open interest, index-options put/call
  open-interest ratio (a standard positioning-sentiment indicator), and
  whole-market F&O turnover/open interest — shown on the new **India F&O** tab.
  Real, Tier 1.
- **`dtccSwapData.ts`** — DTCC's public swap-transaction dissemination data
  (`kgc0418-tdw-data-0.s3.amazonaws.com`), published because CFTC Part 43/SEC
  Reg SBSR require public dissemination of most OTC swap trades, is free and
  current — the genuine (if narrower) real counterpart to the full DTCC GTR.
  Only a **daily new-trade count per asset class** (rates/credit/FX/commodity)
  is shown, shown on the OTC & Exchange tab. Two additional metrics — a
  cleared-percentage and a USD notional total — were built, verified against
  live data, and then deliberately deleted before shipping: the per-row
  "Cleared" field reflects clearing as a separate, later lifecycle event (not
  the original trade's own status — verified live that real vanilla swaps
  show ~0% "Y" on this field despite real clearing rates being >90%), and
  per-row notional is subject to CFTC-mandated size caps for large trades
  (one live row was capped at a 10^20 placeholder), so summing it produces a
  technically-real but practically meaningless total. Equity swaps are not
  fetched (the daily file is ~40MB compressed, too large for a safe stage
  budget). Real, Tier 1.
- **"Ask Derivatives"** (`src/lib/prediction/askDerivatives.ts`, API
  `/api/derivatives/ask`, UI: the new "Ask Derivatives" tab) — this project's
  third disclosed LLM-computed surface (see CLAUDE.md's "three places an LLM
  computes something user-facing"), added only after this was explicitly
  flagged as a policy decision and the user confirmed it. User-triggered
  only, never automatic. The model never computes a new number: it is handed
  a fixed snapshot of this page's own already-computed REAL/MODEL_ESTIMATE
  values (composite index levels, crowded positioning, BIS OTC total, repo
  rates, VIX/MOVE, India F&O, DTCC trade counts, crypto funding) and
  instructed to answer strictly from them, saying plainly when a question
  asks about something this dashboard doesn't track (options Greeks, a price
  forecast, position-level CCP data) rather than guessing. Same dual-provider
  (Gemini free tier, OpenAI fallback) and per-user cooldown pattern as
  `/api/prediction/analyze`.

## Global leading-indicator coverage (regulator/exchange-by-region check)

The registered `derivatives_leverage` engine's "Leading Indicators" table (Overview tab) is the
one place new country/exchange positioning data shows up directly, since it's the GFMI-registered
engine's own indicator list. Per an explicit request to check equity/derivatives regulators across
G7, the Middle East, Africa, Asia, Latin America, Europe and Scandinavia, every exchange/regulator
below was checked live (not assumed) before deciding to build or skip it:

**Built (real, free, verified live)**:
- 🇺🇸 USA — CFTC COT (`cftcCot.ts`, 6 markets already in the engine)
- 🇮🇳 India — NSE F&O bhavcopy (`nseFoBhavcopy.ts`)
- 🇭🇰 Hong Kong — HKEX Daily Trading Activity & Open Positions Summary (`hkexDerivatives.ts`): real
  Gross OI for HSI/HHI/MHI index futures, plus a whole-market equity/index options put/call OI ratio
- 🇧🇷 Brazil — B3 COTAHIST daily file (`b3Derivatives.ts`): real equity-options put/call **volume**
  ratio (this file has no open-interest field) and cash-market turnover

**Checked and found gated/paid, not free** (confirmed live, not assumed):
- 🇯🇵 Japan — JPX's comprehensive open-interest data requires a paid data-services contract; only a
  short-window (last ~2 months) options-only free CSV exists, not enough for this engine's z-score
  window
- 🇩🇪 Germany / pan-Europe — Eurex's open-interest File Service requires an MD+S login; not free
- 🇿🇦 South Africa — JSE's derivatives historical data is a paid CME DataMine product, not free

**Checked and blocked by bot protection, unable to verify either way**:
- 🇸🇬 Singapore — SGX's data API returned 403/bot-challenge responses; no working free endpoint found
  in this pass (matches the same pattern already documented for BSE/MCX)
- 🇸🇦 Saudi Arabia — Tadawul's market-data pages returned 403

**Checked, has a real "Open API" but requires registration this pass didn't complete**:
- 🇰🇷 South Korea — KRX publishes an official Open API (`openapi.krx.co.kr`) covering derivatives,
  but it requires signing up for a key; not verified end-to-end, not built. A real candidate for a
  future pass if the user wants to register for a key.

**Not reached this pass** (a first-guess URL didn't resolve/existed and wasn't investigated further
— genuinely "not checked thoroughly," not "confirmed unavailable"): UK/ICE Futures Europe, France
and Italy's Euronext-based markets, Canada's Montreal Exchange, mainland China's CFFEX/SSE/SZSE,
Taiwan's TAIFEX, Mexico's MexDer, the EU-wide ESMA statistics register, Nasdaq Nordic (Scandinavia),
and UAE/Qatar/Egypt's exchanges. Most emerging-market exchanges bot-protect their main sites the same
way BSE/MCX/JSE/SGX do, or gate real open-interest data behind a paid vendor the way Japan/Eurex/JSE
do — the pattern found repeatedly in this pass — so the realistic expectation for a future attempt is
more "gated or blocked" than "another free NSE/HKEX/B3." This list exists so a future session doesn't
re-attempt an already-checked dead end without reading this first.

## Tests

`src/lib/derivatives/tests/engine.test.ts` (13 checks): positioning-crowding threshold logic, PCI/GLI/CRI/MSI/CSI computation and UNAVAILABLE fallbacks, the CALCI amplification behavior (stress amplifies leverage rather than averaging with it), scenario-calculator monotonicity, and the historical reference table's structural completeness.
