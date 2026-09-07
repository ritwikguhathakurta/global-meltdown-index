import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertMetrics } from "../metrics/store";
import { FRED_SERIES, fetchFredSeries } from "../sources/fred";
import { fetchFxCrossSeries } from "../sources/fx";
import { YAHOO_INDEX_SERIES, fetchYahooIndexSeries } from "../sources/yahooIndex";
import { COT_MARKETS, fetchCotSeries } from "../sources/cftcCot";
import { CENTRAL_BANK_FEEDS, fetchCentralBankFeed } from "../sources/centralBankRss";
import { fetchGscpiSeries } from "../sources/gscpi";
import { fetchGprSeries } from "../sources/gpr";
import { fetchCryptoSnapshot } from "../sources/coingecko";
import { CLOUD_STATUS_FEEDS, fetchCloudStatusCount, fetchCloudStatusBackfill, MIN_BACKFILL_OBSERVATIONS } from "../sources/cloudStatus";
import { AI_COMPANIES, fetchSecEdgarCompanyMetrics } from "../sources/secEdgar";
import { fetchGermanyYield10y, fetchUkYield10y, fetchCanadaYield10y } from "../sources/govBondYields";
import { fetchChinaYield10y } from "../sources/chinaBondYield";
import { fetchChinaCreditGap } from "../sources/bisCreditGap";
import { fetchChinaLgfvDebt } from "../sources/imfAugmentedDebt";
import { fetchChinaMonthlyReleases, GOV_CN_BACKFILL_PAGE_LIMIT, GOV_CN_APPEND_PAGE_LIMIT, MIN_GOV_CN_OBSERVATIONS } from "../sources/govCnStatistics";
import { lookbackDaysFor } from "../metrics/lookback";

export type IngestStageResult = { stage: string; status: "ok" | "warning" | "failed"; detail: Record<string, unknown> };

async function logRun(db: SupabaseClient, runDate: string, stage: string, status: string, detail: unknown) {
  await db.from("pipeline_runs").insert({ run_date: runDate, stage, status, detail, finished_at: new Date().toISOString() });
}

export async function ingestFred(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    await logRun(db, runDate, "ingest_fred", "warning", { reason: "FRED_API_KEY not set" });
    return { stage: "ingest_fred", status: "warning", detail: { reason: "FRED_API_KEY not set" } };
  }
  let ok = 0;
  const errors: string[] = [];
  for (const def of FRED_SERIES) {
    try {
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - lookbackDaysFor(def.frequency));
      const points = await fetchFredSeries(def, apiKey, since.toISOString());
      await upsertMetrics(db, points);
      ok++;
    } catch (e) {
      errors.push(`${def.seriesId}: ${(e as Error).message}`);
    }
  }
  const status = errors.length === 0 ? "ok" : ok > 0 ? "warning" : "failed";
  await logRun(db, runDate, "ingest_fred", status, { ok, total: FRED_SERIES.length, errors });
  return { stage: "ingest_fred", status, detail: { ok, total: FRED_SERIES.length, errors } };
}

export async function ingestFx(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 400);
  try {
    const points = await fetchFxCrossSeries(since.toISOString());
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    await logRun(db, runDate, "ingest_fx", status, { points: points.length });
    return { stage: "ingest_fx", status, detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_fx", "failed", detail);
    return { stage: "ingest_fx", status: "failed", detail };
  }
}

export async function ingestYahooIndices(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  let ok = 0;
  const errors: string[] = [];
  for (const def of YAHOO_INDEX_SERIES) {
    try {
      const points = await fetchYahooIndexSeries(def);
      if (points.length === 0) {
        errors.push(`${def.symbol}: no data returned`);
        continue;
      }
      await upsertMetrics(db, points);
      ok++;
    } catch (e) {
      errors.push(`${def.symbol}: ${(e as Error).message}`);
    }
  }
  const status = errors.length === 0 ? "ok" : ok > 0 ? "warning" : "failed";
  await logRun(db, runDate, "ingest_yahoo_indices", status, { ok, total: YAHOO_INDEX_SERIES.length, errors });
  return { stage: "ingest_yahoo_indices", status, detail: { ok, total: YAHOO_INDEX_SERIES.length, errors } };
}

export async function ingestCftc(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 400);
  let ok = 0;
  const errors: string[] = [];
  for (const def of COT_MARKETS) {
    try {
      const points = await fetchCotSeries(def, since.toISOString());
      await upsertMetrics(db, points);
      ok++;
    } catch (e) {
      errors.push(`${def.marketName}: ${(e as Error).message}`);
    }
  }
  const status = errors.length === 0 ? "ok" : ok > 0 ? "warning" : "failed";
  await logRun(db, runDate, "ingest_cftc", status, { ok, total: COT_MARKETS.length, errors });
  return { stage: "ingest_cftc", status, detail: { ok, total: COT_MARKETS.length, errors } };
}

export async function ingestCentralBankFeeds(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  let ok = 0;
  let inserted = 0;
  const errors: string[] = [];
  for (const def of CENTRAL_BANK_FEEDS) {
    try {
      const events = await fetchCentralBankFeed(def);
      if (events.length > 0) {
        const { error, count } = await db
          .from("central_bank_events")
          .upsert(events, { onConflict: "institution,source_url", count: "exact" });
        if (error) throw new Error(error.message);
        inserted += count ?? events.length;
      }
      ok++;
    } catch (e) {
      errors.push(`${def.institution}: ${(e as Error).message}`);
    }
  }
  const status = errors.length === 0 ? "ok" : ok > 0 ? "warning" : "failed";
  await logRun(db, runDate, "ingest_central_bank_feeds", status, { ok, total: CENTRAL_BANK_FEEDS.length, inserted, errors });
  return { stage: "ingest_central_bank_feeds", status, detail: { ok, total: CENTRAL_BANK_FEEDS.length, inserted, errors } };
}

export async function ingestGscpi(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchGscpiSeries();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    await logRun(db, runDate, "ingest_gscpi", status, { points: points.length });
    return { stage: "ingest_gscpi", status, detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_gscpi", "failed", detail);
    return { stage: "ingest_gscpi", status: "failed", detail };
  }
}

export async function ingestGpr(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchGprSeries();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    await logRun(db, runDate, "ingest_gpr", status, { points: points.length });
    return { stage: "ingest_gpr", status, detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_gpr", "failed", detail);
    return { stage: "ingest_gpr", status: "failed", detail };
  }
}

export async function ingestCrypto(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchCryptoSnapshot(runDate);
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    await logRun(db, runDate, "ingest_crypto", status, { points: points.length });
    return { stage: "ingest_crypto", status, detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_crypto", "failed", detail);
    return { stage: "ingest_crypto", status: "failed", detail };
  }
}

export async function ingestCloudStatus(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  let ok = 0;
  let backfilled = 0;
  const errors: string[] = [];
  for (const def of CLOUD_STATUS_FEEDS) {
    try {
      const { count, error: countError } = await db
        .from("metric_series")
        .select("observed_at", { count: "exact", head: true })
        .eq("metric_key", def.metricKey);
      if (countError) throw new Error(`row count check: ${countError.message}`);
      const needsBackfill = (count ?? 0) < MIN_BACKFILL_OBSERVATIONS;
      const points = needsBackfill ? await fetchCloudStatusBackfill(def, runDate) : await fetchCloudStatusCount(def, runDate);
      await upsertMetrics(db, points);
      ok++;
      if (needsBackfill && points.length > 1) backfilled++;
    } catch (e) {
      errors.push(`${def.provider}: ${(e as Error).message}`);
    }
  }
  const status = errors.length === 0 ? "ok" : ok > 0 ? "warning" : "failed";
  await logRun(db, runDate, "ingest_cloud_status", status, { ok, total: CLOUD_STATUS_FEEDS.length, backfilled, errors });
  return { stage: "ingest_cloud_status", status, detail: { ok, total: CLOUD_STATUS_FEEDS.length, backfilled, errors } };
}

export async function ingestSecEdgar(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  let totalPoints = 0;
  let ok = 0;
  const errors: string[] = [];
  for (const company of AI_COMPANIES) {
    try {
      const points = await fetchSecEdgarCompanyMetrics(company);
      await upsertMetrics(db, points); // per-company upsert keeps each batch a few hundred rows, not thousands at once
      totalPoints += points.length;
      ok++;
    } catch (e) {
      errors.push(`${company.ticker}: ${(e as Error).message}`);
    }
    // SEC asks for no more than ~10 req/sec; one request per company is well within that,
    // but a small stagger costs little and is good citizenship for a free public API.
    await new Promise((r) => setTimeout(r, 150));
  }
  const status = errors.length === 0 ? "ok" : ok > 0 ? "warning" : "failed";
  const detail = { ok, total: AI_COMPANIES.length, points: totalPoints, errors };
  await logRun(db, runDate, "ingest_sec_edgar", status, detail);
  return { stage: "ingest_sec_edgar", status, detail };
}

export async function ingestGovBondYields(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const fetchers = [
    { name: "Germany (Bundesbank)", fn: fetchGermanyYield10y },
    { name: "UK (BoE)", fn: fetchUkYield10y },
    { name: "Canada (BoC)", fn: fetchCanadaYield10y },
    { name: "China (ChinaBond/CCDC)", fn: fetchChinaYield10y },
  ];
  let ok = 0;
  let points = 0;
  const errors: string[] = [];
  for (const f of fetchers) {
    try {
      const pts = await f.fn();
      await upsertMetrics(db, pts);
      points += pts.length;
      ok++;
    } catch (e) {
      errors.push(`${f.name}: ${(e as Error).message}`);
    }
  }
  const status = errors.length === 0 ? "ok" : ok > 0 ? "warning" : "failed";
  const detail = { ok, total: fetchers.length, points, errors };
  await logRun(db, runDate, "ingest_gov_bond_yields", status, detail);
  return { stage: "ingest_gov_bond_yields", status, detail };
}

export async function ingestChinaCreditGap(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchChinaCreditGap();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    await logRun(db, runDate, "ingest_china_credit_gap", status, { points: points.length });
    return { stage: "ingest_china_credit_gap", status, detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_china_credit_gap", "failed", detail);
    return { stage: "ingest_china_credit_gap", status: "failed", detail };
  }
}

export async function ingestChinaLgfvDebt(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = fetchChinaLgfvDebt();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_china_lgfv_debt", "ok", { points: points.length });
    return { stage: "ingest_china_lgfv_debt", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_china_lgfv_debt", "failed", detail);
    return { stage: "ingest_china_lgfv_debt", status: "failed", detail };
  }
}

export async function ingestGovCnStatistics(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const [pmiCount, propertyCount, financingCount] = await Promise.all([
      db.from("metric_series").select("observed_at", { count: "exact", head: true }).eq("metric_key", "china.pmi_new_orders"),
      db.from("metric_series").select("observed_at", { count: "exact", head: true }).eq("metric_key", "china.property_sales"),
      db.from("metric_series").select("observed_at", { count: "exact", head: true }).eq("metric_key", "china.developer_financing"),
    ]);
    if (pmiCount.error) throw new Error(`row count check (pmi): ${pmiCount.error.message}`);
    if (propertyCount.error) throw new Error(`row count check (property): ${propertyCount.error.message}`);
    if (financingCount.error) throw new Error(`row count check (financing): ${financingCount.error.message}`);
    const needsBackfill =
      (pmiCount.count ?? 0) < MIN_GOV_CN_OBSERVATIONS ||
      (propertyCount.count ?? 0) < MIN_GOV_CN_OBSERVATIONS ||
      (financingCount.count ?? 0) < MIN_GOV_CN_OBSERVATIONS;
    const pageLimit = needsBackfill ? GOV_CN_BACKFILL_PAGE_LIMIT : GOV_CN_APPEND_PAGE_LIMIT;

    const { pmi, property, financing, discovered } = await fetchChinaMonthlyReleases(pageLimit);
    await upsertMetrics(db, pmi);
    await upsertMetrics(db, property);
    await upsertMetrics(db, financing);
    const detail = { pageLimit, backfilled: needsBackfill, pmiPoints: pmi.length, propertyPoints: property.length, financingPoints: financing.length, discovered };
    const status = pmi.length > 0 || property.length > 0 || financing.length > 0 ? "ok" : "warning";
    await logRun(db, runDate, "ingest_gov_cn_statistics", status, detail);
    return { stage: "ingest_gov_cn_statistics", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_gov_cn_statistics", "failed", detail);
    return { stage: "ingest_gov_cn_statistics", status: "failed", detail };
  }
}

export async function runIngestionPipeline(db: SupabaseClient) {
  const runDate = new Date().toISOString().slice(0, 10);
  const results = await Promise.all([
    ingestFred(db, runDate),
    ingestFx(db, runDate),
    ingestYahooIndices(db, runDate),
    ingestCftc(db, runDate),
    ingestCentralBankFeeds(db, runDate),
    ingestGscpi(db, runDate),
    ingestGpr(db, runDate),
    ingestCrypto(db, runDate),
    ingestCloudStatus(db, runDate),
    ingestSecEdgar(db, runDate),
    ingestGovBondYields(db, runDate),
    ingestChinaCreditGap(db, runDate),
    ingestChinaLgfvDebt(db, runDate),
    ingestGovCnStatistics(db, runDate),
  ]);
  return { runDate, results };
}
