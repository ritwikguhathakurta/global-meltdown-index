# IndieHackers draft

Secondhand research only (no official IndieHackers rules page found) — self-promotion is reportedly
tolerated when paired with genuine discussion contribution. See `docs/growth/COMMUNITY_RESEARCH.md`.

**Title:**
> 7 weeks building a systemic-risk dashboard with a "no fabricated numbers, ever" rule

**Body:**
> Context: I wanted a macro/market risk view that wasn't a black box or US-only, so I built one —
> 24 risk engines across G7+China, all from free/official sources (FRED, central banks, SEC EDGAR,
> World Bank, IMF), recomputed daily into one composite score.
>
> The rule that shaped every decision: real and traceable, or UNAVAILABLE — no backfilling, no
> estimating to fill a gap. That rule cost me a few data sources I would have liked to use (a
> couple of them explicitly forbid the kind of automated access this needs in their own terms), but
> it's also the thing I'd want anyone evaluating a "risk score" product to actually be able to check.
>
> Public, no-signup proof: `curl https://globalmeltdownindex.net/api/gfmi`. Full writeup of what's
> built vs. deliberately not built: https://github.com/ritwikguhathakurta/global-meltdown-index
> (Apache-2.0)
>
> Would love feedback from anyone who's tried to make a data product's methodology actually
> legible instead of just claiming "AI-powered" and moving on.
