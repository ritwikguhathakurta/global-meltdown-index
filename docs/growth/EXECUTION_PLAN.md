# 30-day execution plan — Global Meltdown Index

Growth master-plan Phase 11 deliverable. Status is marked honestly as of **2026-10-22** — a task is
only `VERIFIED COMPLETE` if it was actually checked (a command run, a live API call made, a diff
reviewed), never just because a file exists. This plan sits alongside, and is more granular than,
`docs/growth/CONTENT_CALENDAR.md` (which covers the posting/content side specifically) and
`docs/growth/PRIORITIZED_BACKLOG.md` (which scores opportunities by impact/effort rather than by
week).

Status values: `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `VERIFIED COMPLETE`.

## Week 1 — Audit and conversion

| Task | Priority | Impact | Effort | Dependencies | Files / actions | Verification | Status |
|---|---|---|---|---|---|---|---|
| Baseline audit | High | High | Low | None | `docs/growth/BASELINE_AUDIT.md` | Figures checked live against GitHub API, production site, repo files | **VERIFIED COMPLETE** |
| Positioning | High | Medium | Low | Baseline audit | `docs/growth/POSITIONING.md` | Every claim cross-checked against code/API, not asserted | **VERIFIED COMPLETE** |
| README conversion overhaul | High | High | Medium | Positioning | `README.md` | `npx tsc --noEmit`, `npm run lint`, anchors manually checked, live API responses re-verified | **VERIFIED COMPLETE** |
| GitHub metadata plan (recommendation only) | Medium | Medium | Low | None | `docs/growth/GITHUB_METADATA_PLAN.md` | Current live values pulled via `gh api` same day | **VERIFIED COMPLETE** |
| **Apply** GitHub metadata (description/homepage/topics) | Medium | Medium | Low | Metadata plan | Repo Settings / `gh api` PATCH | Re-fetch repo metadata after applying | **BLOCKED — awaiting your explicit approval** |
| Verify quick start | High | High | Low | None | README Quick start section | `npm install && npm run dev` run for real, `/login` returned genuine 200 | **VERIFIED COMPLETE** |
| Demo plan | High | High | Medium | Positioning | `docs/growth/DEMO_PLAN.md`, `docs/API_EXAMPLES.md`, `docs/ARCHITECTURE.md`, `scripts/demo.ts` | `npm run demo` run live against production; `tsc`/`lint` clean | **VERIFIED COMPLETE** (3 of 6 candidate assets built — see the plan for which 3 are deferred and why) |

## Week 2 — Technical proof

| Task | Priority | Impact | Effort | Dependencies | Files / actions | Verification | Status |
|---|---|---|---|---|---|---|---|
| Architecture + data provenance docs | High | High | Medium | Demo plan | `docs/ARCHITECTURE.md`, `docs/SCOPE.md` | Diagram cross-checked against actual pipeline code | **VERIFIED COMPLETE** |
| Validate a real API example | High | High | Low | Demo plan | `docs/API_EXAMPLES.md` | Every response captured live, not copied from memory | **VERIFIED COMPLETE** |
| Contributor onboarding | High | Medium | Medium | None | `CONTRIBUTING.md`, PR/issue templates, `docs/growth/CONTRIBUTOR_PLAN.md` | Templates render correctly on GitHub; CONTRIBUTING commands match `package.json` scripts | **VERIFIED COMPLETE** |
| LICENSE decision | High | High | Low | Owner decision | `/LICENSE`, `package.json` | GitHub's own license detection confirmed Apache-2.0 via `gh api` after adding | **VERIFIED COMPLETE** (2026-10-22) |
| Security policy | Medium | Low | Low | None | `/SECURITY.md` | File reviewed for accuracy against actual auth code | **VERIFIED COMPLETE** |
| Prepare launch assets | High | Medium | Medium | Positioning, Community research | `docs/growth/launch/*` | Each draft checked against the researched platform rules | **VERIFIED COMPLETE** (drafted; nothing published) |
| First technical blog post written | Medium | Medium | Medium | Content calendar | Dev.to post (the PostgREST pagination incident) | Published post reviewed against the actual code/incident before posting | **NOT STARTED** |

## Week 3 — Public distribution

| Task | Priority | Impact | Effort | Dependencies | Files / actions | Verification | Status |
|---|---|---|---|---|---|---|---|
| Publish blog post #1 | High | Medium | Medium | Blog post written | Dev.to | — | **NOT STARTED** — no content published yet |
| Show HN submission | High | High | Low | LICENSE (done), launch drafts (done) | `docs/growth/launch/launch_show_hn.md` | — | **NOT STARTED — awaiting your approval to post** |
| r/SideProject / IndieHackers posts | Medium | Medium | Low | Launch drafts | `docs/growth/launch/` | — | **NOT STARTED — awaiting your approval to post** |
| Product Hunt listing | Medium | Medium | Low | Launch drafts | `docs/growth/launch/launch_producthunt.md` | — | **NOT STARTED — awaiting your approval to post** |
| Fix onboarding blockers found from real feedback | Medium | Medium | Variable | Actual feedback existing | TBD | TBD | **BLOCKED — no feedback exists yet, since nothing's been posted** |
| File real good-first issues | Low | Low | Low | Contributor plan | GitHub Issues | — | **NOT STARTED — candidates drafted in `docs/growth/CONTRIBUTOR_PLAN.md`, awaiting your approval to file** |

## Week 4 — Learn and improve

| Task | Priority | Impact | Effort | Dependencies | Files / actions | Verification | Status |
|---|---|---|---|---|---|---|---|
| Review referral data | High | High | Low | Week 3 distribution happened | `docs/growth/METRICS.md` | `gh api .../traffic/popular/referrers` | **BLOCKED — no distribution has happened yet to generate referral data** |
| Compare content-format performance | Medium | Medium | Low | Week 3 happened | `docs/growth/METRICS.md` weekly table | Manual comparison of which post drove which referrer spike | **BLOCKED**, same reason |
| Ship a real improvement based on feedback | Medium | Medium | Variable | Real feedback existing | TBD | TBD | **BLOCKED**, same reason |
| Publish an honest progress summary | Medium | Low | Low | Day-30 metrics captured | New doc | Compare against Day-0 baseline in `METRICS.md` | **NOT STARTED** |
| Plan next 30 days | Medium | Low | Low | Progress summary | New doc | Based on what the retro actually found, not a repeat of this plan | **NOT STARTED** |

## Honest summary

Weeks 1-2 (audit, positioning, README, demo, docs, contributor infra, licensing, launch drafts) are
**substantially complete and verified**. Weeks 3-4 are **entirely unstarted by design** — nothing
has been posted, announced, or distributed anywhere, per the master plan's own rule that publication
requires explicit, separate approval. The three genuinely `BLOCKED` items in Week 1 and Week 3 (GitHub
metadata application, actual posting, filing real issues) are blocked specifically on your decision,
not on any remaining engineering work.
