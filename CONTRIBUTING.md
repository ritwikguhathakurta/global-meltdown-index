# Contributing

Thanks for considering it. This is a solo-maintained project in active daily development, so please
open an issue to discuss anything nontrivial *before* writing code — it saves both of us a rewritten
PR.

## Before you start

1. Read the README's [Quick start](README.md#quick-start) and get the app running locally.
2. Read `CLAUDE.md` and `AGENTS.md` at the repo root. They're written for an AI coding agent working
   in this codebase, but the rules in them are exactly the rules a human contributor needs too —
   especially the **"Data honesty"** paragraph: every number in this app is real and traceable to a
   free/official source, or the UI shows `UNAVAILABLE`. Nothing is estimated, backfilled, or
   mocked to fill a gap, and that discipline is non-negotiable for anything you add.
3. For the architecture (how data actually flows from an external API to a dashboard page), read
   `docs/ARCHITECTURE.md` — it's the newcomer-oriented version of `CLAUDE.md`.

## There is no CI yet

Be aware: nothing currently runs automatically on your PR. That means **you** are the check — run
all of these locally before opening a PR, and paste their output (or a summary) into the PR
description:

```bash
npx tsc --noEmit -p .       # typecheck
npx eslint <changed files>  # lint
npm run build               # production build — catches issues a dev server won't
npm run test:carry          # 25 assertions
npm run test:derivatives    # 13 assertions
npm run test:geopolitical   # 11 assertions
```

The 24 registered risk engines and most of the ~70 other domain engines/connectors have **no**
automated test coverage — see `docs/growth/BASELINE_AUDIT.md` for the honest current state. If
you're touching one of those, the real verification is checking the change against live data (see
"Adding a data source" below), not a test suite that doesn't exist yet. A CI workflow that runs the
checks above on every PR is a known, tracked gap (`docs/growth/PRIORITIZED_BACKLOG.md`, item #7) —
until it lands, treat the list above as mandatory rather than optional.

## What kind of contribution is useful right now

- **Bug fixes** with a clear repro — always welcome.
- **A new free, official data source** for an engine that currently shows `UNAVAILABLE` for a
  spec'd indicator. See the README's [Scope](README.md#scope--whats-not-here-yet) section for the
  current, honest list of known gaps (e.g. the UK's missing Supply Chains proxy, India Market
  Regime's partial coverage).
- **Documentation fixes** — if something in the README, `CLAUDE.md`, or a `docs/*_ENGINE.md` file
  no longer matches the code, that's a real, easy-to-review PR.
- **Test coverage** for an existing engine or connector that currently has none.

## What's explicitly out of scope for an unsolicited PR

- Anything that scrapes or evades bot-detection on a site whose own terms forbid automated
  collection. This project has already declined several real, technically-reachable sources (CCIL,
  ACLED, OpenSanctions, SGX, Tadawul) for exactly this reason — a PR that works around one of those
  declines, or adds a new source with the same problem, will be rejected regardless of how useful
  the data would be.
- A paid/licensed data provider presented as if it were free.
- Changes to the daily cron schedule, GFMI scoring weights, or the auth/route-protection gate
  (`src/proxy.ts`, `src/lib/supabase/middleware.ts`) — these need a maintainer decision, not a
  drive-by PR.
- Anything that fabricates a number, testimonial, or activity metric, however small.

## Adding a data source connector

Follow the exact pattern in `CLAUDE.md`'s "Adding a new data source connector" section:

1. `src/lib/sources/<name>.ts` exporting a `fetch<Thing>(...): Promise<MetricPoint[]>`. Verify the
   endpoint live — real, current data — before wiring it in, and document in the file's own doc
   comment exactly what you checked, including anything you rejected and why (this project's
   established convention; see almost any existing file in that directory for the shape).
2. `supabase/migrations/NNNN_<name>_source.sql` inserting the matching row into the `sources` table.
   **You can't apply this yourself** — there's no linked Supabase CLI in this environment by design
   (see `CLAUDE.md`'s "Migrations are applied manually" note). Say clearly in your PR which migration
   file needs to be run in Supabase Studio's SQL Editor before the source will actually resolve
   (`upsertMetrics` silently writes `source_id: null` otherwise, rather than failing loudly).
3. Wire the fetch call into `runIngestionPipeline` in `src/lib/pipeline/ingest.ts`, wrapped in
   `withStageTimeout`.
4. If it's a dashboard-facing metric (not feeding a registered GFMI engine directly), add a
   `get<Thing>()` wrapper in `src/lib/api/engineData.ts` following the existing pattern exactly —
   tolerate `null`/misconfiguration gracefully, never throw.

## Opening the PR

Keep it small and reviewable — one source, one bug fix, one doc fix per PR, not a bundle. Use the
PR template; it asks for the verification output above and, for a new data source, a link to the
endpoint's own terms of use confirming this kind of automated access is actually allowed.
