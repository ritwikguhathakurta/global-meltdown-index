# Global Meltdown Index

![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase)
![Live](https://img.shields.io/badge/live-globalmeltdownindex.net-brightgreen)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)

**A systemic-risk terminal that turns free, official macro-financial data into one transparent
composite score** — 24 independent risk engines across the G7 and China, each one computed
deterministically from data you can trace back to its own source, with every stale or missing
number labeled as such instead of guessed at.

Core question the platform answers: *what is changing now that could matter later?*

## See it live

The full dashboard — all 24 engines, trend charts, source citations — is at
**[globalmeltdownindex.net/dashboard](https://globalmeltdownindex.net/dashboard)** behind a free
account (takes under a minute; see [Quick start](#quick-start)). You don't need one to see real
output right now, though — the underlying API is public, and this is a real, live response, not a
mockup:

```bash
curl https://globalmeltdownindex.net/api/gfmi
```

```jsonc
// trimmed to 2 of 24 components for readability — the real response includes all of them
{
  "data": {
    "current": {
      "as_of": "2026-10-22",
      "score": 72,
      "regime": "CRISIS_DEVELOPING",
      "confidence": 0.9,
      "components": {
        "credit": { "score": 70, "weight": 1, "contribution": 4.24 },
        "us_treasury_sovereign": { "score": 59, "weight": 1.2, "contribution": 4.29 }
      }
    }
  },
  "disclaimer": "CURRENT MACRO/MARKET ASSESSMENT — NOT A GUARANTEED FORECAST OR INVESTMENT RECOMMENDATION."
}
```

Or run a scripted walkthrough across five endpoints (health, composite score, one engine in detail,
every leading indicator, the source registry) with `npm run demo` — see
[`docs/API_EXAMPLES.md`](docs/API_EXAMPLES.md) for the full set of verified, live-captured responses.

## What the GFMI score means

The number above is the **Global Financial Meltdown Index**: a 0-100 weighted average of all 24
engine scores, lifted by a nonlinear amplifier when several independent engines are elevated at
once (correlated stress across independent risk dimensions is empirically more dangerous than any
one elevated reading). It maps to one of seven named stages, taken directly from the scoring code
(`src/lib/engines/gfmi.ts`) rather than paraphrased:

| Score | Stage | What it means |
|---|---|---|
| 0–14 | 1 · Low Systemic Risk | Tracked engines broadly calm; no amplification applied. |
| 15–29 | 2 · Watch | Some deterioration showing up, not yet broad-based. |
| 30–44 | 3 · Vulnerability Building | Structural vulnerabilities building across more than one engine. |
| 45–59 | 4 · High Systemic Risk | Multiple independent engines elevated together; the amplifier typically starts to engage. |
| 60–74 | 5 · Crisis Developing | Broad, correlated deterioration; the amplifier is meaningfully lifting the composite. |
| 75–89 | 6 · Major Deleveraging | Severe, correlated stress consistent with a broad deleveraging episode. |
| 90–100 | 7 · Systemic Crisis | The top of the observed range — a score band, not a declared historical crisis. |

`confidence` (separately from the score) reflects data completeness and freshness, not certainty
about the future — and that distinction matters: **this is a current risk signal, not a forecast.**
Every page carries the same disclaimer as the API response above (`"NOT A GUARANTEED FORECAST OR
INVESTMENT RECOMMENDATION"`), because a weighted average of real, present-day data describes
*conditions right now*, not what happens next.

## Inspect a real signal, source to score

Pick any one driver and you can trace it all the way back yourself. Take `credit.hy_oas` — the US
High-Yield OAS feeding the Credit engine. Its source is a single, named, public series:

```bash
# FRED's own public CSV endpoint for the series — no API key needed to check this yourself
curl "https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2" | tail -n 1
# 2026-10-20,3.33   <- ICE BofA US High-Yield Index Option-Adjusted Spread, 3.33%
```

Inside this app, that same FRED series (`BAMLH0A0HYM2`) is registered as `credit.hy_oas`
(`src/lib/sources/fred.ts`) and feeds the Credit engine's short-horizon z-score as one of its
disclosed top drivers (see the live example in [`docs/API_EXAMPLES.md`](docs/API_EXAMPLES.md)), and
from there contributes into the GFMI composite above with its own disclosed weight and
contribution — every step traceable, nothing interpolated in between. Every one of the ~76
registered sources behind this app can be traced the same way: curl the source directly, then curl
this app's API and watch the same number arrive with a citation, not just a value.

## Contributing

This is a solo-maintained project in active daily development. If you want to add a free/official
data source, fix a bug, or improve test coverage, start with
[`CONTRIBUTING.md`](CONTRIBUTING.md) — it has the actual review bar (there's no CI yet, so you run
the checks yourself), the licensing rule this project already enforces on every data source (free
and official, verified against the source's own terms, or it doesn't go in), and the PR/issue
templates to use.

---

## Why this exists, and what's different about it

Most "market risk" dashboards are either a single country's indicators, a paid terminal, or a
black-box score with no visible methodology. This project is an attempt at the opposite on all
three counts:

- **G7 + China coverage**, not US-only — most engines were built US-only first and then
  deliberately widened; see [Country coverage](#country-coverage-g7--china).
- **Every data point is free and official** — central banks, FRED, SEC EDGAR, IMF, World Bank, and
  similar sources only. No scraping of sites whose own terms forbid it (CCIL, ACLED, and others
  were evaluated and explicitly declined on exactly that basis, not silently skipped).
- **Nothing is backfilled or estimated to fill a gap.** When a free source genuinely doesn't exist
  for something, the page says `UNAVAILABLE` instead of guessing — see
  [Inspect a real signal](#inspect-a-real-signal-source-to-score) above for what a traced value
  looks like when the data does exist.
- **Every number carries a data-freshness badge** (LIVE/RECENT/STALE/UNAVAILABLE) and a cited
  source/tier, computed against that source's own real publication cadence — an annual debt/GDP
  ratio showing `STALE` by daily-data standards is usually correct, not a bug.
- **24 engines feed one composite** (the GFMI score above) via a weighted average plus a nonlinear
  multi-shock amplifier and crisis-override rules — not a simple average, and not an opaque single
  number either: every component and its weight is in the API response itself.

### Contents

- [What's built](#whats-built)
- [Quick start (local dev)](#quick-start)
- [Full one-time setup](#one-time-setup-you-must-do-this--i-cant-create-accounts-on-your-behalf) (your own Supabase project, live data, admin access)
- [AI engines: real SEC EDGAR data](#ai-engines-real-sec-edgar-data-not-a-mockup)
- [Country coverage: G7 + China](#country-coverage-g7--china)
- [Architecture notes](#architecture-notes)
- [License](#license)
- [Full architecture diagram](docs/ARCHITECTURE.md) · [verified API examples](docs/API_EXAMPLES.md) · [contributing](CONTRIBUTING.md)

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
  - Market Concentration and Private Credit (both real, publicly-traded market-price proxies — SPY/RSP
    and QQQ/QQQE ETF ratios, and BDC share prices, respectively)
  - AI Financial Sustainability, AI Valuation, AI Credit/Financing, AI Debt Maturity Wall — built on
    real SEC EDGAR XBRL filings for 8 large-cap AI-capex-relevant companies (see
    [AI engines](#ai-engines-real-sec-edgar-data-not-a-mockup) below)
  - **India Liquidity** (new, standalone — RBI's own daily net-liquidity and overnight-rate data),
    separate from India Market Regime (a bullish/bearish equity-direction call on a different scale)
  - **India Yield Curve** (new, standalone — India's short/medium/long sovereign curve and inversion
    risk, built from RBI's own T-Bill/G-Sec primary-auction results, since CCIL's Terms of Use
    explicitly forbid automated collection of its secondary-market curve — verified directly against
    CCIL's own published terms)
  - Plus China and India Market Regime engines, covering every indicator a real free source exists
    for; either page labels a specific missing indicator `UNAVAILABLE` rather than guessing
- **GFMI composite** (Global Financial Meltdown Index): weighted engine average + nonlinear
  multi-shock amplifier + crisis-override rules, not a simple average.
- **Central-bank headline tracking** (Fed, ECB, BOE, RBI press feeds) — dates, titles, and links,
  captured automatically.
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
- The only reasons you'd need to step in: adding a new engine/data source, or rotating an API key.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in at minimum the 5 "Core" values — see below
npm run dev                  # http://localhost:3000
```

`.env.example` is grouped into two parts:

- **Core** (5 variables) — Supabase credentials, a free [FRED API key](https://fred.stlouisfed.org/docs/api/api_key.html),
  and `CRON_SECRET`. You need these to sign up, log in, and run the pipeline at all; see
  [Full one-time setup](#one-time-setup-you-must-do-this--i-cant-create-accounts-on-your-behalf)
  for the five-minute walkthrough (create a Supabase project, run one migration, get the FRED key).
- **Optional** (everything else) — each one unlocks a specific engine or connector (an LLM key for
  the "Ask Derivatives"/"Ask Geopolitics" panels, a UCDP token for the Conflict tab, and so on).
  The app and the daily pipeline run correctly with none of these set; the affected metrics just
  show `UNAVAILABLE` instead of a value. `.env.example` documents what each one unlocks.

Verified locally before writing this section: `npm install` → `npm run dev` starts a real server
(`✓ Ready in ~1s`) that serves `/login` with a genuine 200. The other commands you'll want during
development, all passing as of this commit:

```bash
npm run build              # production build
npm run lint                 # eslint
npx tsc --noEmit -p .       # typecheck (no separate npm script for this)
npm run test:carry          # 25 passing
npm run test:derivatives    # 13 passing
npm run test:geopolitical   # 11 passing
npm run demo                # hits the live public API and prints real data, no signup
```

Want to contribute? See [`CONTRIBUTING.md`](CONTRIBUTING.md) — there's no CI yet, so the commands
above are the actual review bar, not a formality.

There's no Jest/Vitest here by design — these three suites are dependency-free `tsx` scripts
testing the pure, server-import-free calculation layers (`src/lib/carry/`, `src/lib/derivatives/`,
`src/lib/geopolitical/`). The 24 registered engines and other connectors don't have automated
tests yet; see [`docs/growth/BASELINE_AUDIT.md`](docs/growth/BASELINE_AUDIT.md) for the honest
state of test coverage if you're considering contributing here.

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
  (verified each already holds FRED's freshest available observation). A prior pass concluded IMF's
  own WEO database — the only plausible fresher source — was Akamai-blocked; re-checked live and
  found that conclusion stale: WEO's SDMX API (`api.imf.org`, already relied on elsewhere for other
  indicators — see `imfFiscalGaps.ts`/`g7Fiscal.ts`) serves Germany/Italy/Japan/UK/China/Canada's
  debt/GDP with no block at all, and now feeds a genuinely fresher `sovereign.*_debt_to_gdp_imf_weo`
  reading for each (`imfWeoDebtFreshness.ts`). It's kept as a separate series rather than appended to
  the primary FRED-sourced one — the two disagree by 1-2+ points of GDP on the same year (different
  debt-coverage conventions), and splicing IMF's newer years onto FRED's series would read as a real
  jump that never happened — see the methodology page's "why a few indicators still show STALE"
  section for the full detail.
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
  stocks), Canada (StatCan inventory-to-sales ratio) and China (NBS PMI delivery-time subindex).
- **China**: exports/imports/CNY/CPI plus the 3-month interbank rate, real house prices, the
  Shanghai Composite, the 10Y yield, debt/GDP, property sales, a credit-impulse proxy, PMI new
  orders, LGFV-inclusive augmented debt, and a developer-financing proxy — every V3-spec indicator
  except individual developer defaults (see the methodology page for sourcing detail on each).
- **Emerging-Market Debt**: rebuilt as a structural + market + contagion engine against a detailed
  institutional spec whose core objection was correct — FX alone isn't a debt-stress proxy.
  Structural vulnerability now comes from the World Bank Open Data API (debt/GDP, external
  debt/GNI, external debt service/exports, short-term external debt/reserves, reserve adequacy,
  current account/GDP, GDP growth, fiscal balance/GDP), cross-sectionally z-scored against the
  14-country EM peer set (annual data, so peer comparison rather than a time-series z-score, which
  an annual series never has enough points for). Sovereign CDS comes from Damodaran/NYU Stern's
  free annual snapshot where a market actually quotes one (no free live CDS feed exists —
  ICE/Markit-licensed) — disclosed as a point-in-time snapshot, not a daily feed, so no "CDS
  acceleration" signal is claimed. FX stays as the market/time-series side (all 14 MSCI Emerging
  Markets constituents the ECB publishes a daily reference rate for — Brazil, Mexico, South Africa,
  Turkey, India, Indonesia, China, the Philippines, Poland, Hungary, the Czech Republic, Thailand,
  Malaysia, South Korea), now blended with the CDS reading. A contagion-breadth measure (fraction
  of tracked EMs at Funding-Stress-or-worse), genuinely computed latent-risk / market-led-warning
  flags, and a 7-stage crisis-staging model (the spec's own Stage 1 "Stable" -> Stage 7 "Acute
  Crisis" framework, built as a finer split of the same 0-100 score rather than an invented
  detector — Stage 7 is disclosed as a score band, not a confirmed default, since no free source
  can observe an actual default event) round out the model. A follow-up institutional spec
  ("Emerging Debt Engine") supplied a documented free-source hierarchy (IMF SDMX API, BIS
  bulk/API, World Bank QEDS) and asked that previously-declined components be re-checked against
  it — that pass added two more real structural indicators: **corporate FX debt/GDP** (BIS
  International Debt Securities — non-financial-corporate foreign-currency bonds outstanding,
  verified live for all 14 countries) and **year-over-year foreign-holdings change** (IMF Portfolio
  Investment Positions, formerly CPIS — summed across 64-75 voluntary reporting economies per
  country; using the YoY delta rather than the raw level makes this robust to the persistently
  incomplete reporter set that caused the original "no free source" call on foreign ownership to
  be too hasty). See `src/lib/engines/emDebtRegime.ts` and the methodology page for the full
  per-component breakdown.
- **India Liquidity** (new, standalone tab): RBI's own daily net-liquidity (LAF) figure and the
  Weighted Average Call Rate, plus USDINR — separate from India Market Regime, which is a
  bullish/bearish equity-direction call on a different scale, not a liquidity read. Also surfaces a
  real, computed check of India's documented pre-Diwali/fiscal-year-end seasonal liquidity pattern
  against this project's own backfilled RBI history (`src/lib/engines/indiaSeasonality.ts`).
- **India Yield Curve** (new, standalone tab): short (91D/364D T-Bill), medium (~5Y G-Sec) and long
  (10Y G-Sec + an OECD/FRED cross-check) sovereign yields, all from RBI's own primary-auction
  results, plus three derived spreads reading front-end vs. back-end steepness and 1Y-10Y inversion
  risk — built on RBI's own primary-auction data after CCIL's Terms of Use (verified directly
  against its published terms) ruled out an automated feed of its secondary-market curve.
- **Banking**: adds ECB/UK policy rates as European funding-cost context — no free source publishes
  bank-level NPL/delinquency data outside the US for any G7 country.
- One engine stays intentionally single-country regardless of data availability: **Yen Carry Stress**
  (a JPY-specific carry-trade mechanic).
- **Private Credit** stays US-anchored: BDCs (Business Development Companies) are a US-specific
  regulatory structure with no comparably liquid, quotable G7 equivalent.

## Architecture notes

For the full data-flow diagram (sources → pipeline → `metric_series` → engines → API/dashboard), see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The notes below are the "why," not the "what."

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

## License

[Apache License 2.0](LICENSE). Note that this covers the code, not the underlying data — every
source this project reads from (FRED, central banks, SEC EDGAR, World Bank, IMF, and the rest) has
its own terms, which is exactly why some real, technically-reachable sources were declined outright
(see [`docs/SCOPE.md`](docs/SCOPE.md)) rather than used anyway.
