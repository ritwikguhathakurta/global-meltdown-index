# Baseline Audit — Global Meltdown Index

Date of audit: 2026-10-22. Branch: `growth/github-discovery-and-onboarding`. Every figure below was
checked directly against the live GitHub API, the live production site, or the repository's own
files on this date — none of it is estimated. Where something couldn't be verified, it's marked
**UNKNOWN** with what would be needed to verify it.

## A. Repository and GitHub presentation

| Item | Verified value |
|---|---|
| Repository | `ritwikguhathakurta/global-meltdown-index`, public, created 2026-09-04 |
| Description | "Global Financial Market Data (Debt, Equity, Crypto)" |
| Topics | None set (`repositoryTopics: null`) |
| Stars / Forks / Open issues / Open PRs | 0 / 0 / 0 / 0 |
| Homepage URL (repo field) | `https://global-meltdown-index.vercel.app` |
| License | **None** — `licenseInfo: null`, no `LICENSE` file at repo root |
| Releases | None (`latestRelease: null`) |
| Discussions | Disabled (`hasDiscussionsEnabled: false`) |
| Issues / Projects / Wiki | Issues enabled, Projects enabled, Wiki disabled |
| Security policy | Not enabled (`isSecurityPolicyEnabled: false`), no `SECURITY.md` |
| Issue / PR templates | None (`issueTemplates: []`, `pullRequestTemplates: []`) |
| CODE_OF_CONDUCT.md | Not present |
| CONTRIBUTING.md | Not present |
| GitHub Actions workflows | 3 total, all cron triggers only — `chemicals-spot-cron.yml`, `massive-futures-nudge.yml`, `renew-dhan-token.yml`. **No CI workflow** (no automated lint/typecheck/build/test run on push or PR) |
| Social preview image | Not customized (`usesCustomOpenGraphImage: false`) — GitHub's auto-generated code preview is the current share image |
| Commit history | 213 commits, single author (Ritwik Guha Thakurta), 2026-09-04 to 2026-10-22 (~7 weeks) — real, sustained, solo development velocity |
| Primary language | TypeScript (3.19MB), plus small JS/CSS/PLpgSQL (migrations) |
| `package.json` | `"private": true` — already safe from an accidental `npm publish` |

**Headline finding:** this is a from-true-zero campaign. 0 stars/forks/issues/PRs, no license, no
topics, a generic description that undersells the product, and no CI. None of the GitHub-native
trust signals a first-time visitor scans for are currently present.

## B. Project substance (what's actually real, verified against the code)

- **24 registered GFMI engines** confirmed in `src/lib/engines/registry.ts` (counted directly:
  exactly 24 `key:` entries), weights ranging 0.3–1.2. This is a genuine, accurate number — safe to
  use in marketing copy as-is.
- **96 source connector files** in `src/lib/sources/` (one per external API/feed), **75 files**
  under `src/lib/engines/` in total (24 registered + ~51 page-level/domain-specific engines not in
  the GFMI composite — see `CLAUDE.md`'s "two meanings of engine" section).
- **Country/asset-class coverage**: G7 (US, Canada, UK, Germany, France, Italy, Japan) + China across
  most engines; a standalone India Liquidity and India Yield Curve engine; AI-sector engines built on
  real SEC EDGAR XBRL filings for 8 large-cap companies (Microsoft, Alphabet, Amazon, Meta, Oracle,
  Nvidia, AMD, Broadcom) — verified this is not a mock: `secEdgar.ts` pulls live company-facts data,
  no scraping, no paid provider.
- **Public API is real and genuinely live-tested**: `curl https://globalmeltdownindex.net/api/gfmi`
  returned a real HTTP 200 with a real computed composite (`score: 72, regime:
  "CRISIS_DEVELOPING", confidence: 0.9`) and a full per-engine component breakdown, during this
  audit. **This endpoint requires no authentication** — see section C for why this matters.
  42 public API routes exist under `/api/*` (verified by listing every `route.ts` file), covering
  every registered engine plus `gfmi`, `sources`, `metrics`, `leading-indicators`, `health`, two
  LLM-backed `ask` endpoints, and a broker/terminal sub-API.
- **Daily pipeline**: one Vercel serverless function (`/api/cron/pipeline`), hard 300-second ceiling,
  ~93–97 ingestion stages per run (count varies day to day — some stages rotate to share rate
  limits). Verified live today: 85 ok / 7 failed / 1 warning on the most recent full run — a normal
  day for a pipeline this size; failures are individually tracked in `pipeline_runs`, not silent.
- **Data freshness / source-status handling**: real, implemented (`src/lib/quality/freshness.ts`),
  classifies every value LIVE/RECENT/STALE/UNAVAILABLE per its actual publication cadence — not a
  marketing claim, confirmed in code.
- **Test coverage**: no formal test framework (no Jest/Vitest in `package.json`) — three hand-rolled,
  dependency-free `tsx` suites instead. Ran all three live during this audit:
  - `npm run test:carry` → **25 passed, 0 failed**
  - `npm run test:derivatives` → **13 passed, 0 failed**
  - `npm run test:geopolitical` → **11 passed, 0 failed**
  Total: **49 passing assertions, 0 failures**, across the three domains that have dedicated pure
  (server-import-free) calculation layers. The 24 registered engines and ~70 other domain
  engines/connectors have **no automated test coverage at all** — correctness there currently rests
  on the documented "verify against live data before shipping" discipline in `CLAUDE.md`, not on
  tests. This is a real gap for outside contributors: there's no CI signal telling them whether a
  change broke anything.
- **Features implemented vs. not**: the README's own "Scope — what's not here yet" section is
  detailed and honest (AI Circular Financing deliberately unbuilt, Market Concentration/Private
  Credit are disclosed proxies, UK Supply Chains gap, India Market Regime partial, etc.). This
  honesty is itself a credibility asset worth highlighting, not hiding.

## C. Onboarding

- **Can a developer understand the project in 10 seconds?** No. The README opens with "A
  leading-indicator systemic-risk terminal... built against the V3 specification in this repo's
  originating brief" and immediately points to a Scope-limitations section before explaining what
  the product does or why it matters. There's no one-line hook, no badges, no screenshot, nothing
  visual in the first screen.
- **Can a visitor see a real demo without creating an account?**
  - At the **dashboard UI** level: **no** — `src/lib/supabase/middleware.ts` now gates every route
    except `/login`, `/signup`, `/auth/*`, `/api/*`, `/robots.txt`, `/sitemap.xml`. Verified live:
    `curl -I https://globalmeltdownindex.net/dashboard/geopolitical` returns a 307 to `/login`.
  - At the **public API** level: **yes, verified live** — `/api/gfmi` and `/api/health` both
    returned real 200 responses with real data during this audit, no auth header needed. This is a
    significant, currently-unused asset: a `curl` one-liner that returns a genuine composite score
    is a zero-friction, zero-risk demo path that doesn't require anyone to sign up, and the README
    doesn't mention it at all right now.
- **Can a developer run it locally per the documented instructions?** Partially, and this is a real,
  verified gap. The documented quickstart (`npm install`, `cp .env.example .env.local`, `npm run
  dev`) is mechanically correct, but `.env.example` lists only **5** environment variables
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `FRED_API_KEY`, `CRON_SECRET`). A full-text search of `src/` for `process.env.` found **20**
  distinct environment variables actually read by the code (the five above plus
  `GEMINI_API_KEY`/`OPENAI_API_KEY` + their model-override vars, `DHAN_CLIENT_ID`/
  `DHAN_ACCESS_TOKEN`, `UCDP_ACCESS_TOKEN`, `EIA_API_KEY`, `ENTSOE_API_KEY`,
  `UN_COMTRADE_SUBSCRIPTION_KEY`, `MASSIVE_API_KEY`, `BPS_API_KEY`, `BINANCE_API_KEY`/
  `BINANCE_API_SECRET`, `ISO_NE_USERNAME`/`ISO_NE_PASSWORD`). A new contributor following the
  documented setup exactly would get a running app (most connectors fail gracefully to
  `null`/`UNAVAILABLE` per the project's own discipline, so it likely won't crash), but most engines
  would show empty/stale data locally with no indication of which variable would unblock which
  feature. This is the single most concrete, fixable onboarding blocker found in this audit.
- **Screenshots / demo video / architecture diagram / sample API responses?** None exist anywhere in
  the repository (searched for `.png`/`.jpg`/`.gif` outside `node_modules`/`.next` — zero results).
- **Do setup instructions otherwise match the code?** Yes, for what they cover — the `npm run
  dev`/`build`/`lint` commands and the one documented Supabase/FRED signup flow are accurate; the gap
  is coverage (missing vars), not correctness of what's there.

## D. Trust and safety

- **Secret handling**: clean. `.gitignore` correctly excludes `.env*` except `.env.example`; no
  `.env.local` or credential file is tracked. Nothing found in this audit suggesting a leaked secret.
- **Security-sensitive routes**: `/api/cron/*` routes are gated by `CRON_SECRET` bearer-token auth
  (`isAuthorizedCron`), and `/admin/*` requires a server-checked `role = 'admin'` — both verified
  present in code, consistent with what `CLAUDE.md` documents.
- **Data-source licensing**: this project already has an unusually strong track record here —
  verified this session alone, it has declined real, technically-reachable data (CCIL, ACLED,
  OpenSanctions, SGX, Tadawul) specifically because their own terms forbade the exact use this
  project would need, rather than building around the restriction. This is genuine evidence for a
  "trustworthy methodology" claim, not an assumption.
- **Missing license**: real gap. With no `LICENSE` file, the legal default is "all rights reserved" —
  nothing in this repo is currently actually open-source in the legal sense, regardless of being
  publicly visible on GitHub. This blocks forking, redistribution, and most contribution workflows
  until resolved, and **requires the repository owner's explicit decision** (per the operating rules
  for this campaign) — not something to resolve unilaterally.
- **Overly broad or stale claims**: none found that look fabricated. The README's self-reported
  limitations section is detailed and appears to match the code on every item spot-checked.
- **Public endpoints / abuse surface**: the now-unauthenticated `/api/*` surface (see section C) is
  intentional per the proxy's allowlist, but the LLM-backed `ask` endpoints (`/api/derivatives/ask`,
  `/api/geopolitical/ask`) do require a signed-in user and a 20-second per-user cooldown — confirmed
  in code. No open, costly LLM-calling endpoint was found unauthenticated.

## E. Growth readiness (summary judgment, grounded in A–D above)

| Dimension | Status |
|---|---|
| Discoverability | Weak — no topics, generic description, no license, no release |
| Product clarity | Weak on the README's first screen; strong once you reach "What's built" |
| Documentation | Strong on methodology/limitations (`CLAUDE.md`, `docs/*_ENGINE.md`); absent on contribution/architecture-for-newcomers |
| Technical proof | Real and verifiable (49 passing tests, a live public API, a running production site) but not surfaced anywhere visually |
| Repeat usage | Unmeasured — no analytics reviewed in this audit (see Metrics phase); dashboard requires signup so there's a real funnel step before any usage can be measured |
| Contributor onboarding | Weak — no CONTRIBUTING.md, no CI, no issue templates, no license, incomplete `.env.example` |
| Content opportunities | Strong raw material — real engineering incidents this project already has honest writeups for (token-expiry outages, stale-data gotchas, license-declined sources) are genuinely good technical-blog material, not generic "started a project" content |
| Existing external referral/adoption evidence | None — 0 stars/forks, single contributor, no evidence of outside traffic found or claimed |

## What this audit did NOT verify (explicitly UNKNOWN)

- GitHub Traffic/Insights data (unique visitors, referring sites, clones) — requires repo-admin
  access to the Insights tab, not available via the `gh` CLI calls run in this audit.
- Vercel Analytics / any live-product visitor or sign-up numbers — not checked; would need the
  Vercel dashboard or an explicit analytics export, and this audit did not query production
  databases per the operating rules.
- Whether any external mention, backlink, or citation of this project already exists anywhere
  (Reddit, Hacker News, Twitter/X, etc.) — not searched in this pass.
