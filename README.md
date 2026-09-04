# Global Meltdown Index

A leading-indicator systemic-risk terminal (globalmeltdownindex.net), built against the V3
specification in this repo's originating brief. This is **Phase 1** of a large build — see
[Scope](#scope--whats-not-here-yet) before assuming full spec coverage.

Core question the platform answers: *what is changing now that could matter later?*

## What's built

- **Next.js 16 / TypeScript / Tailwind v4** app, deployable to Vercel.
- **Supabase** for Postgres (data + auth). Email/password sign-up with a 90-day free trial
  auto-granted on signup; role-based access (`user` / `admin`) enforced server-side in `src/proxy.ts`.
- **Five risk engines**, fed entirely by free/official data, each producing short/medium/long-term
  scores with leading/coincident/lagging indicator breakdowns, triggers, transmission mechanism,
  confirmation/invalidation conditions, and a "what has not yet happened" section:
  - Global Dollar Liquidity
  - Credit Markets
  - Equity Fragility
  - US Treasury / Sovereign
  - Yen Carry Stress
  - Plus a **partial** India Market Regime (global-shock-sensitivity proxy — see limitations below)
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

- **19 more risk engines** (AI Financial Sustainability, AI Valuation/Credit, Private Credit,
  Global Sovereign Debt, Banking, Property/CRE, China, Energy, Geopolitical, Market Concentration,
  Derivatives/Leverage, Crypto/Stablecoins, Cyber, Central-Bank Policy composite, Trade/Economic
  Policy, Supply Chains, AI Circular Financing, AI Debt Maturity Wall) — need company-filings data,
  CRE data, China macro data, or paid feeds not yet wired in.
- **India Market Regime** is a partial implementation: FII/DII flows, PMI new orders, bank credit
  growth and GST collections have no free daily source yet, so the regime read is currently a
  cross-asset shock-sensitivity proxy only.
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

## Architecture notes

- **Why a single `metric_series` table instead of 20+ per-domain tables**: same spec, but Supabase
  doesn't offer TimescaleDB, so one indexed `(metric_key, observed_at)` table scales better than
  rigid per-domain tables that would need schema migrations every time an engine is added.
- **Why z-scores drive engine scores**: every score is a deterministic function of stored data
  (`src/lib/metrics/stats.ts`) — no LLM ever computes a number that ends up on a dashboard.
- **Source tiers**: 1 = official primary (FRED, CFTC, central-bank feeds, ECB via Frankfurter),
  2 = multilateral institutions, 3 = licensed/unofficial aggregators (Yahoo Finance chart API, used
  only where no Tier-1 source exists — Russell 2000, Nifty 50). Stooq was evaluated and rejected: it
  now fronts a JavaScript proof-of-work bot challenge that a server-side fetch can't solve.
- Full engine/indicator list, GFMI formula, and data-quality rules: see `/dashboard/methodology` on
  the running site, or `src/lib/engines/`.
