# Launch drafts — Global Meltdown Index

Draft copy for every channel in `docs/growth/CONTENT_CALENDAR.md`'s launch days. **None of this has
been posted anywhere.** Edit freely before anything goes out — these are a starting point, not
final copy, and several carry an explicit blocker noted inline.

A rule every draft below follows, on purpose: no claim appears here that isn't already true today.
No testimonials (none exist), no user counts (there are none yet), nothing that implies investment
advice. The repo is licensed Apache License 2.0 as of 2026-10-22 (`/LICENSE`), so "open source"
language below is now accurate and doesn't need the earlier disclosure-of-no-license framing.

---

## Show HN

**Confirmed against HN's own posting guidelines** (see `docs/growth/COMMUNITY_RESEARCH.md`) — no
self-praise in the title, no asking for votes, must be a finished, usable thing. This draft follows
those rules.

**Title** (HN strips most editorializing anyway, keep it plain):
> Show HN: 24 free-data risk engines scoring systemic financial risk daily

**Body** (goes in the first comment, HN convention):
> Hi HN — I'm Ritwik. Global Meltdown Index (https://globalmeltdownindex.net) turns only free,
> official data (FRED, central banks, SEC EDGAR, World Bank, IMF) into 24 independently-scored
> systemic-risk engines and one composite (GFMI), recomputed daily.
>
> The rule I held myself to: every number is either real and traceable to a named source, or the
> UI says UNAVAILABLE — nothing is backfilled or estimated to fill a gap. That also meant turning
> down several real, technically-reachable data sources (CCIL, ACLED, OpenSanctions) because their
> own terms forbid the automated use this would need.
>
> No signup needed to check it's real:
> `curl https://globalmeltdownindex.net/api/gfmi`
>
> Code (Apache-2.0): https://github.com/ritwikguhathakurta/global-meltdown-index
>
> Happy to go into the architecture, any specific data-sourcing call, or what's deliberately not
> built yet (full list in `docs/SCOPE.md`).

---

## r/SideProject

Lower-stakes, feedback-oriented tone matches this sub's actual culture better than a press-release
voice.

**Title:**
> Built a free-data financial risk dashboard where every number traces back to its real source — looking for feedback

**Body:**
> Spent the last ~7 weeks building this after getting annoyed at "risk score" dashboards that don't
> show their work. Global Meltdown Index (https://globalmeltdownindex.net) computes 24 separate
> systemic-risk reads (credit, liquidity, sovereign debt, geopolitical, etc.) purely from free,
> official sources, and rolls them into one composite score.
>
> The constraint I set for myself: if a free source doesn't exist for something, the page says
> `UNAVAILABLE` instead of guessing. That honesty rule turned out to be the hardest part — it meant
> declining a few real data sources outright because their terms didn't allow this use.
>
> You can see it's real without signing up: `curl https://globalmeltdownindex.net/api/gfmi` returns
> live data. Code's on GitHub: https://github.com/ritwikguhathakurta/global-meltdown-index
>
> Genuinely want feedback on the onboarding/README — just rewrote it to lead with a live demo
> instead of a wall of methodology, curious if it actually lands for someone seeing this cold.

---

## IndieHackers

Similar substance to the r/SideProject draft, framed around the build-in-public narrative this
community rewards.

**Title:**
> 7 weeks building a systemic-risk dashboard with a "no fabricated numbers, ever" rule

**Body:**
> Context: I wanted a macro/market risk view that wasn't a black box or US-only, so I built one —
> 24 risk engines across G7+China, all from free/official sources (FRED, central banks, SEC EDGAR,
> World Bank, IMF), recomputed daily into one composite score.
>
> The rule that shaped every decision: real and traceable, or `UNAVAILABLE` — no backfilling, no
> estimating to fill a gap. That rule cost me a few data sources I would have liked to use (a
> couple of them explicitly forbid the kind of automated access this needs in their own terms), but
> it's also the thing I'd want anyone evaluating a "risk score" product to actually be able to check.
>
> Public, no-signup proof: `curl https://globalmeltdownindex.net/api/gfmi`. Full writeup of what's
> built vs. deliberately not built: https://github.com/ritwikguhathakurta/global-meltdown-index
>
> Would love feedback from anyone who's tried to make a data product's methodology actually
> legible instead of just claiming "AI-powered" and moving on.

---

## r/opensource

**Title:**
> [Promotional] Global Meltdown Index — 24 free-data risk engines, Apache-2.0 licensed

**Body:**
> Open-sourcing the project I've been building: a systemic-risk dashboard scoring 24 independent
> engines (credit, liquidity, sovereign debt, geopolitical, etc.) purely from free/official data.
> Apache License 2.0. Contribution guide, PR template, and issue templates are already in the repo
> if anyone wants to add a data source or fix something:
> https://github.com/ritwikguhathakurta/global-meltdown-index

---

## Product Hunt

**Tagline** (keep under ~60 characters):
> Free-data systemic risk terminal, every number traceable

**Description:**
> Global Meltdown Index turns only free, official macro-financial data into 24 independently-scored
> risk engines and one composite score — recomputed daily, with every stale or missing number
> labeled as such instead of guessed at. No signup needed to check it's real: the public API
> returns live data right now. Not a forecast — a current risk signal, clearly labeled as one.

---

## LinkedIn / X recap post (Week 4)

Same core content works for both; X needs it split into a thread.

**LinkedIn (single post):**
> A month ago I set myself one rule for a side project: every number has to be real and traceable to
> a named source, or the UI has to say so honestly. No backfilling, no estimating to fill a gap.
>
> That turned into Global Meltdown Index — 24 systemic-risk engines across G7 + China, built on
> free/official data only (FRED, central banks, SEC EDGAR, World Bank, IMF), recomputed daily into
> one composite score. The honesty rule meant turning down a few real data sources outright because
> their own terms didn't allow the automated use this needed — which, in hindsight, was the actual
> hard part of this build.
>
> Public API, no signup: https://globalmeltdownindex.net · Code: [GitHub link]

**X/Twitter thread (4 tweets):**
> 1/ Spent the last month building a systemic-risk dashboard with one rule: every number is real
> and traceable, or the UI says so. No backfilling. No estimating to fill a gap.
>
> 2/ 24 risk engines, G7 + China, free/official sources only (FRED, central banks, SEC EDGAR, World
> Bank, IMF) → one composite score, recomputed daily.
>
> 3/ The honesty rule had a real cost: I declined a few genuinely useful data sources outright
> because their own terms forbid the automated access this needed. Worth it.
>
> 4/ No signup to check it's real: `curl https://globalmeltdownindex.net/api/gfmi`. Code:
> [GitHub link]
