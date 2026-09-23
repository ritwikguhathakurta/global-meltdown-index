/**
 * UN Comtrade's per-key/per-IP rate limit is one shared account-wide budget,
 * but the daily pipeline (ingest.ts) runs three independent consumers of it
 * concurrently in the same invocation — unComtrade.ts (energy + oleochemical
 * flows), unComtradeCommodityTrade.ts (USGS country trade) and
 * unComtradeChemicalPrices.ts (chemical HS unit values). Each already paces
 * its own sequential calls with a fixed delay tuned against solo burst-tests,
 * but three modules pacing themselves independently and firing at the same
 * time still add up to 2-3x the request rate any one of them was tuned for —
 * exactly the persistent 429s seen in production (pipeline_runs: all four
 * stages rate-limiting most days). This gate serializes every actual HTTP
 * call to comtradeapi.un.org, from any module, through one shared clock, so
 * the real aggregate rate never exceeds a single caller's budget regardless
 * of how many stages happen to be mid-flight at once. It only ever adds wait
 * time on top of each module's existing delay — it never removes one.
 */
const UN_COMTRADE_SUBSCRIPTION_KEY = process.env.UN_COMTRADE_SUBSCRIPTION_KEY;
// The original 400ms figure came from a short burst test (5 rapid calls, no
// 429s) — that only measures burst tolerance, not a sustained rate, and
// this endpoint turns out to behave like a rolling-window token bucket
// (roughly N requests per ~60s window), not a smooth per-second rate — so a
// short burst test always looks safe right up until the bucket empties.
// Two rounds of live sustained testing against the real API on the
// registered tier nailed the actual shape:
//   - 400ms gap: 30 sequential calls, first ~20 succeeded (~16s elapsed),
//     then every call 429'd — a real ceiling near ~20 requests per rolling
//     window, not the ~2.5 req/s the gap implies.
//   - 1000ms gap: deployed as the fix for the above, but pipeline_runs
//     still showed the exact same "rate limited after retries" failure —
//     60 req/min still overshoots a ~20-per-window bucket by 3x.
//   - 3000ms gap: 25 sequential calls, ALL succeeded over 91s elapsed —
//     this is the first setting that actually held under sustained load,
//     confirmed live, not assumed.
// 3000ms is what's shipped. The unkeyed tier's own doc comment already
// describes it as 429-ing after just 2-3 rapid calls (i.e. a much smaller
// bucket) — 5000ms is a conservative scale-up from the now-confirmed keyed
// figure, not independently sustained-tested (this deployment has a key
// configured, so the unkeyed path is rarely exercised in practice).
const MIN_GAP_MS = UN_COMTRADE_SUBSCRIPTION_KEY ? 3000 : 5000;

let queue: Promise<void> = Promise.resolve();
let lastCallAt = 0;

export function throttleComtradeCall(): Promise<void> {
  const turn = queue.then(async () => {
    const wait = lastCallAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
  });
  queue = turn.catch(() => {});
  return turn;
}

/**
 * Thrown by any of the four consumer modules when a single call still 429s
 * after its own retry/backoff sequence — meaning the shared rolling-window
 * bucket documented above is exhausted RIGHT NOW, most likely by another of
 * the four stages' calls landing earlier in the same shared queue during
 * this same pipeline run. Distinct from each module's own daily-quota error
 * (a 403, which resets on a fixed schedule): this is a short-term
 * exhaustion that clears within the rolling window, so every remaining item
 * in that stage's loop is guaranteed to fail the same way if retried
 * immediately — the caller should stop and defer the rest to the next run
 * (same "stop early, resume from here" contract as the daily-quota error),
 * not keep burning its stage-timeout budget on calls that cannot succeed
 * yet. Confirmed live: before this existed, un-classified 429-after-retries
 * failures were treated as an ordinary per-item error and the loop kept
 * going, which is exactly what turned three of the four stages'
 * (oleochemical flows, USGS country trade, chemical HS unit values) 429s
 * into full stage-timeout abandonments instead of a clean early stop.
 */
export class ComtradeRateLimitedError extends Error {}
