import type { MetricPoint } from "../metrics/store";

/**
 * Two genuinely new, live, free US Treasury cash-management data points for
 * the Global Treasury Risk Engine (treasuryRiskEngine.ts) — both verified
 * live against api.fiscaldata.treasury.gov before wiring in, not assumed
 * from documentation:
 *
 * operating_cash_balance: the Daily Treasury Statement's own Table I "Cash
 * Balance Details" — the Treasury General Account (TGA) closing balance,
 * literally the government's checking-account balance at the Fed. Quirk
 * confirmed by inspecting a live response: for the "Treasury General
 * Account (TGA) Closing Balance" row, the actual dollar figure comes back
 * in the `open_today_bal` field, not `close_today_bal` (which is always
 * "null" for this row in Treasury's own table layout) — this is Treasury's
 * own data shape, not a bug in this fetcher.
 *
 * debt_subject_to_limit: the Daily Treasury Statement's Table III-C "Debt
 * Subject to Limit" — gives both the Statutory Debt Limit itself and the
 * components needed to compute actual debt subject to that limit (Debt
 * Held by the Public + Intragovernmental Holdings, minus the categories
 * Treasury's own table excludes: Other Debt, Unamortized Discount, the
 * Federal Financing Bank, plus any Guaranteed Debt of Government Agencies
 * added back in). This produces a genuine debt-ceiling HEADROOM figure —
 * spec's own §147 explicitly requires tracking debt-limit status while
 * warning "Never create unsupported X-date forecasts," so this fetcher
 * stops at headroom (limit minus subject-to-limit debt) and does not
 * attempt to project a "X-date" exhaustion estimate.
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

type CashBalanceRow = {
  record_date: string;
  account_type: string;
  open_today_bal: string;
};

export async function fetchUsTgaBalance(): Promise<MetricPoint[]> {
  const url =
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance" +
    "?filter=account_type:eq:Treasury General Account (TGA) Closing Balance" +
    "&sort=-record_date&page%5Bsize%5D=400&fields=record_date,account_type,open_today_bal";
  const res = await fetchWithRetry(url);
  const json = (await res.json()) as { data: CashBalanceRow[] };
  const points: MetricPoint[] = [];
  for (const row of json.data ?? []) {
    const bal = parseFloat(row.open_today_bal);
    if (!Number.isNaN(bal)) {
      points.push({
        metric_key: "treasury.us_tga_balance_usd",
        observed_at: row.record_date,
        value: bal * 1_000_000, // Treasury reports in millions
        unit: "USD",
        source_key: "treasury_fiscal_data",
        source_tier: 1,
        frequency: "daily",
      });
    }
  }
  return points;
}

type DebtLimitRow = {
  record_date: string;
  debt_catg: string;
  debt_catg_desc: string;
  close_today_bal: string;
};

export async function fetchUsDebtLimitHeadroom(): Promise<MetricPoint[]> {
  const url =
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/debt_subject_to_limit" +
    "?sort=-record_date&page%5Bsize%5D=490&fields=record_date,debt_catg,debt_catg_desc,close_today_bal";
  const res = await fetchWithRetry(url);
  const json = (await res.json()) as { data: DebtLimitRow[] };
  const byDate = new Map<string, DebtLimitRow[]>();
  for (const row of json.data ?? []) {
    const list = byDate.get(row.record_date) ?? [];
    list.push(row);
    byDate.set(row.record_date, list);
  }
  const points: MetricPoint[] = [];
  for (const [date, rows] of byDate) {
    const val = (catg: string, desc?: string) => {
      const row = rows.find((r) => r.debt_catg === catg && (desc === undefined || r.debt_catg_desc === desc));
      const v = row ? parseFloat(row.close_today_bal) : NaN;
      return Number.isNaN(v) ? 0 : v;
    };
    const limit = val("Statutory Debt Limit");
    if (limit === 0) continue; // this date's rows didn't include a limit figure — skip rather than guess
    const heldByPublic = val("Debt Held by the Public");
    const intragov = val("Intragovernmental Holdings");
    const otherDebtNotSubject = val("Debt Not Subject to Limit", "Other Debt (-)");
    const unamortizedDiscount = val("Debt Not Subject to Limit", "Unamortized Discount (-)");
    const ffb = val("Debt Not Subject to Limit", "Federal Financing Bank (-)");
    const guaranteedAgencyDebt = val("Other Debt Subject to Limit", "Guaranteed Debt of Government Agencies");
    const subjectToLimit = heldByPublic + intragov - otherDebtNotSubject - unamortizedDiscount - ffb + guaranteedAgencyDebt;
    const headroom = limit - subjectToLimit;
    points.push({
      metric_key: "treasury.us_debt_limit_headroom_usd",
      observed_at: date,
      value: headroom * 1_000_000, // Treasury reports in millions
      unit: "USD",
      source_key: "treasury_fiscal_data",
      source_tier: 1,
      frequency: "daily",
    });
  }
  return points;
}

export async function fetchUsTreasuryCash(): Promise<MetricPoint[]> {
  const results: MetricPoint[] = [];
  try {
    results.push(...(await fetchUsTgaBalance()));
  } catch (e) {
    console.error(`US TGA balance: ${(e as Error).message}`);
  }
  try {
    results.push(...(await fetchUsDebtLimitHeadroom()));
  } catch (e) {
    console.error(`US debt limit headroom: ${(e as Error).message}`);
  }
  return results;
}
