# Demo plan — Global Meltdown Index

Growth master-plan Phase 5 deliverable. Evaluates the six candidate demonstration assets the plan
names (A-F), against actual risk/effort, and records what was built, what was deferred, and why.
Nothing below fabricates a result that doesn't exist — where an asset isn't built, it's marked as
such, not implied to exist via a vague description.

## A. 60-90 second walkthrough video

**Status: not built.** Needs real screen-recording tooling and a scripted narration — out of scope
for an automated/text-based work session. **A full script is drafted and ready to record**:
`docs/growth/launch/demo_video_script.md`. Recording it is a manual follow-up task for you.

## B. Static architecture diagram

**Status: built.** `docs/ARCHITECTURE.md` — a Mermaid flowchart covering sources → ingestion
pipeline → `metric_series` → engine computation → GFMI composite → public API / dashboard, plus the
GitHub Actions cron paths. Linked from the README's Architecture notes section. This was the
lowest-risk, highest-clarity asset on the list and was prioritized first.

## C. Screenshot gallery

**Status: not built.** No screenshots exist anywhere in the repository
(`docs/growth/BASELINE_AUDIT.md` confirmed this by searching for `.png`/`.jpg`/`.gif`). Capturing
real screenshots of the signed-in dashboard requires an authenticated browser session against
either production or a local dev instance with real Supabase credentials — not something to
fabricate or mock up. **Recommended next step**: sign in locally or on the live site, capture 3-4
real screenshots (Overview/GFMI page, one engine detail page, the Geopolitical or Derivatives tab
layout), and add them to the README's hero section. Flagged for you to do (or ask for help with,
with real credentials available) rather than invented here.

## D. Worked research example

**Status: built, lightweight version.** README's "Inspect a real signal, source to score" section
traces one real indicator (`credit.hy_oas`, FRED series `BAMLH0A0HYM2`) from its public source
through to its contribution in the live GFMI score, with a `curl` command the reader can run
themselves. This is narrower than a full "worked research example" (e.g. a multi-indicator case
study with a historical event), which would need real historical dates/observations verified
against source records first — not attempted this pass to avoid rushing a claim that needs careful
verification. A fuller case study is a candidate for the first technical blog post (see
`docs/growth/CONTENT_CALENDAR.md` Week 2/3) rather than the README itself.

## E. Sample API query with a real verified JSON response

**Status: built.** `docs/API_EXAMPLES.md` — six endpoints (`/api/health`, `/api/gfmi`,
`/api/credit`, `/api/leading-indicators`, `/api/sources`), every response captured live against
production on 2026-10-22, not copied from documentation examples. `scripts/demo.ts` (`npm run
demo`) additionally gives a scripted, runnable version of the same walkthrough.

## F. Educational guide on investigating a signal without overstating it

**Status: partially built.** The README's "What the GFMI score means" section explains the 0-100
scale, the seven named stages, and explicitly states the signal-vs-forecast distinction
("`confidence`... reflects data completeness and freshness, not certainty about the future").
This covers the core of what F asks for, but a longer, dedicated guide (e.g. "how to read a STALE
badge," "what a rising z-score does and doesn't tell you") doesn't exist as its own document.
**Not built this pass** — a real candidate for `docs/growth/CONTENT_CALENDAR.md`'s blog content
rather than a rushed addition here.

## Priority ranking actually used

Built in this order, by (impact ÷ effort, lowest risk of being wrong first):

1. **E** (API examples) — zero risk, pure verification against live data.
2. **B** (architecture diagram) — zero risk, derived entirely from existing code/docs.
3. **D** (lightweight signal walkthrough) — low risk, one verified example rather than a historical
   case study that would need more verification.
4. **F** (partial — folded into the GFMI explainer rather than a separate guide).
5. **A** (video script only, not recorded) and **C** (screenshot gallery) — deferred because both
   need a manual, human step (recording audio/video; signing into a real session to screenshot) that
   an automated session shouldn't fabricate a substitute for.

## What's explicitly not done, and the next concrete action for each

| Asset | Next concrete action | Owner |
|---|---|---|
| A — video | Record using `docs/growth/launch/demo_video_script.md` | You (manual) |
| C — screenshots | Sign in (locally or live), capture 3-4 real screenshots, add to README hero | You (needs real credentials) |
| D — full case study | Pick one real historical date/event, verify against source records, write as blog post #1-3 | Content calendar, Week 2-4 |
| F — full guide | Write as a standalone doc once there's evidence anyone's asking the underlying questions | Deferred, no urgency signal yet |
