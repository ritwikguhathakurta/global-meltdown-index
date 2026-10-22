# Reddit drafts

Research behind each sub's rules: `docs/growth/COMMUNITY_RESEARCH.md`. Only Reddit's sitewide
Content Policy is confirmed firsthand — every per-subreddit rule below is secondhand and should be
re-checked against the live sidebar/wiki immediately before posting.

## r/SideProject

Lower-stakes, feedback-oriented tone matches this sub's actual culture better than a press-release
voice. Recommended as the lowest-risk first post of the whole launch.

**Title:**
> Built a free-data financial risk dashboard where every number traces back to its real source — looking for feedback

**Body:**
> Spent the last ~7 weeks building this after getting annoyed at "risk score" dashboards that don't
> show their work. Global Meltdown Index (https://globalmeltdownindex.net) computes 24 separate
> systemic-risk reads (credit, liquidity, sovereign debt, geopolitical, etc.) purely from free,
> official sources, and rolls them into one composite score.
>
> The constraint I set for myself: if a free source doesn't exist for something, the page says
> UNAVAILABLE instead of guessing. That honesty rule turned out to be the hardest part — it meant
> declining a few real data sources outright because their terms didn't allow this use.
>
> You can see it's real without signing up: `curl https://globalmeltdownindex.net/api/gfmi` returns
> live data. Code's on GitHub (Apache-2.0): https://github.com/ritwikguhathakurta/global-meltdown-index
>
> Genuinely want feedback on the onboarding/README — just rewrote it to lead with a live demo
> instead of a wall of methodology, curious if it actually lands for someone seeing this cold.

## r/opensource

**Title:**
> [Promotional] Global Meltdown Index — 24 free-data risk engines, Apache-2.0 licensed

**Body:**
> Open-sourcing the project I've been building: a systemic-risk dashboard scoring 24 independent
> engines (credit, liquidity, sovereign debt, geopolitical, etc.) purely from free/official data.
> Apache License 2.0. Contribution guide, PR template, and issue templates are already in the repo
> if anyone wants to add a data source or fix something:
> https://github.com/ritwikguhathakurta/global-meltdown-index

## r/programming — not recommended

Secondhand research describes this sub as effectively zero-tolerance for self-promotion. Don't post
the project link here directly; see `docs/growth/COMMUNITY_RESEARCH.md`.

## r/algotrading / r/quant — highest risk, needs your explicit sign-off

Closest to financial-advice territory. If used at all, frame strictly as a transparency/methodology
case study, never a trading signal, and re-read the live sub rules first — no draft is pre-written
here on purpose, since the framing needs to be gotten right case-by-case.
