# KPI tracking — Global Meltdown Index

Every number below was pulled live from the GitHub API on **2026-10-22** (the day PR #1 — the
README/onboarding rewrite — merged to `master`), not estimated. This is the Day-0 baseline
`PRIORITIZED_BACKLOG.md` item #13 flagged as time-sensitive. Re-run the commands below on a
weekly cadence and append a row — don't let this file go stale, since "0 stars" only means
something if there's a real before/after to compare against later.

## Day-0 baseline (2026-10-22)

| Metric | Value | How it was captured |
|---|---|---|
| Stars | 0 | `gh api repos/ritwikguhathakurta/global-meltdown-index --jq .stargazers_count` |
| Forks | 0 | same endpoint, `.forks_count` |
| Watchers | 1 (the owner) | same endpoint, `.subscribers_count` |
| Open issues | 0 | same endpoint, `.open_issues_count` |
| Open PRs | 0 | PR #1 merged same day; none open |
| Page views, last 14 days (2026-09-30 to 2026-10-13) | 0 views / 0 unique visitors | `gh api repos/.../traffic/views` |
| Git clones, last 14 days | 2 clones / 1 unique cloner | `gh api repos/.../traffic/clones` |
| Top referrers | none recorded | `gh api repos/.../traffic/popular/referrers` |
| Top content paths | none recorded | `gh api repos/.../traffic/popular/paths` |

This is a genuine zero baseline — no prior outreach, no prior posts anywhere, a single-collaborator
repo. There is nothing to inflate and nothing to round up.

## How to recapture this snapshot

```bash
gh api repos/ritwikguhathakurta/global-meltdown-index \
  --jq '{stars: .stargazers_count, forks: .forks_count, watchers: .subscribers_count, open_issues: .open_issues_count}'
gh api repos/ritwikguhathakurta/global-meltdown-index/traffic/views
gh api repos/ritwikguhathakurta/global-meltdown-index/traffic/clones
gh api repos/ritwikguhathakurta/global-meltdown-index/traffic/popular/referrers
gh api repos/ritwikguhathakurta/global-meltdown-index/traffic/popular/paths
```

**GitHub's traffic API only returns a rolling 14-day window** — there's no way to backfill older
data than that, so missing a week means that week's referrer/view detail is gone for good. Capture
weekly, not "whenever you remember."

## Weekly tracking table

Fill this in by hand (or script the `gh api` calls above into it) — don't let it go longer than a
week between rows, for the reason above.

| Week of | Stars | Forks | Watchers | Open issues / PRs | 14d views | 14d unique visitors | 14d clones | What changed this week |
|---|---|---|---|---|---|---|---|---|
| 2026-10-22 (Day 0) | 0 | 0 | 1 | 0 / 0 | 0 | 0 | 2 | Baseline — README/onboarding rewrite merged, nothing posted anywhere yet |
| 2026-10-29 | | | | | | | | |
| 2026-11-05 | | | | | | | | |
| 2026-11-12 | | | | | | | | |
| 2026-11-19 (Day 28) | | | | | | | | |

## Secondary KPIs — product health, not vanity

Vanity metrics (stars/forks/views) say whether anyone looked. These say whether the thing is
actually healthy underneath, independent of traffic:

- Test pass rate: `npm run test:carry` + `test:derivatives` + `test:geopolitical` — 49/49 as of
  2026-10-22 (see `docs/growth/BASELINE_AUDIT.md`).
- Daily pipeline health — `ok`/`warning`/`failed` stage counts in `pipeline_runs` (`/admin`).
- **Issues or PRs opened by a non-owner account** — the first one of these, whenever it happens,
  is a more meaningful signal than any star count: it means a stranger engaged enough to act, not
  just look.

## What "success" looks like

No numeric target is set here on purpose — with a true zero baseline and no comparable launch to
benchmark against, a specific number (e.g. "100 stars by Day 30") would be invented, not derived
from anything real. Track direction and, wherever the referrer data allows it, attribute a change
to the specific thing that caused it (a specific post, not "growth in general").

## What not to do with these numbers

- Never buy or trade stars/forks/followers, or run "star for star" exchanges — against GitHub's
  Acceptable Use Policies and this project's own no-fabrication discipline.
- Never report a cherry-picked window (e.g. one good day) as if it were a trend.
- Don't attribute a change to a specific action unless the referrer data actually shows it; say
  "unclear" rather than guess.
