# Positioning — Global Meltdown Index

Growth master-plan Phase 2 deliverable. Positioning hypotheses below are validated against the
actual implementation (`docs/growth/BASELINE_AUDIT.md`), not assumed. Anything not yet verified is
marked as a hypothesis to test, not a claim to publish.

## One-sentence description

An open-source systemic-risk terminal that turns free, official macro-financial data into 24
independently-scored risk engines and one transparent composite score — every number traceable to
a named source, or honestly labeled `UNAVAILABLE`.

## Short pitch (elevator, ~2 sentences)

Most "market risk" dashboards are either US-only, paid, or a black-box score with no visible
methodology. Global Meltdown Index computes 24 real risk engines across G7 + China from free,
official data only (FRED, central banks, SEC EDGAR, World Bank, IMF), and shows its work — every
score, weight, and source is in the public API response itself.

## 30-second pitch

Global Meltdown Index is a systemic-risk terminal built on one rule: every number is either real
and traceable, or the UI says `UNAVAILABLE` instead of guessing. It computes 24 independent risk
engines — credit, liquidity, sovereign debt, banking, property, geopolitical, derivatives, AI-sector
financial sustainability, India-specific liquidity and yield curves, and more — across the G7 and
China, and rolls them into one composite score (GFMI) via a weighted average plus a nonlinear
multi-shock amplifier. The daily pipeline runs against ~76 registered official sources, costs the
project real credibility whenever a source's own terms don't allow the automated use it needs
(CCIL, ACLED, and OpenSanctions were all checked and declined on exactly that basis), and ships a
public, no-signup API so anyone can verify a claim is real before trusting it. It's licensed
Apache-2.0 and open to contributions — see `CONTRIBUTING.md`.

## Target audiences — ranked, with validation status

| Rank | Audience | Why they'd care | Validated? |
|---|---|---|---|
| 1 (primary) | Macro/quant researchers and students | Real, traceable, multi-country risk data with visible methodology, free | **Hypothesis** — no user interviews or analytics exist yet to confirm this |
| 2 | Developers building financial-data tools | A public, no-signup API with real computed scores; a working example of a disciplined "no fabrication" data pipeline architecture | **Hypothesis** — same caveat |
| 3 | Open-source contributors interested in financial-data engineering | Real engineering problems (pagination traps, tag drift, source licensing) documented honestly, Apache-2.0, CONTRIBUTING.md + templates already in place | **Partially validated** — the infrastructure for this audience is real and live (CONTRIBUTING.md, PR/issue templates); whether anyone actually shows up is still unmeasured |

Per the master plan's own instruction: prioritize one primary + two secondary audiences for month
one rather than spreading thin. Recommendation: **primary = macro/quant researchers and developers
evaluating a transparent risk-data architecture** (these two overlap heavily in where they'd be
found — Hacker News, r/algotrading-adjacent communities, dev-focused newsletters) — **secondary =
open-source contributors**. This is a starting hypothesis to revise once `docs/growth/METRICS.md`'s
referrer data shows who's actually arriving and from where.

## User problems solved

- "I want a systemic-risk view that isn't US-only, isn't a black box, and isn't paid."
- "I want to check a claim's actual source before trusting a 'risk score.'"
- "I want a real example of a financial-data pipeline that handles staleness/missing-data honestly,
  to learn from or build on."

## Main differentiators (verified against the code, not asserted)

1. **Per-number traceability** — every value carries a source/tier citation and a freshness badge
   computed against that source's real publication cadence (`src/lib/quality/freshness.ts`).
2. **A documented refusal discipline** — real, technically-reachable sources (CCIL, ACLED,
   OpenSanctions, Stooq, investing.com, France's TEC 10) were evaluated and declined specifically
   because their own terms forbid the automated use this needs — see `docs/SCOPE.md`.
3. **G7 + China coverage**, not US-only, built deliberately wider rather than defaulting to US-only
   (see README's "Country coverage" section for the specific per-engine detail).
4. **A public, zero-signup API** — `curl https://globalmeltdownindex.net/api/gfmi` returns real,
   live, computed data with no account required.
5. **Honest test-coverage disclosure** — 49 passing assertions across three pure calculation layers,
   and an explicit admission that the 24 registered engines have no automated tests yet (see
   `docs/growth/BASELINE_AUDIT.md`) rather than an unqualified "fully tested" claim.

## Evidence required before each major claim ships publicly

| Claim | Evidence required | Status |
|---|---|---|
| "24 risk engines" | Count `key:` entries in `src/lib/engines/registry.ts` | Verified (24) |
| "Free, official data only" | Spot-check source URLs/tiers in `/api/sources` | Verified live 2026-10-22 |
| "Every number traceable" | Walk one indicator source-to-score | Verified — see README's "Inspect a real signal" |
| "No signup needed for the API" | `curl` the live endpoint with no auth header | Verified live |
| Any star/user/traffic count | Pull live from GitHub API, same day as publishing | Must be re-verified at publish time, not reused from this document |

## Positioning that avoids sensationalism

Never describe the GFMI score as predicting a crash, naming a date, or claiming statistical
certainty. The disclaimer language already in the API/README ("CURRENT MACRO/MARKET ASSESSMENT —
NOT A GUARANTEED FORECAST OR INVESTMENT RECOMMENDATION") is load-bearing positioning, not legal
boilerplate to work around in marketing copy — every launch draft in `docs/growth/launch/` repeats
it rather than softening it for effect.

## Code vs. hosted product — the distinction that matters for an OSS pitch

- **The code** (`github.com/ritwikguhathakurta/global-meltdown-index`, Apache-2.0): anyone can run
  it, modify it, and self-host it with their own Supabase project and API keys — see the README's
  Quick start / One-time setup.
- **The hosted product** (`globalmeltdownindex.net`): the maintainer's own running instance, with
  its own daily pipeline, admin access, and (eventually) a subscription tier for the dashboard UI —
  not something a contributor needs access to in order to use or improve the open-source code.

## Open-source value proposition

The code is free to fork/self-host (Apache-2.0). The hosted product is free to read via the public
API; the dashboard UI itself requires a free account today, with no payment processor wired up yet
(see `docs/SCOPE.md`) — so there's currently no paid tier to contrast against, and no claim here
should imply one exists.
