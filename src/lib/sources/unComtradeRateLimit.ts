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
// 429s) and looked safe — but that only measures burst tolerance, not a
// sustained rate. Live-tested directly against the real API on the
// registered tier: 30 sequential calls at 400ms apart succeeded for the
// first ~20 (roughly 16s of sustained traffic) before every subsequent call
// 429'd — a real, lower SUSTAINED ceiling than the burst test suggested,
// and exactly consistent with pipeline_runs still showing "rate limited
// after retries" on this stage even after the cross-stage serialization
// fix below was deployed. 1000ms keeps sustained throughput comfortably
// under the ~1.25 req/s wall actually observed.
const MIN_GAP_MS = UN_COMTRADE_SUBSCRIPTION_KEY ? 1000 : 3000;

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
