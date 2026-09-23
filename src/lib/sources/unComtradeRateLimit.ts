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
const MIN_GAP_MS = UN_COMTRADE_SUBSCRIPTION_KEY ? 400 : 2000;

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
