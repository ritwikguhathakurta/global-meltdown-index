# GitHub metadata plan — Global Meltdown Index

Growth master-plan Phase 4 deliverable. Everything below is a **recommendation**, not an applied
change — repository description, Topics, and homepage are GitHub-side settings
(`docs/growth/PRIORITIZED_BACKLOG.md` item #5, flagged **Decision Needed — GitHub settings change**)
and per this campaign's operating rules, none of them get changed without your explicit go-ahead on
the specific change. Current live values were re-checked via `gh api` on 2026-10-22, same day as
this plan, so nothing here is stale.

## Current state (verified live, 2026-10-22)

| Field | Current value |
|---|---|
| Description | "Global Financial Market Data (Debt, Equity, Crypto)" |
| Homepage | `https://global-meltdown-index.vercel.app` |
| Topics | none (`[]`) |
| License (GitHub's own detection) | **Apache-2.0** — correctly auto-detected from `/LICENSE`, added 2026-10-22 |
| Discussions | disabled |

## Recommended changes

### 1. Description

> Current: "Global Financial Market Data (Debt, Equity, Crypto)" — generic, undersells the product,
> doesn't mention what's actually distinctive (24 engines, free-data-only, traceable).

**Proposed** (127 characters, fits GitHub's description field cleanly):
> Open-source systemic-risk terminal: 24 free-data risk engines across G7 + China, one transparent composite score, public API.

### 2. Homepage URL

> Current: the raw Vercel deployment URL, not the project's real domain.

**Proposed**: `https://globalmeltdownindex.net` — matches every link already used throughout the
README and growth docs; the Vercel URL is an implementation detail, not the public-facing identity.

### 3. Topics

GitHub's own guidance (and the master plan's instruction) is to pick an accurate, specific subset
rather than add every plausible keyword. Validated against the actual implementation, not
assumed — each one below is something the repo genuinely is, checked against
`docs/growth/BASELINE_AUDIT.md` and the engine registry:

**Proposed (12):** `systemic-risk` `macro-finance` `financial-risk` `financial-data`
`sovereign-debt` `liquidity-risk` `quantitative-finance` `financial-intelligence` `open-source`
`typescript` `nextjs` `supabase`

**Considered and dropped** (redundant with the above, or not accurate): `global-financial-markets`
(redundant with `financial-data`/`financial-risk`), `macroeconomics` (redundant with
`macro-finance`), `market-risk` (redundant with `financial-risk`), `fintech` (this is a research/
transparency tool, not a financial product in the fintech-app sense — using the tag would overclaim
what it is).

### 4. Badges (README) — reviewed, no change needed

Next.js / TypeScript / Supabase / Live / License badges are all genuine and already maintainable
(each reflects something actually true and checkable: real framework, real language, real database,
real live URL, real license file). No badge was found that needed removing as unverifiable, and no
new badge is recommended — a CI badge would be premature since there's no CI workflow yet
(`docs/growth/PRIORITIZED_BACKLOG.md` item #7).

### 5. Social preview (OG) image

Not customized — GitHub's auto-generated code preview is the current share image
(`docs/growth/BASELINE_AUDIT.md`). Still not built; a genuine screenshot-based image would need the
screenshot work in `docs/growth/DEMO_PLAN.md` done first, not a generic stock graphic. Backlog item
#14, unchanged status.

### 6. Releases

No releases exist yet. Recommend tagging **v0.1.0** once you're ready to treat the README/
LICENSE/growth-docs work as a real milestone — release notes should describe what's actually in the
tagged commit, not aspirational scope. Not done as part of this plan; creating a release is a
visible, public action and needs your separate go-ahead (same category as any other publish).

### 7. Contribution infrastructure — already done, confirmed present

| Item | Status |
|---|---|
| `CONTRIBUTING.md` | Done |
| Pull-request template | Done (`.github/PULL_REQUEST_TEMPLATE.md`) |
| Bug-report issue template | Done (`.github/ISSUE_TEMPLATE/bug_report.md`) |
| Data-source-proposal issue template | Done (`.github/ISSUE_TEMPLATE/data_source_proposal.md`) |
| Security policy | Added alongside this plan — see `/SECURITY.md` |
| CODE_OF_CONDUCT.md | Not present — not built this pass; low urgency for a single-maintainer repo with no community yet, revisit once external contributors appear |

### 8. GitHub Discussions

Currently disabled. Recommend enabling once there's a reason for someone to use it (e.g. the first
real external question) rather than pre-seeding empty categories — an empty Discussions tab is a
weaker signal than no Discussions tab. This is a GitHub settings toggle
(`docs/growth/PRIORITIZED_BACKLOG.md` item #12) — **Decision Needed**, not applied here.

### 9. Pinned items / profile

No evidence of a GitHub profile README repo (`ritwikguhathakurta/ritwikguhathakurta`) was checked
this pass — not in scope for this plan; flagged as **UNKNOWN**, would need a direct check of that
repo's existence to make a recommendation.

## What would need to change to apply this plan

All of section 1-3 (description, homepage, topics) can be applied with:
```bash
gh api -X PATCH repos/ritwikguhathakurta/global-meltdown-index \
  -f description="Open-source systemic-risk terminal: 24 free-data risk engines across G7 + China, one transparent composite score, public API." \
  -f homepage="https://globalmeltdownindex.net"
gh api -X PUT repos/ritwikguhathakurta/global-meltdown-index/topics \
  -f names[]=systemic-risk -f names[]=macro-finance -f names[]=financial-risk \
  -f names[]=financial-data -f names[]=sovereign-debt -f names[]=liquidity-risk \
  -f names[]=quantitative-finance -f names[]=financial-intelligence -f names[]=open-source \
  -f names[]=typescript -f names[]=nextjs -f names[]=supabase
```
Not run — this is the exact command, ready for you to approve or run yourself.
