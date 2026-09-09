import type { MetricPoint } from "../metrics/store";

/**
 * Three genuinely new, live, free, official US Treasury-market data points
 * for the G7 Sovereign Debt engine — the single most emphasized country in
 * the 106-section spec this engine is built against (its own §40 calls for
 * a separate "US Treasury Systemic Engine" tracking exactly these things:
 * auction demand, Fed holdings, debt held by public). All three verified
 * live before wiring in, not assumed from documentation:
 *
 * debt_to_penny: Treasury's own "Debt to the Penny" dataset
 * (api.fiscaldata.treasury.gov, free, no key) — the actual US federal debt
 * level (total, held-by-public, intragovernmental), updated daily. This is
 * a raw USD level, not a ratio — kept as its own series (debt/GDP already
 * comes from FRED, see treasury.ts) so it can support the debt-to-the-penny
 * split the spec explicitly asks for without duplicating the ratio.
 *
 * auction_stress: the same Fiscal Data API's "auctions_query" dataset —
 * real per-auction results for the 10-Year Note and 30-Year Bond (the two
 * tenors markets watch most closely for term-premium/fiscal-risk signals).
 * Tracks bid-to-cover ratio and indirect-bidder share (a foreign/overseas-
 * investor demand proxy) for the most recently COMPLETED auction of each
 * tenor — the API returns already-announced-but-not-yet-auctioned future
 * auctions with null result fields, so this walks back through recent
 * auctions of that original_security_term until it finds one with a
 * non-null bid_to_cover_ratio, rather than assuming the first row is
 * populated.
 *
 * fed_soma_treasury_holdings: the New York Fed's own SOMA (System Open
 * Market Account) holdings summary (markets.newyorkfed.org, free, no key,
 * weekly, back to 2003) — the Fed's own holdings of Treasury notes/bonds/
 * bills/TIPS/FRNs (deliberately excluding MBS/CMBS/agency debt, which are
 * not Treasury securities). This is the free, genuine "central-bank
 * holdings of sovereign debt" input the spec's §30 "Central Bank Balance
 * Sheet Engine" asks for — divided by Treasury's own total public debt
 * outstanding (from debt_to_penny above) at read time in g7DebtRegime.ts to
 * get a Fed-holdings share, never stored as its own pre-computed ratio.
 *
 * NOT attempted for the other six G7 countries this pass: Japan's MOF
 * publishes JGB auction results, but not at a stable, guessable CSV/JSON
 * endpoint the way its yield curve is (checked directly — the obvious
 * calendar/results URLs 404); the UK DMO's XML report API exists but its
 * report-code scheme wasn't identified within reasonable effort; Germany,
 * France, Italy and Canada have no equivalently open auction-result API
 * verified live. Building seven working national auction integrations is a
 * real, large effort — this pass gets the single most systemically
 * important one right rather than guessing at the other six.
 */

const commonHeaders = { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" };

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const res = await fetch(url, { headers: commonHeaders, next: { revalidate: 0 }, signal: controller.signal });
        if (res.ok) return res;
        lastError = new Error(`HTTP ${res.status}`);
      } finally {
        clearTimeout(timeout);
      }
    } catch (e) {
      lastError = e;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

type DebtToPennyRow = {
  record_date: string;
  debt_held_public_amt: string;
  intragov_hold_amt: string;
  tot_pub_debt_out_amt: string;
};

export async function fetchUsDebtToPenny(): Promise<MetricPoint[]> {
  const url =
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page%5Bsize%5D=30";
  const res = await fetchWithRetry(url);
  const json = (await res.json()) as { data: DebtToPennyRow[] };
  const points: MetricPoint[] = [];
  for (const row of json.data ?? []) {
    const total = parseFloat(row.tot_pub_debt_out_amt);
    const public_ = parseFloat(row.debt_held_public_amt);
    const intragov = parseFloat(row.intragov_hold_amt);
    if (!Number.isNaN(total)) {
      points.push({ metric_key: "g7.us.debt_total_usd", observed_at: row.record_date, value: total, unit: "USD", source_key: "treasury_fiscal_data", source_tier: 1, frequency: "daily" });
    }
    if (!Number.isNaN(public_)) {
      points.push({ metric_key: "g7.us.debt_held_by_public_usd", observed_at: row.record_date, value: public_, unit: "USD", source_key: "treasury_fiscal_data", source_tier: 1, frequency: "daily" });
    }
    if (!Number.isNaN(intragov)) {
      points.push({ metric_key: "g7.us.debt_intragovernmental_usd", observed_at: row.record_date, value: intragov, unit: "USD", source_key: "treasury_fiscal_data", source_tier: 1, frequency: "daily" });
    }
  }
  return points;
}

type AuctionRow = {
  auction_date: string;
  high_yield: string | null;
  bid_to_cover_ratio: string | null;
  total_accepted: string | null;
  indirect_bidder_accepted: string | null;
};

async function fetchLatestCompletedAuction(securityType: "Note" | "Bond", originalTerm: string): Promise<AuctionRow | null> {
  const url = `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query?filter=security_type:eq:${securityType},original_security_term:eq:${originalTerm}&sort=-auction_date&page%5Bsize%5D=8&fields=auction_date,high_yield,bid_to_cover_ratio,total_accepted,indirect_bidder_accepted`;
  const res = await fetchWithRetry(url);
  const json = (await res.json()) as { data: AuctionRow[] };
  for (const row of json.data ?? []) {
    if (row.bid_to_cover_ratio !== null && row.bid_to_cover_ratio !== "null") return row;
  }
  return null;
}

export async function fetchUsAuctionStress(): Promise<MetricPoint[]> {
  const points: MetricPoint[] = [];
  const tenors: { key: string; securityType: "Note" | "Bond"; originalTerm: string }[] = [
    { key: "10y", securityType: "Note", originalTerm: "10-Year" },
    { key: "30y", securityType: "Bond", originalTerm: "30-Year" },
  ];
  for (const t of tenors) {
    const row = await fetchLatestCompletedAuction(t.securityType, t.originalTerm);
    if (!row) continue;
    const btc = parseFloat(row.bid_to_cover_ratio ?? "");
    if (!Number.isNaN(btc)) {
      points.push({ metric_key: `g7.us.auction_${t.key}_bid_to_cover`, observed_at: row.auction_date, value: btc, unit: "x", source_key: "treasury_fiscal_data", source_tier: 1, frequency: "monthly" });
    }
    const yieldV = parseFloat(row.high_yield ?? "");
    if (!Number.isNaN(yieldV)) {
      points.push({ metric_key: `g7.us.auction_${t.key}_high_yield`, observed_at: row.auction_date, value: yieldV, unit: "%", source_key: "treasury_fiscal_data", source_tier: 1, frequency: "monthly" });
    }
    const total = parseFloat(row.total_accepted ?? "");
    const indirect = parseFloat(row.indirect_bidder_accepted ?? "");
    if (!Number.isNaN(total) && total > 0 && !Number.isNaN(indirect)) {
      points.push({ metric_key: `g7.us.auction_${t.key}_indirect_pct`, observed_at: row.auction_date, value: (indirect / total) * 100, unit: "%", source_key: "treasury_fiscal_data", source_tier: 1, frequency: "monthly" });
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return points;
}

type SomaRow = {
  asOfDate: string;
  tips: string;
  frn: string;
  tipsInflationCompensation: string;
  notesbonds: string;
  bills: string;
};

export async function fetchFedSomaTreasuryHoldings(): Promise<MetricPoint[]> {
  const res = await fetchWithRetry("https://markets.newyorkfed.org/api/soma/summary.json");
  const json = (await res.json()) as { soma: { summary: SomaRow[] } };
  const rows = (json.soma?.summary ?? []).slice(-52); // ~1 year of weekly history is plenty for a z-score baseline
  const points: MetricPoint[] = [];
  for (const row of rows) {
    const parts = [row.tips, row.frn, row.tipsInflationCompensation, row.notesbonds, row.bills].map((s) => parseFloat(s || "0"));
    if (parts.some((v) => Number.isNaN(v))) continue;
    const treasuryHoldings = parts.reduce((a, b) => a + b, 0);
    points.push({
      metric_key: "g7.us.fed_treasury_holdings_usd",
      observed_at: row.asOfDate,
      value: treasuryHoldings,
      unit: "USD",
      source_key: "ny_fed_soma",
      source_tier: 1,
      frequency: "weekly",
    });
  }
  return points;
}

export async function fetchUsTreasuryLiveData(): Promise<MetricPoint[]> {
  const results: MetricPoint[] = [];
  try {
    results.push(...(await fetchUsDebtToPenny()));
  } catch (e) {
    console.error(`Treasury debt to the penny: ${(e as Error).message}`);
  }
  try {
    results.push(...(await fetchUsAuctionStress()));
  } catch (e) {
    console.error(`Treasury auction stress: ${(e as Error).message}`);
  }
  try {
    results.push(...(await fetchFedSomaTreasuryHoldings()));
  } catch (e) {
    console.error(`NY Fed SOMA holdings: ${(e as Error).message}`);
  }
  return results;
}
