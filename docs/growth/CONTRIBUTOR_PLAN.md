# Contributor engine plan — Global Meltdown Index

Growth master-plan Phase 6 deliverable. `CONTRIBUTING.md` (repo root) is the contributor-facing
document; this file is the internal plan behind it — what's already built, what a contributor
actually needs to understand the system, and a real, honestly-scoped list of starter tasks.

## Infrastructure status (what's already in place)

| Item | Status |
|---|---|
| `CONTRIBUTING.md` | Done — setup recap, mandatory local checks (no CI yet), data-source rules, PR expectations |
| Pull-request template | Done — `.github/PULL_REQUEST_TEMPLATE.md` |
| Bug-report issue template | Done — `.github/ISSUE_TEMPLATE/bug_report.md` |
| Data-source-proposal issue template | Done — `.github/ISSUE_TEMPLATE/data_source_proposal.md` |
| Security reporting guidance | Done — `/SECURITY.md` |
| A concise setup guide | Done — README's Quick start + One-time setup sections |
| LICENSE (contribution requires one to exist) | Done — Apache-2.0, 2026-10-22 |

## How the system actually works, for a contributor (the five things to understand first)

1. **`metric_series` is the entire data layer** — one Postgres table holds every time series in the
   app. A new data source means a new row type in this one table, not a new schema. See
   `CLAUDE.md`'s "The `metric_series` table is the entire data layer" section.
2. **Source connector → migration → pipeline wiring → (optionally) a page wrapper** is the exact
   four-step pattern for adding a data source — `CLAUDE.md`'s "Adding a new data source connector"
   section and `CONTRIBUTING.md` both document this identically, on purpose.
3. **Two different things are both called "engine"** — the 24 GFMI-registered engines
   (`src/lib/engines/registry.ts`) vs. ~50 other page-level/domain engines that aren't part of the
   composite score. Check `registry.ts` before assuming a file feeds GFMI.
4. **The daily pipeline has a hard 300-second ceiling** — any new ingestion stage must be wrapped in
   `withStageTimeout` (`src/lib/pipeline/ingest.ts`), or a slow stage can silently kill every other
   concurrently-running stage's data for that day.
5. **Migrations are pasted manually, not applied by a CLI** — there's no linked Supabase CLI in this
   environment. A contributor's PR that adds a migration file needs to say clearly which file the
   maintainer must run in Supabase Studio, and the connector code must degrade gracefully (return
   `null`, never throw) until that happens.

This list intentionally mirrors `CLAUDE.md`'s own architecture notes rather than re-explaining them
differently — one source of truth, not two documents that can drift apart.

## Good-first-issue framework

A good first issue here should be: (a) real — fixes something that's actually broken or genuinely
missing, (b) independently completable without needing production credentials or a maintainer
decision mid-task, and (c) verifiable — there's a clear way to check the fix actually works. The
master plan explicitly forbids manufacturing cosmetic issues just to generate activity; every
candidate below is a genuine gap, not an invented one.

### Candidate starter issues (not yet filed on GitHub — listed here for your review first)

| Candidate | Real gap it addresses | Verifiable by |
|---|---|---|
| Add a test suite for one of the ~70 untested engines/connectors | `docs/growth/BASELINE_AUDIT.md`: 49 passing tests exist, but only for 3 pure calculation layers | New test file + `tsx` run, no production access needed |
| Fix the UK's missing Supply Chains proxy | `docs/SCOPE.md`: UK has no country-level proxy; OECD series discontinued 2021, CBI site Cloudflare-protected | Would need a genuinely new free UK source found and verified live — a real research task, not a quick fix |
| Add a CI workflow (lint + tsc + tests + build on PR) | `docs/growth/PRIORITIZED_BACKLOG.md` item #7 — no CI exists | A green GitHub Actions run on a test PR |
| Improve a connector's error handling/retry behavior | `fetchRetry.ts` exists for some sources but not all — check which ones lack it | Existing retry pattern applied, tests still pass |
| Document a real API response for an endpoint not yet in `docs/API_EXAMPLES.md` | Only 5 of ~42 public routes have a captured example | A live `curl` capture added to the doc |

**Not filed as actual GitHub issues in this pass** — per the master plan's operating rules, creating
public, external-facing content (even an issue) is something to do with your explicit go-ahead,
not automatically. These are ready to file as-is if you approve them.

## Contributor roadmap (sequencing, not a promise of timeline)

1. Infrastructure (done): CONTRIBUTING.md, templates, SECURITY.md, LICENSE.
2. First real external contribution, whenever it happens — triage and respond promptly; the first
   one sets the tone for everyone who follows.
3. Once there's more than one contributor or more than a handful of PRs: revisit CI (item #7) so
   correctness isn't resting entirely on manual review.
4. Once there's a recurring theme in questions: write it into `CLAUDE.md`/`CONTRIBUTING.md` rather
   than answering the same thing repeatedly in issue comments.

## What's explicitly not done here

- No actual GitHub issues were created.
- No CODE_OF_CONDUCT.md was added — low urgency for a zero-contributor repo; revisit once someone
  other than the maintainer is actually participating.
- No contributor recognition system (e.g. an all-contributors bot) — premature with zero external
  contributors; would be a solution looking for a problem right now.
