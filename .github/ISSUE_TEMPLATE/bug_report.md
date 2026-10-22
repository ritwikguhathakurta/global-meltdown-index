---
name: Bug report
about: Something is broken or shows incorrect/stale data
title: ""
labels: bug
---

## What's wrong

<!-- Which page/engine/API route, and what you expected vs. what you saw. -->

## Is this actually a bug, or expected `STALE`/`UNAVAILABLE` behavior?

This project deliberately shows `STALE` for data that's genuinely old by its source's own
publication cadence (an annual debt/GDP ratio showing `STALE` by daily-data standards is usually
correct — see `src/lib/quality/freshness.ts`) and `UNAVAILABLE` for a spec'd indicator with no free
source. Before filing, check whether the behavior is already documented in the README's
[Scope](../../README.md#scope--whats-not-here-yet) section or the relevant `docs/*_ENGINE.md` file.

## Steps to reproduce

1.
2.

## Environment

- Production (globalmeltdownindex.net) or local dev?
- Browser/OS if UI-related; `curl` command if API-related.
