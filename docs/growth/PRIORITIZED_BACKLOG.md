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
| 1 | Fix `.env.example` — document all 20 real env vars (only 5 are currently listed), grouped by required-for-core vs. optional-per-feature | 4 | 3 | 2 | 4 | 1 | 1 | **6.5** | No |
| 2 | Surface the already-live, unauthenticated `/api/gfmi` and `/api/health` endpoints as a one-line `curl` demo — no signup needed, already verified working | 4 | 4 | 2 | 3 | 1 | 1 | **6.5** | No |
| 3 | LICENSE file | 5 | 4 | 2 | 5 | 1 | 2 | **5.3** | **Yes — pick a license** |
| 4 | README hero rewrite: tagline, what/why in the first screen, real badges, the verified `curl` demo, link to the live site | 5 | 5 | 3 | 4 | 2 | 1 | **5.7** | No |
| 5 | GitHub metadata: accurate description, Topics, homepage pointed at `globalmeltdownindex.net` instead of the Vercel URL | 4 | 3 | 1 | 2 | 1 | 1 | **5.0** | **Yes — GitHub settings change** |
| 6 | First tagged Release (`v0.1.0`) with real release notes | 2 | 2 | 1 | 3 | 1 | 1 | **4.0** | No |
| 7 | CI workflow: run `lint` + `tsc --noEmit` + the three test suites + `build` on every PR | 2 | 2 | 2 | 5 | 2 | 1 | **3.7** | No |
| 8 | CONTRIBUTING.md + issue templates + PR template + a handful of real good-first-issues | 2 | 2 | 3 | 4 | 2 | 1 | **3.7** | No |
| 9 | Real screenshot(s) or a short demo GIF of the dashboard | 3 | 4 | 1 | 3 | 2 | 1 | **3.7** | No |
| 10 | SECURITY.md (sensible for a project that handles signups and financial data) | 1 | 1 | 1 | 3 | 1 | 1 | **3.0** | No |
| 11 | Architecture overview doc aimed at human newcomers (`CLAUDE.md`/`AGENTS.md` are written for an AI agent, not a first-time contributor) | 2 | 3 | 2 | 3 | 2 | 1 | **3.3** | No |
| 12 | Enable GitHub Discussions, seeded with a "Show and tell" / "Methodology questions" category | 1 | 1 | 2 | 1 | 1 | 1 | **2.5** | **Yes — GitHub settings change** |
| 13 | Capture a Day-0 metrics baseline (GitHub Traffic/Insights snapshot, current star/fork/visitor counts) into the CSV template `METRICS.md` will define | 1 | 1 | 1 | 2 | 1 | 1 | **2.5** | No — but **time-sensitive**: do this before anything else changes, regardless of its score, or there is no "before" to compare against later |
| 14 | Custom social-preview (OG) image | 3 | 2 | 1 | 1 | 2 | 1 | **2.3** | No |
| 15 | Content/launch asset pack (blog post, demo video script, social drafts, Show HN draft) | 5 | 3 | 1 | 2 | 4 | 3 | **1.6** | **Yes — nothing in here gets published without separate approval** |

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

## Immediate next step (awaiting your go-ahead)

This session's scope was audit-and-plan only — no application code was changed, matching the
request. The next reviewable unit of work, if you approve it, is items **#13 → #1 → #2 → #4** on
this branch: capture the baseline, fix the env-var documentation gap, surface the public API demo,
and rewrite the README's opening. Each would land as its own small commit on
`growth/github-discovery-and-onboarding` for you to review via `git diff` before anything merges —
nothing on this branch has been pushed or merged yet.
