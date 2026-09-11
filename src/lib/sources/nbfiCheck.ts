import { NBFI_MONITORING_REGISTRY, type NbfiMonitoringEntry } from "../data/nbfiRegistry";

/**
 * Automated freshness check for nbfiRegistry.ts — same "check the page,
 * flag needs_review, let a human re-verify and edit the registry" discipline
 * as centralBankFsrCheck.ts, kept as its own small module since the NBFI
 * registry's shape (one global entry, annual cadence) doesn't need that
 * file's RSS/manual branches.
 */

export type NbfiCheckStatus = "current" | "needs_review" | "check_failed";

export type NbfiCheckResult = {
  key: string;
  status: NbfiCheckStatus;
  note: string;
};

function normalizeHtml(html: string): string {
  let text = html.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)));
  return text.replace(/\s+/g, " ").trim();
}

async function checkEntry(entry: NbfiMonitoringEntry): Promise<NbfiCheckResult> {
  let html: string;
  try {
    const res = await fetch(entry.checkUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return { key: entry.key, status: "check_failed", note: `HTTP ${res.status} fetching ${entry.checkUrl}` };
    html = await res.text();
  } catch (e) {
    return { key: entry.key, status: "check_failed", note: `Fetch error: ${(e as Error).message}` };
  }

  const text = normalizeHtml(html);
  const match = text.match(new RegExp(entry.checkRegex));
  if (!match) {
    return {
      key: entry.key,
      status: "needs_review",
      note: `Expected pattern not found on ${entry.checkUrl} — page structure or report title format may have changed, or a newer edition replaced it.`,
    };
  }
  const found = match[1];
  if (found !== entry.checkExpected) {
    return {
      key: entry.key,
      status: "needs_review",
      note: `Listing now shows "${found}" — registry has "${entry.checkExpected}". A newer edition is likely out; verify and update nbfiRegistry.ts.`,
    };
  }
  return { key: entry.key, status: "current", note: `Confirmed "${found}" still current as of this check.` };
}

export async function runNbfiChecks(): Promise<NbfiCheckResult[]> {
  return Promise.all(NBFI_MONITORING_REGISTRY.map(checkEntry));
}
