# Prioritized Growth Backlog — Global Meltdown Index

Built directly from `BASELINE_AUDIT.md`'s verified findings, not generic growth advice. Nothing
below has been implemented — this is the ranked plan for review before any execution.

## Scoring method

Each opportunity is scored 1–5 (5 = best) on **Reach**, **Conversion**, **Retention**, and **Trust**,
and 1–5 (5 = worst) on **Effort** and **Risk**. Priority score:

```
Priority = (Reach + Conversion + Retention + Trust) / (Effort + Risk)
```

Higher = do sooner. These scores are judgment calls made against the audit's findings, not measured
data — there is no traffic yet to measure against. Treat the ranking as a reasoned starting order,
not a guarantee, and re-score once real numbers exist (see `METRICS.md`, a later deliverable).

**Decision Needed** marks anything that requires the repository owner's explicit choice or approval
before it can be executed, per this campaign's operating rules (license terms, GitHub-side settings,
anything external-facing) — these are ranked for completeness but are not mine to execute
unilaterally.

## Ranked backlog

| # | Item | Reach | Conv. | Retn. | Trust | Effort | Risk | Priority | Decision Needed? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ~~Fix `.env.example`~~ — **done**, all 20 real env vars documented, grouped Core/Optional | 4 | 3 | 2 | 4 | 1 | 1 | **6.5** | No |
| 2 | ~~Surface the public API as a one-line `curl` demo~~ — **done**, plus `npm run demo` and `docs/API_EXAMPLES.md` | 4 | 4 | 2 | 3 | 1 | 1 | **6.5** | No |
| 3 | ~~LICENSE file~~ — **done 2026-10-22**, Apache License 2.0 chosen by the owner, see `/LICENSE` | 5 | 4 | 2 | 5 | 1 | 2 | **5.3** | No |
| 4 | ~~README hero rewrite~~ — **done**, restructured into a see-it-live → GFMI-meaning → real-signal → contribute flow, full spec moved later in the doc | 5 | 5 | 3 | 4 | 2 | 1 | **5.7** | No |
| 5 | GitHub metadata: accurate description, Topics, homepage pointed at `globalmeltdownindex.net` instead of the Vercel URL | 4 | 3 | 1 | 2 | 1 | 1 | **5.0** | **Yes — GitHub settings change.** Recommendation drafted in `docs/growth/GITHUB_METADATA_PLAN.md`; not applied |
| 6 | First tagged Release (`v0.1.0`) with real release notes | 2 | 2 | 1 | 3 | 1 | 1 | **4.0** | **Yes — a visible, public GitHub action**, not applied |
| 7 | CI workflow: run `lint` + `tsc --noEmit` + the three test suites + `build` on every PR | 2 | 2 | 2 | 5 | 2 | 1 | **3.7** | No — still not built |
| 8 | ~~CONTRIBUTING.md + issue templates + PR template~~ — **done**; good-first-issue candidates drafted in `docs/growth/CONTRIBUTOR_PLAN.md` but not filed as real GitHub issues yet | 2 | 2 | 3 | 4 | 2 | 1 | **3.7** | No |
| 9 | Real screenshot(s) or a short demo GIF of the dashboard | 3 | 4 | 1 | 3 | 2 | 1 | **3.7** | No — needs a real signed-in session; see `docs/growth/DEMO_PLAN.md` item C |
| 10 | ~~SECURITY.md~~ — **done**, see `/SECURITY.md` | 1 | 1 | 1 | 3 | 1 | 1 | **3.0** | No |
| 11 | ~~Architecture overview doc for human newcomers~~ — **done**, see `docs/ARCHITECTURE.md` | 2 | 3 | 2 | 3 | 2 | 1 | **3.3** | No |
| 12 | Enable GitHub Discussions, seeded with a "Show and tell" / "Methodology questions" category | 1 | 1 | 2 | 1 | 1 | 1 | **2.5** | **Yes — GitHub settings change** |
| 13 | ~~Capture a Day-0 metrics baseline~~ — **done 2026-10-22**, see `docs/growth/METRICS.md` | 1 | 1 | 1 | 2 | 1 | 1 | **2.5** | No |
| 14 | Custom social-preview (OG) image | 3 | 2 | 1 | 1 | 2 | 1 | **2.3** | No — depends on #9's screenshot work existing first |
| 15 | ~~Content/launch asset pack~~ — **drafted 2026-10-22**, see `CONTENT_CALENDAR.md`, `LAUNCH_DRAFTS.md`, `docs/growth/launch/`, `COMMUNITY_RESEARCH.md`, `OUTREACH_TRACKER.md`, `DISTRIBUTION_PLAYBOOK.md` | 5 | 3 | 1 | 2 | 4 | 3 | **1.6** | **Yes — nothing drafted has been published or sent; every post/outreach action still needs separate approval at the time** |

## Reading the order

The ranking lands almost exactly on Phase 13's own prescribed sequence without being forced there:
fix the things that currently stop a visitor from understanding the product (#1, #2, #4) and the
one hard trust blocker (#3, pending your decision) rank highest; contribution infrastructure and
architecture docs (#7, #8, #11) land in the middle; and the external content/distribution push (#15)
correctly ranks last — it has the highest reach but also the highest effort and the highest risk
(it's the only item here that's irreversible once published), and Phase 13 explicitly warns against
chasing reach before the product itself converts a visitor.

**One exception to "work strictly in score order":** item #13 (baseline metrics capture) scores low
on impact, but it's a *timing* dependency, not a priority one — it has to happen before #1–#9 change
anything, or this campaign loses its own before/after comparison. Do it first regardless of rank,
then resume the ranked order.

## What's explicitly NOT in this backlog, and why

- Anything touching the daily cron schedule, scoring weights, auth rules, or production
  database — out of scope for a growth campaign per this plan's own operating rules, regardless of
  potential impact.
- Star-count tactics, outreach automation, or anything that manufactures activity — excluded on
  principle (Phase 0, rules 8–11), not scored as a tradeoff.
- Large new feature subsystems (e.g., a public notebook/playground) — plausible future ideas, but
  not scored here since Phase 13 explicitly asks to prefer improving what exists over building new
  subsystems for this first pass.

## Status as of 2026-10-22

Items #1, #2, #3, #4, #8, #10, #11, #13, and #15 are done (committed to `master`, which this growth
work has since merged into). What's left, in order:

- **#5 and #6** (GitHub metadata, first release) — both flagged **Decision Needed**; plans are
  ready (`GITHUB_METADATA_PLAN.md`) but not applied.
- **#12** (Discussions) — **Decision Needed**, not applied.
- **#7** (CI workflow), **#9** (real screenshots), **#14** (OG image, depends on #9) — not started;
  none are blocked on a decision, just not yet built.
- **#15's actual execution** (posting/publishing any of the drafted launch content) — explicitly
  **not** done; every draft is pending your separate, per-post approval, per this campaign's own
  operating rules.
