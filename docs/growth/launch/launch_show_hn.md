# Show HN draft

Confirmed against HN's own posting guidelines (news.ycombinator.com/newsguidelines.html) — no
self-praise in the title, no asking for votes, must be a finished, usable thing. See
`docs/growth/COMMUNITY_RESEARCH.md` for the source check.

**Title:**
> Show HN: 24 free-data risk engines scoring systemic financial risk daily

**Body (first comment, HN convention):**
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
