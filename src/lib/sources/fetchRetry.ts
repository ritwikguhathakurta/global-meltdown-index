/** fetch() that retries on a dropped connection (network-level "fetch failed"/ECONNRESET, not an
 * HTTP error status) — some exchange sites reset connections from cloud IPs intermittently. */
export async function fetchRetry(url: string, init: RequestInit & { next?: { revalidate: number } }, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastError;
}
