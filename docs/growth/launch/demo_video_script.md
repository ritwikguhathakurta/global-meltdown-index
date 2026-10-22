# Demo video script (60-90 seconds)

**Not recorded.** This is a script to record from, per `docs/growth/DEMO_PLAN.md` item A. Timings
are approximate; adjust to how it actually feels when you record it.

## Script

**[0:00-0:10] Hook**
> "Most risk dashboards tell you a number. This one shows you exactly where it came from."

**[0:10-0:25] What GFMI is**
> Show the live `/dashboard` (or the `curl` demo if recording without a signed-in session). "This
> is the GFMI score — one number from 24 independent risk engines across the US, Canada, UK,
> Germany, France, Italy, Japan, and China. 72 today, which maps to 'Crisis Developing' — stage 5
> of 7."

**[0:25-0:40] How an engine contributes**
> Click into one engine (e.g. Credit). "Each engine has its own real drivers — here, US High-Yield
> OAS, straight from FRED. Click through and you'd land on the exact same series FRED itself
> publishes."

**[0:40-0:55] Inspect a real source and freshness badge**
> Point at a freshness badge. "LIVE, RECENT, STALE, or UNAVAILABLE — this one's STALE, and that's
> correct, not a bug: it's an annual series that hasn't published a new figure yet this year."

**[0:55-1:10] Distinguish signal from crisis**
> "This is a current risk signal, not a prediction. The API itself says so:" (show the
> `disclaimer` field in the JSON response). "No one here is telling you a crash date."

**[1:10-1:25] Where to find limitations**
> "Everything this project deliberately hasn't built yet is listed honestly, not hidden" — show
> `docs/SCOPE.md` for a second.

**[1:25-1:30] CTA**
> "It's open source, Apache-2.0. Link's in the description." (Show the GitHub URL on screen.)

## Rules for recording

- Every number shown on screen must be real, pulled from the live site at recording time — don't
  reuse a screenshot/number from an earlier date once recorded.
- Don't speed up, cut, or edit in a way that implies something loaded faster than it did.
- Don't record over test/mock data — if something is slow or shows `UNAVAILABLE` live, that's the
  honest demo; don't fake a faster or more complete result.
