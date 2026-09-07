# Global Meltdown Index

A leading-indicator systemic-risk terminal (globalmeltdownindex.net), built against the V3
specification in this repo's originating brief. This is **Phase 1** of a large build — see
[Scope](#scope--whats-not-here-yet) before assuming full spec coverage.

Core question the platform answers: *what is changing now that could matter later?*

## What's built

- **Next.js 16 / TypeScript / Tailwind v4** app, deployable to Vercel.
- **Supabase** for Postgres (data + auth). Email/password sign-up with a 90-day free trial
  auto-granted on signup; role-based access (`user` / `admin`) enforced server-side in `src/proxy.ts`.
- **24 risk engines**, fed entirely by free/official data, each producing short/medium/long-term
  scores with leading/coincident/lagging indicator breakdowns, triggers, transmission mechanism,
  confirmation/invalidation conditions, and a "what has not yet happened" section. Most cover the
  **G7 (US, Canada, UK, Germany, France, Italy, Japan) plus China**, not just the US — see
  [Country coverage](#country-coverage-g7--china) below:
  - Global Liquidity (Fed + ECB/Germany-France-Italy + BOJ + BoE + BoC + a China rate proxy),
    Credit Markets, Equity Fragility, Yen Carry Stress
  - Treasury & Sovereign Debt (US plus the rest of the G7 + a China funding-rate proxy — fulfills
    both US Treasury/Sovereign and Global Sovereign Debt in one engine)
  - Banking, Property/CRE, Emerging-Market Debt, Energy, Geopolitical,
    Derivatives/Leverage, Crypto/Stablecoins, Cyber/Infrastructure, Trade/Economic Policy, Supply Chains
  - Market Concentration and Private Credit (both market-price proxies — see limitations below)
  - AI Financial Sustainability, AI Valuation, AI Credit/Financing, AI Debt Maturity Wall — built on
    real SEC EDGAR XBRL filings for 8 large-cap AI-capex-relevant companies (see
    [AI engines](#ai-engines-real-sec-edgar-data-not-a-mockup) below)
  - **India Liquidity** (new, standalone — RBI's own daily net-liquidity and overnight-rate data),
    separate from India Market Regime (a bullish/bearish equity-direction call on a different scale)
  - **India Yield Curve** (new, standalone — India's short/medium/long sovereign curve and inversion
    risk, built from RBI's own T-Bill/G-Sec primary-auction results, since CCIL's Terms of Use rule
    out an automated feed of its secondary-market curve — see [CCIL](#ccil-not-used) below)
  - Plus **partial** China and India Market Regime engines (each page lists exactly which spec
    indicators are `UNAVAILABLE` — see limitations below)
- **GFMI composite** (Global Financial Meltdown Index): weighted engine average + nonlinear
  multi-shock amplifier + crisis-override rules, not a simple average.
- **Central-bank headline tracking** (Fed, ECB, BOE, RBI press feeds) — dates/titles/links only;
  hawkishness/dovishness NLP scoring is Phase 2.
- **Automated daily pipeline** (`/api/cron/pipeline`), scheduled via `vercel.json` to run once a
  day inside the window you specified: after US market close, before Tokyo market open (21:30 UTC
  by default — always after 4pm ET regardless of DST, with hours of buffer before 00:00 UTC/Tokyo
  open). No code deploy or schema change should ever need to happen outside that window either.
- **Admin dashboard** (`/admin`) — pipeline run log, source registry, manual "run pipeline now" button.
- **Public read API** under `/api/*` (gfmi, yen, liquidity, credit, treasury, equities, india,
  central-bank-guidance, sources, leading-indicators) plus `/api/health` and `/api/metrics` for
  operational monitoring (database reachability, key configuration, pipeline staleness).
- Every number on every page carries a data-freshness badge (LIVE/RECENT/STALE/UNAVAILABLE) and a
  source/tier citation — nothing is silently backfilled or estimated.
- Permanent disclaimer banner + "not a forecast" language throughout, per the source brief's
  language-governance requirements.

## Scope — what's *not* here yet

The full brief specifies **24 risk engines**, ML models backtested to 1929, a central-bank NLP
sentiment engine, a conversational AI research agent (MacroSignal AI), and subscription billing.
Those need data sources or infrastructure this phase doesn't have yet:

- **AI Circular Financing** is the one engine deliberately not built. V3 §18's own instruction is
  "never infer undisclosed relationships as fact", and no free source publishes the
  equity-investment/purchase-commitment/SPV web it asks for — building it would mean guessing at
  exactly the relationship the spec warns against inferring.
- **Market Concentration and Private Credit** are both market-price proxies, not the structural
  weights/AUM/covenant data the spec envisions — no free source publishes either. Market
  Concentration uses the SPY/RSP and QQQ/QQQE cap-weighted-vs-equal-weighted ETF ratios; Private
  Credit uses publicly-traded BDC (Business Development Company) share prices as a leading proxy
  for portfolio credit quality. BDCs are a US-specific structure with no comparably liquid G7
  equivalent, so Private Credit stays intentionally US-anchored.
- **China** now has every V3-spec indicator covered by a real, free source except individual
  developer bond default events: trade + CNY + CPI + 3-month interbank rate + real house *prices*
  (shared BIS series) + Shanghai Composite + the 10Y government bond yield (ChinaBond/CCDC) +
  debt/GDP + property sales volumes (NBS, via english.www.gov.cn) + a BIS credit-to-GDP-gap
  credit-impulse proxy + PMI new orders (NBS) + LGFV-inclusive augmented debt (IMF Article IV staff
  estimate, manually-refreshed annually) + a developer-financing proxy (NBS real estate development
  investment YoY, via the same english.www.gov.cn releases — honestly a proxy for the literal
  "funds in place" financing-source breakdown, which only exists on the blocked stats.gov.cn
  domain). See the methodology page's "China: closing the property/credit/PMI/LGFV/financing gap"
  section for the full sourcing detail and honesty caveats on each. Developer-level *default*
  events specifically remain genuinely unavailable free (no free source tracks those in structured
  form; aggregate default data is otherwise behind paid providers like CEIC/Wind).
- **Supply Chains** was a single global NY Fed GSCPI number (which publishes no country breakdown
  itself) and now also tracks country-level proxies for 6 of 8 G7+China economies: US/Germany/
  France/Italy manufacturing order books and Japan finished-goods stocks (OECD Business Tendency
  Survey, via FRED), Canada's inventory-to-sales ratio (direct from Statistics Canada's API), and
  China's PMI supplier-delivery-time subindex (NBS, via english.www.gov.cn). The UK remains
  genuinely uncovered — its OECD-submitted series were discontinued in 2021 and the CBI's own
  survey site is Cloudflare-protected — see the methodology page's "Supply Chains: from one global
  number to G7+China" section for the full detail.
- **India Market Regime** is a partial implementation: FII/DII flows, PMI new orders, bank credit
  growth and GST collections have no free daily source yet, so the regime read is currently a
  cross-asset shock-sensitivity proxy only. (Banking-system liquidity itself is now covered by the
  separate **India Liquidity** engine/tab — RBI's own daily net-liquidity and WACR data — which is
  not affected by this gap.)
- <a id="ccil-not-used"></a>**CCIL** (the Clearing Corporation of India) publishes the
  industry-standard secondary-market India debt-market data (its Zero Coupon Yield Curve, money
  market/forex/G-Sec turnover) and was evaluated as a source for a fuller India debt-market picture.
  It is deliberately not used: CCIL's own Terms of Use explicitly forbid "systematic or automated
  data collection" (§4.8 — scraping, data mining, data extraction and harvesting, stated outright,
  not just a commercial-use carve-out) and any commercial use of its Content without express written
  consent (§4.1), verified directly against CCIL's published Terms of Use PDF. This project does not
  scrape sources whose own terms forbid it — the same standard already applied to RBI's
  Imperva/TSPD-protected PDF subdomain. The new **India Yield Curve** engine covers the same
  short/medium/long sovereign-curve ground instead, built entirely from RBI's own T-Bill/G-Sec
  primary-auction results plus an OECD/FRED-mirrored 10Y cross-check — see the methodology page's
  "India Yield Curve, and why CCIL is not used" section.
- **Central-Bank Policy composite** is not a standalone engine yet — it needs the hawkish/dovish
  NLP classifier below.
- **Central-bank hawkishness/dovishness NLP scoring**, forward-guidance change detection, and the
  policy-language classifier (V3 §8-10) — headlines are captured, scoring is not.
- **MacroSignal AI** (conversational research agent, appendix V3-A) — deliberately deferred; needs
  its own LLM API key and billing, kept separate from this core data platform.
- **Subscription billing** — the `subscriptions`/`entitlements` tables and a 90-day free trial exist,
  but there's no payment processor wired up yet (Stripe or similar needs to be added before the
  trial period matters commercially).
- **ML backtesting to 1929**, walk-forward validation, HMM/survival models — the `historical_crises`
  and `lead_lag_results` tables exist as the intended home for this, but no model runs against them yet.

None of this is faked with placeholder numbers — engines and indicators that aren't implemented
either don't appear, or (for India) are explicitly listed as `UNAVAILABLE`.

## One-time setup (you must do this — I can't create accounts on your behalf)

### 1. Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → New Project (free tier is enough to start).
2. In **SQL Editor**, paste and run `supabase/migrations/0001_init.sql` from this repo.
3. In **Project Settings → API**, copy: `Project URL`, `anon public` key, `service_role` key.
4. In **Authentication → Providers**, email/password is on by default. Decide whether to require
   email confirmation (Authentication → Settings) — recommended: on.

### 1b. Enable "Continue with Google" (optional but wired up already)
1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create Credentials
   → OAuth client ID → Application type: Web application.
2. Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback` (find your
   project ref in the Supabase URL, or on Project Settings → API).
3. Copy the generated Client ID and Client Secret.
4. In Supabase → **Authentication → Providers → Google**, toggle it on and paste both values.
5. In Supabase → **Authentication → URL Configuration**, add your site's `/auth/callback` URL to
   **Redirect URLs** (e.g. `http://localhost:3000/auth/callback` for local dev, and your production
   domain's equivalent once deployed).

If you skip this, the "Continue with Google" button will show a Supabase error until it's enabled —
email/password sign-in works either way.

### 2. Get a free FRED API key
[fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html) —
instant, no approval wait.

### 3. Deploy to Vercel
1. Push this repo to GitHub.
2. [vercel.com](https://vercel.com) → New Project → import the repo (auto-detects Next.js).
3. In **Project Settings → Environment Variables**, add (copy from `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — never exposed to the browser)
   - `FRED_API_KEY`
   - `CRON_SECRET` — any random string you generate yourself
4. Deploy. `vercel.json` registers the daily cron automatically.
5. **Free (Hobby) plan note:** Vercel Hobby cron jobs run once/day, which is exactly what this
   pipeline needs — no upgrade required for the "continuous, unattended" requirement to hold. If
   you later want intraday refreshes, that needs a Pro plan plus additional cron entries.

### 4. Promote yourself to admin
Sign up for an account on the deployed site, then in Supabase **SQL Editor**:
```sql
update profiles set role = 'admin' where email = 'you@example.com';
```
There is deliberately no self-serve "become admin" button.

### 5. Run the pipeline once manually
Sign in as admin → `/admin` → **Run pipeline now**. This populates the dashboard immediately
instead of waiting for the next scheduled run.

## From here on, this runs itself

- Data ingestion + score recomputation: automatic, daily, inside the mandated maintenance window.
- New user signups, trials, and role checks: automatic via the Supabase trigger in the migration.
- If a data source fails or goes stale, the affected metric shows `STALE`/`UNAVAILABLE` rather than
  silently breaking or faking a value — check `/admin` or `/dashboard/sources` if something looks off.
- The only reasons you'd need to step in: adding a new engine/data source, rotating an API key,
  or wiring up billing.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the same values as step 3 above
npm run dev
```

## AI engines: real SEC EDGAR data, not a mockup

All four AI engines (`src/lib/engines/aiFinancialSustainability.ts`, `aiValuation.ts`,
`aiCreditFinancing.ts`, `aiDebtMaturityWall.ts`) share one data pipeline
(`src/lib/sources/secEdgar.ts` + `src/lib/engines/aiCompanyMetrics.ts`) pulling quarterly XBRL
filings directly from SEC EDGAR's free company-facts API for Microsoft, Alphabet, Amazon, Meta,
Oracle, Nvidia, AMD and Broadcom — no scraping, no paid data provider, no key required (just a
descriptive `User-Agent` per SEC's fair-use policy). Two real correctness problems were found and
fixed by testing against live filings before this shipped, not left as silent bugs:

- **Tag drift.** Companies change which XBRL tag they use for the same concept over time —
  Microsoft stopped tagging `CostOfRevenue` in 2018, and Alphabet's
  `RevenueFromContractWithCustomerExcludingAssessedTax` went stale in 2025 while it kept reporting
  the plain `Revenues` tag for the same figure. A naive "first tag that returns any data" approach
  silently locks onto values years out of date — verified this by diffing extraction results
  against both approaches before choosing "most recent value across all candidate tags." Found the
  same pattern again later, live in production this time (`interest_coverage` showing STALE data
  from mid-2024): Microsoft, Alphabet, Amazon and Nvidia all migrated `InterestExpense` to
  `InterestExpenseNonoperating` starting FY2025 — the recency-based selection logic already handled
  it correctly once that tag was added to the candidate list, no new logic needed.
- **YTD vs. discrete quarters.** Cash-flow-statement items (operating cash flow, capex,
  depreciation) are reported as year-to-date cumulative figures in most companies' 10-Qs, not
  standalone quarters — income-statement items usually are already discrete. Figures are
  de-cumulated by grouping filings that share the same fiscal-year start date and taking
  successive differences, which also recovers the fourth quarter (never separately filed) as
  full-year total minus the nine-month figure. This is a no-op for companies that already report
  discretely, so it's safe to apply uniformly rather than special-casing each company.

Other explicit limitations: EBITDA is a proxy (operating income + D&A from the cash-flow
statement), not each company's own "Adjusted EBITDA" definition (which typically excludes more
items and would show a lower leverage ratio); AI Valuation uses trailing, not forward, P/E since
forward-earnings estimates are analyst-consensus data behind paid terminals; "AI revenue"
specifically is not disclosed as a discrete XBRL fact by any of these companies, so AI Financial
Sustainability uses total company revenue instead; and Nvidia does not tag a debt-maturity
schedule at all, so it shows as `UNAVAILABLE` on the AI Debt Maturity Wall page rather than being
assumed to have no near-term maturities.

## Country coverage: G7 + China

Most engines were originally US-only; they were widened deliberately, not by default:

- **Equity Fragility**: S&P 500, Nasdaq, Russell 2000, Nikkei 225, DAX, FTSE 100, CAC 40, FTSE MIB,
  S&P/TSX Composite, Shanghai Composite — all 8 economies, VIX for the leading vol signal.
- **Property/CRE**: BIS real house-price index computed identically for all 8 economies (US, Canada,
  UK, Germany, France, Italy, Japan, China), plus US mortgage-rate/permits/starts as supplementary
  leading context (no free equivalent exists for other countries).
- **Treasury & Sovereign Debt**: US 2Y/10Y/30Y yields + debt/GDP, plus UK, Germany, France, Italy,
  Japan, Canada and China 10Y yields + debt-to-GDP, the derived Italy-Germany ("BTP-Bund") spread,
  and China's 3-month interbank rate as an additional funding-stress proxy. UK, Germany, Canada,
  Japan and China's 10Y yields come directly from their own central bank/finance-ministry/depository
  (Bank of England, Bundesbank, Bank of Canada, Japan's Ministry of Finance —
  `src/lib/sources/govBondYields.ts`; ChinaBond/CCDC, the PBOC-designated central bond depository —
  `src/lib/sources/chinaBondYield.ts`), daily with only a few days' lag, rather than a FRED/OECD
  monthly proxy. China's yield in particular had been documented `UNAVAILABLE` (no FRED, OECD or BIS
  series covers it at all) until CCDC's own site was checked directly rather than the usual
  multilateral aggregators; Japan's own MOF publishes a free daily JGB curve (1Y-40Y, back to 1974)
  as two CSV files, closing a 2-4-month-stale proxy. Italy and France stay on the FRED/OECD monthly
  proxy (`IRLTLT01xxM156N`): no equally clean free daily source was found for Italy, and France's own
  daily rate (TEC 10) is Euronext-licensed with an explicit no-redistribution clause — the same
  category of restriction already declined for CCIL — so it isn't used. Government debt/GDP ratios
  for every non-US economy here are annual official statistics that genuinely lag 1-2+ years
  (verified each already holds FRED's freshest available observation; IMF's own WEO database, the
  only plausible fresher source, is Akamai-blocked) — see the methodology page's "why a few
  indicators still show STALE" section for the full detail.
- **Credit**: US HY/IG/EM plus Euro-area high-yield and an Asia-Pacific EM corporate spread
  (includes, but isn't exclusive to, China). Also now a G7+China per-country table
  (`src/lib/engines/creditRegime.ts`) on the Credit tab: a dedicated China AAA
  corporate-government spread (ChinaBond, new), Germany/France/Italy sharing the Euro-area HY
  OAS (disclosed as one shared EUR market, not per-nation), and UK/Canada/Japan — which have no
  free GBP/CAD/JPY corporate spread index (checked FRED's full ICE BofA Indices release and the
  Bank of England's own database directly) — instead showing the BIS credit-to-GDP gap
  (`src/lib/sources/bisCreditGap.ts`, the same Basel III countercyclical-buffer series already
  used for China's credit impulse, verified to cover the full G7 too), tagged explicitly as a
  different kind of signal (quantity-side credit-boom gap, not a market-priced spread) rather
  than blended in as if equivalent — see the methodology page for why this was chosen over two
  alternative national sources that were checked and found lacking (a BoE series with no clean
  aggregate code, and a StatCan table that turned out to be household-only credit).
- **Global Liquidity**: Fed, ECB (Germany/France/Italy) and BOJ balance sheets, plus the ECB
  deposit rate, the Chicago Fed NFCI, Bank of England reserve balances (UK), Bank of Canada total
  assets (Canada — both direct from those central banks' own APIs), and China's 3-month interbank
  rate as a rate-side proxy (no free, verified PBOC balance-sheet/reserve-money series was found —
  see the methodology page). Also now tracks each bank's money-market-rate-vs-policy-rate spread
  (SOFR-IORB, SONIA-Bank Rate, €STR-Deposit Facility Rate, CORRA-Target) and Japan's daily
  uncollateralized call rate (BOJ's own new public API), feeding both the composite score and a
  live per-bank **AMPLE/ADEQUATE/NORMAL/TIGHTENING/DEFICIT** table on the Liquidity tab
  (`src/lib/engines/liquidityRegime.ts`) — the actual ample-vs-scarce-reserves framework central
  banks use, not just a balance-sheet-size relabeling. A second table forecasts short/medium/long
  term (~2 weeks/~2 months/~6 months) per bank via real OLS trend extrapolation of that same basis
  series, re-scored against the same baseline — a momentum read, explicitly not a prediction (see
  the methodology page).
- **Supply Chains**: the NY Fed's global GSCPI (which publishes no country breakdown itself) plus
  country-level proxies for US/Germany/France/Italy (OECD order books), Japan (OECD finished-goods
  stocks), Canada (StatCan inventory-to-sales ratio) and China (NBS PMI delivery-time subindex) — the
  UK is the one economy still genuinely uncovered (see the methodology page).
- **China**: exports/imports/CNY/CPI plus the 3-month interbank rate, real house prices, the
  Shanghai Composite, the 10Y yield, debt/GDP, property sales, a credit-impulse proxy, PMI new
  orders, LGFV-inclusive augmented debt, and a developer-financing proxy — every V3-spec indicator
  except individual developer defaults (see the methodology page for sourcing detail on each).
- **India Liquidity** (new, standalone tab): RBI's own daily net-liquidity (LAF) figure and the
  Weighted Average Call Rate, plus USDINR — separate from India Market Regime, which is a
  bullish/bearish equity-direction call on a different scale, not a liquidity read. Also surfaces a
  real, computed check of India's documented pre-Diwali/fiscal-year-end seasonal liquidity pattern
  against this project's own backfilled RBI history (`src/lib/engines/indiaSeasonality.ts`).
- **India Yield Curve** (new, standalone tab): short (91D/364D T-Bill), medium (~5Y G-Sec) and long
  (10Y G-Sec + an OECD/FRED cross-check) sovereign yields, all from RBI's own primary-auction
  results, plus three derived spreads reading front-end vs. back-end steepness and 1Y-10Y inversion
  risk — built after ruling out CCIL as a source (see [CCIL](#ccil-not-used) above).
- **Banking**: adds ECB/UK policy rates as European funding-cost context — no free source publishes
  bank-level NPL/delinquency data outside the US for any G7 country.
- One engine stays intentionally single-country regardless of data availability: **Yen Carry Stress**
  (a JPY-specific carry-trade mechanic).
- **Private Credit** stays US-anchored: BDCs (Business Development Companies) are a US-specific
  regulatory structure with no comparably liquid, quotable G7 equivalent.

## Architecture notes

- **Why a single `metric_series` table instead of 20+ per-domain tables**: same spec, but Supabase
  doesn't offer TimescaleDB, so one indexed `(metric_key, observed_at)` table scales better than
  rigid per-domain tables that would need schema migrations every time an engine is added.
- **Why z-scores drive engine scores**: every score is a deterministic function of stored data
  (`src/lib/metrics/stats.ts`) — no LLM ever computes a number that ends up on a dashboard.
- **Why short/medium/long horizons actually differ** (`src/lib/engines/horizon.ts`): the z-score
  window and each indicator's classification weight both change by horizon — short-term uses a
  ~63-observation window and up-weights leading/coincident signals (IMF GFSR/Fed FSR-style
  near-term, market-price-driven read), long-term uses a ~756-observation window and up-weights
  lagging/structural signals (BIS financial-cycle-style, multi-year leverage/debt buildup read).
  Confidence is separate from data completeness: completeness is a plain fraction of the indicator
  set with usable data (honestly 100% when everything is populated); confidence additionally
  discounts for indicator freshness and is then multiplied by a per-horizon factor (0.95/0.88/0.75
  for short/medium/long, applied at every data-quality level, not just near-perfect data) so it can
  never reach 100% and is always lowest for the longest horizon — uncertainty compounds with horizon.
- **STALE badges on international/annual data are usually not a bug** (`src/lib/quality/freshness.ts`,
  `src/lib/metrics/lookback.ts`): verified directly against FRED's and SEC EDGAR's own series
  metadata that our stored values already match the freshest observation the source has ever
  published — G7 debt/GDP ratios (`GGGDTA*A188N` on FRED) and AI-engine debt-maturity schedules are
  genuinely annual (10-K-only, or IMF-compiled with a real multi-month-to-multi-year lag), so they
  were relabeled from "quarterly" to a proper "annual" frequency with its own, more permissive
  LIVE/RECENT/STALE thresholds (400/730 days) — this doesn't change the (correctly stale) verdict
  for data that's genuinely years old, but it did flip several AI-engine debt-maturity figures from
  a false STALE to correctly LIVE, since a schedule filed 8 months ago is completely current for
  something that only updates once a year.
- **Source tiers**: 1 = official primary (FRED, CFTC, central-bank feeds, ECB via Frankfurter, NY
  Fed GSCPI, AWS/Azure/GCP status pages), 2 = multilateral institutions or transparent academic
  indices (the Caldara-Iacoviello Geopolitical Risk Index), 3 = licensed/unofficial aggregators
  (Yahoo Finance chart API, CoinGecko — used only where no Tier-1 source exists). Stooq was
  evaluated and rejected: it now fronts a JavaScript proof-of-work bot challenge a server-side fetch
  can't solve. investing.com was also evaluated (for crypto) and rejected: it has no free public
  API, and scraping it would break the no-scraping/official-source-only rule every connector in
  this project follows — BTC/ETH spot price uses Yahoo's chart endpoint instead (real multi-year
  daily history, vs. CoinGecko's free tier which is a live snapshot only).
- **NY Fed GSCPI and the GPR index only publish legacy binary `.xls` workbooks** (confirmed via
  byte-signature check, not just the URL's extension) — `src/lib/sources/xlsWorkbook.ts` wraps the
  `xlsx` package rather than assuming a clean CSV exists.
- **Cyber/Infrastructure engine** counts status-page item volume per provider over a trailing 7
  days rather than inventing a severity score from free text — see `src/lib/sources/cloudStatus.ts`.
  On first run it backfills this from whatever dated items the provider's feed already holds
  (real historical reconstruction, not an estimate), instead of waiting ~20 days of natural daily
  accumulation to clear the z-score floor; a provider whose feed currently has too little history
  (e.g. Azure, when its feed is empty) falls back to accumulating day by day rather than assuming
  a "0" window it has no evidence for.
- Full engine/indicator list, GFMI formula, and data-quality rules: see `/dashboard/methodology` on
  the running site, or `src/lib/engines/`.
