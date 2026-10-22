# Technical blog post outlines

Three outlines, matching `docs/growth/CONTENT_CALENDAR.md`'s Weeks 2-4. None are written yet — these
are outlines to write from, grounded in real, already-documented incidents (see
`CLAUDE.md`'s "Known gotchas" section and the README's AI-engines section), not invented drama.

## Post 1 — "The 1000-row cap that made a 20-year-old rate cut look current"

- **Hook**: a user reported a historical rate-cut event "looked 20 years stale" — that bug report
  is what surfaced the issue, not a test.
- **The real mechanism**: Supabase/PostgREST's default 1000-row cap silently truncates any
  unpaginated query — no error, no warning, just a quietly short result set.
- **Which series it broke**: Bank of England data cut off in 2003; BOJ, BoC similarly affected.
- **The fix**: `.range(offset, offset + PAGE_SIZE - 1)` pagination in `fetchSeries`/
  `fetchLatestForKeys` (`src/lib/metrics/store.ts`).
- **The lesson, generalized**: "worked in testing against a short series" is not proof a query
  handles a long one — a real, transferable lesson for anyone building on Postgres/PostgREST.
- **CTA**: link to the repo, the specific commit/file, and the public API endpoint that now serves
  this data correctly.

## Post 2 — "What I declined to scrape, and why"

- **Hook**: a "nothing is faked" rule has a cost most people don't talk about — the sources you
  don't use.
- **The real cases**: CCIL (§4.8 of its own Terms of Use bans automated collection outright), ACLED
  (EULA bans scraping, requires a paid corporate license for commercial use), OpenSanctions (paid
  license required for a product like this), Stooq (now behind a JS proof-of-work challenge),
  investing.com (no free API).
- **The actual decision rule**: a technically-reachable endpoint isn't the same as a licensed one —
  check the source's own terms before building against it, don't evade bot-detection to get past a
  deliberate block.
- **What was built instead**: India Yield Curve from RBI's own primary-auction data instead of
  CCIL's secondary-market curve, as the concrete example of "declined, then found a real
  alternative" rather than just a gap.
- **CTA**: link to `docs/SCOPE.md`'s full list, and the repo.

## Post 3 — "Tag drift: why SEC EDGAR filings silently lie about which field is current"

- **Hook**: XBRL filings don't version their own tags consistently — a naive "first tag that
  returns data" approach silently locks onto values years out of date.
- **The real cases**: Microsoft stopped tagging `CostOfRevenue` in 2018; Alphabet's revenue tag
  went stale in 2025 while still reporting a different tag for the same figure; four companies
  migrated `InterestExpense` to `InterestExpenseNonoperating` in FY2025, caught live in production
  via a STALE `interest_coverage` reading.
- **The fix, generalized**: pick "most recent value across all candidate tags," not "first tag that
  has any data" — and the YTD-vs-discrete-quarters de-cumulation problem in the same data (see
  README's AI-engines section) as a second, related real bug.
- **CTA**: link to `src/lib/sources/secEdgar.ts`, the repo, and the live AI-engine pages.

## Shared rules for all three

- Every date, company name, and tag name must be re-verified against the actual code/filing before
  publishing — these outlines summarize what's already documented, but the published post should
  cite the real source again, not just repeat this outline from memory.
- No invented metrics (e.g. "this bug affected X% of queries") unless that number is actually
  computed and cited.
