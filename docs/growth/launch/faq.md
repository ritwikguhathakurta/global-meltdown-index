# Launch FAQ

Honest answers to questions this launch will likely get, prepared in advance so the real-time
answers stay consistent and accurate rather than improvised under comment pressure.

**Is this financial advice? Should I trade on this?**
No. The GFMI score and every engine score are current risk signals computed from real data, not a
forecast or a recommendation. The API itself carries this disclaimer on every response.

**Is this going to predict the next crash?**
No. A rising score means tracked conditions are deteriorating right now, not that a specific crisis
is coming on a specific date. See the README's "What the GFMI score means" section for the exact
stage definitions.

**What license is this?**
Apache License 2.0, added 2026-10-22 — picked over MIT for the explicit patent grant; it's still a
permissive license, so forking, modifying, and even commercial reuse are allowed.

**Why isn't there a screenshot or demo video yet?**
Honestly: not built yet. The public API demo (`curl https://globalmeltdownindex.net/api/gfmi`) and
`npm run demo` are the no-signup proof that exists today; a screenshot gallery and video are planned
(see `docs/growth/DEMO_PLAN.md`) but need a real signed-in session to capture honestly, not a mockup.

**How is this different from [some other dashboard / Bloomberg terminal / etc.]?**
Most comparable tools are either paid, US-only, or don't show their methodology. This one is free
to read via the public API, covers G7 + China (not just the US), and discloses every source/tier
and every declined source — see `docs/SCOPE.md` for exactly what wasn't used and why.

**Can I self-host this?**
Yes — it's Apache-2.0, and the README's Quick start / One-time setup sections walk through it (your
own Supabase project + a free FRED API key is the minimum to run it locally).

**Is the hosted version (globalmeltdownindex.net) free?**
The public API is free and unauthenticated. The dashboard UI needs a free account. There's no
payment processor wired up yet, so there's currently no paid tier — see `docs/SCOPE.md`.

**Why no CI yet?**
Genuine gap, tracked (`docs/growth/PRIORITIZED_BACKLOG.md` item #7). Today, correctness rests on
manual verification against live data before shipping, documented in `CLAUDE.md` and
`CONTRIBUTING.md` — not on an automated check.

**Who's behind this — a company, a team?**
A solo maintainer (Ritwik Guha Thakurta), built and operated individually. Not a funded startup.

**What data sources does it actually use?**
FRED, central banks (Fed/ECB/BOE/BOC/BOJ/PBOC-adjacent proxies), SEC EDGAR, World Bank, IMF, and
~70 other free/official sources — the full registry is public at `/api/sources`.

**How do I contribute?**
See `CONTRIBUTING.md` — setup, the required local checks (no CI yet, so these are the actual review
bar), and the rule every data source has to pass (free, official, and allowed by its own terms).
