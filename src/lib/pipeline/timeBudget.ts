/**
 * Wall-clock budget guard for sequential, per-item ingest loops (World Bank
 * WDI indicators, IMF WEO/GDD per-country fetches, BIS/PIP per-country
 * fetches for 14 EM economies, IMF fiscal data for 7 G7 economies...).
 * These loop over many items ONE AT A TIME on purpose — several of the
 * underlying APIs (World Bank's own docs/behavior, confirmed directly and
 * documented in worldBankEmDebt.ts) rate-limit rapid concurrent bursts, so
 * parallelizing them would trade a timeout risk for a rate-limit-failure
 * risk. Each item can also retry up to 3 times with backoff on a flaky call
 * (20-25s timeout per attempt) — normally fast, but on a bad day for a
 * flaky upstream API (this project has repeatedly documented World Bank and
 * IMF both doing this), several slow/retried items in the same loop can add
 * up to minutes even though nothing is actually broken.
 *
 * The whole pipeline runs inside one Vercel serverless function
 * (/api/cron/pipeline) with a hard 300-second ceiling. If ANY stage runs
 * past it, Vercel kills the ENTIRE function mid-flight — not just the slow
 * stage — silently dropping whatever every OTHER concurrently-running stage
 * hadn't finished writing yet too, with no error logged anywhere. This is
 * the actual mechanism behind "EM Debt / G7 Debt data just stops showing
 * up": one flaky upstream API on one cron run can blank out unrelated
 * engines in the same run.
 *
 * Every sequential multi-item fetch loop in this project should check a
 * shared deadline (via `budgetDeadline`/`pastDeadline` below) before
 * starting its next item and stop early — returning whatever it already
 * fetched, which is always 100% real data, never padded, estimated or
 * backfilled — rather than let one bad day of upstream flakiness threaten
 * the rest of that run. ingest.ts additionally wraps every stage in
 * `withStageTimeout` as a second, independent safety net: even a future
 * ingest function that forgets this budget check still can't block the
 * overall pipeline past a bounded time, and still gets a logged
 * pipeline_runs row instead of silently vanishing.
 */

export function budgetDeadline(ms: number): number {
  return Date.now() + ms;
}

export function pastDeadline(deadline: number): boolean {
  return Date.now() >= deadline;
}
