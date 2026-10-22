# Scope — known gaps and what's not built yet

This is the complete, honest gap list — kept out of the README's newcomer-facing flow on purpose
(a first-time visitor should see what works before reading a list of what doesn't), but linked from
`CLAUDE.md` and `CONTRIBUTING.md` for anyone evaluating the project in depth or looking for
somewhere real to contribute. Nothing here is faked in the other direction either: every gap below
either shows as `UNAVAILABLE` in the product itself, or simply doesn't appear — there's no
placeholder number standing in for any of it.

The full originating brief specifies **24 risk engines**, ML models backtested to 1929, a
central-bank NLP sentiment engine, a conversational AI research agent (MacroSignal AI), and
subscription billing. The items below need data sources or infrastructure this phase doesn't have:

## Engines and features not built

- **AI Circular Financing** is the one engine deliberately not built. The brief's own instruction is
  "never infer undisclosed relationships as fact", and no free source publishes the
  equity-investment/purchase-commitment/SPV web it asks for — building it would mean guessing at
  exactly the relationship the brief warns against inferring.
- **Central-Bank Policy composite** is not a standalone engine yet — it needs the hawkish/dovish NLP
  classifier below. **Central-bank hawkishness/dovishness NLP scoring**, forward-guidance change
  detection, and the policy-language classifier — headlines are captured (Fed/ECB/BOE/RBI press
  feeds, dates/titles/links), scoring is not.
- **MacroSignal AI** (conversational research agent) — deliberately deferred; needs its own LLM API
  key and billing, kept separate from this core data platform.
- **Subscription billing** — the `subscriptions`/`entitlements` tables and a 90-day free trial exist,
  but there's no payment processor wired up yet (Stripe or similar needs to be added before the
  trial period matters commercially).
- **ML backtesting to 1929**, walk-forward validation, HMM/survival models — the `historical_crises`
  and `lead_lag_results` tables exist as the intended home for this, but no model runs against them
  yet.

## Partial coverage within engines that are built

- **Market Concentration and Private Credit** are both market-price proxies, not the structural
  weights/AUM/covenant data a full build would use — no free source publishes either. Market
  Concentration uses the SPY/RSP and QQQ/QQQE cap-weighted-vs-equal-weighted ETF ratios; Private
  Credit uses publicly-traded BDC (Business Development Company) share prices as a leading proxy
  for portfolio credit quality. BDCs are a US-specific structure with no comparably liquid G7
  equivalent, so Private Credit stays intentionally US-anchored.
- **China** has every spec'd indicator covered by a real, free source except individual developer
  bond default events — no free source tracks those in structured form; aggregate default data is
  otherwise behind paid providers like CEIC/Wind.
- **Supply Chains** tracks country-level proxies for 6 of 8 G7+China economies. The UK remains
  genuinely uncovered — its OECD-submitted series were discontinued in 2021 and the CBI's own
  survey site is Cloudflare-protected.
- **India Market Regime** is a partial implementation: FII/DII flows, PMI new orders, bank credit
  growth and GST collections have no free daily source, so the regime read is currently a
  cross-asset shock-sensitivity proxy only. (Banking-system liquidity itself is covered separately
  by **India Liquidity** — RBI's own daily net-liquidity and WACR data — which isn't affected by
  this gap.)
- **Emerging-Market Debt** doesn't yet have: full capital-flow reconstruction (EPFR/IIF are paid), a
  true domestic sovereign-bank nexus (checked via IMF FSI live — no populated series for any tracked
  country), auction-level stress (would need ~14 national debt-office integrations), backtesting, a
  world map, an AI chat agent, or the broader Python/DuckDB data-lake rearchitecture a follow-up
  spec envisioned.

## Sources evaluated and declined on licensing grounds, not technical difficulty

These aren't gaps waiting on a data source — a usable one exists in every case below. They're not
used because their own terms forbid the automated access this project would need, and the project's
rule is to honor that rather than route around it with a scraper or a stealth browser:

- **CCIL** (the Clearing Corporation of India) publishes India's industry-standard secondary-market
  debt data (Zero Coupon Yield Curve, money market/forex/G-Sec turnover). Its Terms of Use explicitly
  forbid "systematic or automated data collection" (§4.8 — scraping, data mining, data extraction and
  harvesting, stated outright) and any commercial use of its content without express written consent
  (§4.1), verified directly against CCIL's published Terms of Use PDF. The **India Yield Curve**
  engine covers the same ground instead, built entirely from RBI's own T-Bill/G-Sec primary-auction
  results plus an OECD/FRED-mirrored 10Y cross-check.
- **ACLED** (political violence/protest event data) — its EULA bans scraping/crawling outright
  (§3.3) and requires a paid corporate license for any commercial use (§1.2); the free tier is
  non-commercial-individual only and still requires registration. This holds regardless of which
  part of the data is nominally "free."
- **OpenSanctions'** broader multi-country sanctions CSV requires a paid commercial license for a
  product like this one — its own site separates non-commercial use from commercial data licensing.
  US Treasury OFAC's own SDN list is used instead (unambiguously free, Tier 1, official).
- **Stooq** now fronts a JavaScript proof-of-work bot challenge a server-side fetch can't solve.
- **investing.com** has no free public API; scraping it would break the no-scraping rule every
  connector here follows. Yahoo Finance's chart endpoint is used instead for crypto spot prices.
- **France's TEC 10** daily sovereign yield is Euronext-licensed with an explicit no-redistribution
  clause — the FRED/OECD monthly proxy is used instead.
- **SGX** and **Saudi Tadawul** were checked for derivatives leading-indicator data and found
  bot-protected rather than offering a usable free API.

None of this is faked with a placeholder number in either direction: engines and indicators that
aren't implemented simply don't appear, and ones that are partially implemented show `UNAVAILABLE`
for the specific sub-indicator that's missing rather than a guess.
