import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertMetrics } from "../metrics/store";
import { FRED_SERIES, fetchFredSeries, type FredSeriesDef } from "../sources/fred";
import { fetchFxCrossSeries } from "../sources/fx";
import { YAHOO_INDEX_SERIES, fetchYahooIndexSeries } from "../sources/yahooIndex";
import { COT_MARKETS, fetchCotSeries, COT_DISAGGREGATED_MARKETS, fetchDisaggregatedCotSeries, COT_TFF_MARKETS, fetchTffCotSeries } from "../sources/cftcCot";
import { fetchBisOtcDerivativesNotional } from "../sources/bisOtcDerivatives";
import { fetchNyFedRepoRates } from "../sources/nyFedRepoRates";
import { fetchOkxPerpetuals } from "../sources/okxPerpetuals";
import { fetchNseFoBhavcopy } from "../sources/nseFoBhavcopy";
import { fetchDtccSwapData } from "../sources/dtccSwapData";
import { fetchHkexDerivatives } from "../sources/hkexDerivatives";
import { fetchTaifexDerivatives } from "../sources/taifexDerivatives";
import { fetchCffexDerivatives } from "../sources/cffexDerivatives";
import { fetchDeribitOptions } from "../sources/deribitOptions";
import { fetchIceFuturesEuropeCot } from "../sources/iceFuturesEuropeCot";
import { fetchB3Derivatives } from "../sources/b3Derivatives";
import { CENTRAL_BANK_FEEDS, fetchCentralBankFeed } from "../sources/centralBankRss";
import { fetchGscpiSeries } from "../sources/gscpi";
import { fetchGprSeries } from "../sources/gpr";
import { fetchCryptoSnapshot } from "../sources/coingecko";
import { CLOUD_STATUS_FEEDS, fetchCloudStatusCount, fetchCloudStatusBackfill, MIN_BACKFILL_OBSERVATIONS } from "../sources/cloudStatus";
import { AI_COMPANIES, fetchSecEdgarCompanyMetrics } from "../sources/secEdgar";
import {
  fetchGermanyYield10y,
  fetchUkYield10y,
  fetchCanadaYield10y,
  fetchJapanYield10y,
  fetchUkReserveBalances,
  fetchCanadaCentralBankAssets,
  fetchUkShortRates,
  fetchCanadaShortRates,
  fetchEcbShortRate,
  fetchBojCallRate,
} from "../sources/govBondYields";
import { fetchChinaYield10y, fetchChinaCorpAaaYield10y } from "../sources/chinaBondYield";
import {
  fetchChinaCreditGap,
  fetchUkCreditGap,
  fetchCanadaCreditGap,
  fetchJapanCreditGap,
  fetchUsCreditGap,
  fetchGermanyCreditGap,
  fetchFranceCreditGap,
  fetchItalyCreditGap,
  fetchIndiaCreditGap,
  fetchBrazilCreditGap,
  fetchRussiaCreditGap,
  fetchSouthKoreaCreditGap,
  fetchIndonesiaCreditGap,
  fetchMexicoCreditGap,
  fetchSaudiArabiaCreditGap,
  fetchSouthAfricaCreditGap,
  fetchTurkeyCreditGap,
  fetchArgentinaCreditGap,
  fetchAustraliaCreditGap,
  fetchMalaysiaCreditGap,
  fetchSingaporeCreditGap,
  fetchThailandCreditGap,
  fetchPolandCreditGap,
  fetchCzechRepublicCreditGap,
  fetchHungaryCreditGap,
  fetchChileCreditGap,
  fetchColombiaCreditGap,
  fetchIsraelCreditGap,
} from "../sources/bisCreditGap";
import { fetchIndiaPropertyPrices } from "../sources/bisPropertyPrices";
import { runCentralBankFsrChecks } from "../sources/centralBankFsrCheck";
import {
  fetchGlobalUsdCreditGrowth,
  fetchGlobalEurCreditGrowth,
  fetchGlobalJpyCreditGrowth,
  fetchEmUsdCreditGrowth,
} from "../sources/bisGlobalLiquidityIndicators";
import { runNbfiChecks } from "../sources/nbfiCheck";
import { fetchChinaLgfvDebt } from "../sources/imfAugmentedDebt";
import { fetchChinaMonthlyReleases, GOV_CN_BACKFILL_PAGE_LIMIT, GOV_CN_APPEND_PAGE_LIMIT, MIN_GOV_CN_OBSERVATIONS } from "../sources/govCnStatistics";
import { fetchCanadaInventoryToSalesRatio } from "../sources/statCan";
import { fetchIndiaLiquiditySeries, fetchIndiaLiquidityBackfill } from "../sources/rbiLiquidity";
import { fetchIndiaYieldCurveSeries } from "../sources/rbiYieldCurve";
import { fetchWorldBankEmDebtIndicators } from "../sources/worldBankEmDebt";
import { fetchSovereignRiskPremium } from "../sources/sovereignRiskPremium";
import { fetchImfForeignHoldings } from "../sources/imfForeignHoldings";
import { fetchBisCorporateFxDebt } from "../sources/bisCorporateFxDebt";
import { fetchImfFiscalGapFillers } from "../sources/imfFiscalGaps";
import { fetchQedsExternalDebtGapFillers } from "../sources/qedsExternalDebt";
import { fetchG7FiscalData } from "../sources/g7Fiscal";
import { fetchUsTreasuryLiveData } from "../sources/usTreasuryDebt";
import { fetchUsTreasuryCash } from "../sources/usTreasuryCash";
import { fetchChinaOfficialReserveAssets } from "../sources/chinaFxReserves";
import { fetchBankFinancialSoundnessData } from "../sources/bankFinancialSoundness";
import { fetchAllBankSecFilings } from "../sources/bankSecFilings";
import { fetchAllBankFdicMetrics } from "../sources/fdicBankFind";
import { fetchImfPortwatchChokepoints } from "../sources/imfPortwatch";
import { fetchEiaCountryPetroleum, fetchEiaNaturalGasStorage } from "../sources/eiaApi";
import { fetchEiaChemicalFeedstockSpot } from "../sources/eiaChemicalFeedstockSpot";
import { fetchEiaGridSnapshots } from "../sources/eiaGridMonitor";
import { fetchIrenaRenewablesCapacity, fetchIrenaRenewablesGeneration } from "../sources/irenaStat";
import { fetchUnComtradeEnergyFlowsForCommodity, TRADE_COMMODITIES, fetchUnComtradeOleochemicalFlowsForCommodity, OLEOCHEMICAL_TRADE_COMMODITIES } from "../sources/unComtrade";
import { ComtradeRateLimitedError, ComtradeQuotaExceededError as SharedComtradeQuotaExceededError } from "../sources/unComtradeRateLimit";
import { fetchEntsoeDayAheadPrices, fetchEntsoeLoad, fetchEntsoeGeneration, fetchEntsoeCrossBorderFlowsForBorder, EU_GRID_BORDERS } from "../sources/entsoe";
import { fetchWorldBankCommodityPrices } from "../sources/worldBankCommodities";
import { fetchCriticalMineralPrices } from "../sources/dbnomicsCriticalMinerals";
import { fetchUsdaPsdBalances, fetchUsdaPsdSoybeanCountryBalances, fetchUsdaPsdCountryBalances } from "../sources/usdaPsd";
import { fetchUsgsMineralCommodities } from "../sources/usgsMineralCommodities";
import { fetchUsgsCommodityCountryTradeForCommodity, USGS_TRADE_COMMODITIES, ComtradeQuotaExceededError } from "../sources/unComtradeCommodityTrade";
import { fetchChemicalHsUnitValue, getChemicalPriceHsCodes, ChemicalPriceQuotaExceededError, CHEMICAL_PRICE_DELAY_MS } from "../sources/unComtradeChemicalPrices";
import { fetchMassiveFuturesProduct, MASSIVE_FUTURES_PRODUCTS, MassiveRateLimitError } from "../sources/massiveFutures";
import { fetchFaostatProduction, fetchFaostatOilseedsCountryProduction } from "../sources/faostat";
import { fetchEiaWorldEnergyBalances } from "../sources/eiaWorldEnergy";
import { fetchBpsIndonesiaBalances } from "../sources/bpsIndonesia";
import { fetchMpobMalaysiaExports } from "../sources/mpobMalaysia";
import { fetchNoaaOni } from "../sources/noaaOni";
import { fetchNasaPowerRainfall } from "../sources/nasaPowerRainfall";
import { fetchMpobMirror } from "../sources/mpobMirror";
import { fetchCpcEnsoForecast } from "../sources/cpcEnsoForecast";
import { fetchIsoNeGridSnapshot } from "../sources/isoNe";
import { fetchCaisoGridSnapshot } from "../sources/caisoOutlook";
import { fetchNyisoGridSnapshot } from "../sources/nyisoOutlook";
import { lookbackDaysFor } from "../metrics/lookback";

export type IngestStageResult = { stage: string; status: "ok" | "warning" | "failed"; detail: Record<string, unknown> };

async function logRun(db: SupabaseClient, runDate: string, stage: string, status: string, detail: unknown) {
  await db.from("pipeline_runs").insert({ run_date: runDate, stage, status, detail, finished_at: new Date().toISOString() });
}

/**
 * Safety net on top of the per-loop time budgets in timeBudget.ts: races
 * every stage against a generous timeout so a single hung/slow stage can
 * never block runIngestionPipeline's Promise.all past a bound well under
 * the /api/cron/pipeline route's 300s maxDuration. Without this, Vercel
 * kills the WHOLE serverless function once any one stage runs long enough —
 * silently dropping every OTHER concurrently-running stage's data too, not
 * just the slow one, with no error logged anywhere. This is the actual
 * mechanism that let one flaky upstream API on one cron run blank out
 * unrelated engines' data in the same run.
 *
 * Racing a timeout doesn't cancel the underlying stage promise (Node has no
 * true fetch-cancellation without threading an AbortController through
 * every call site) — it keeps running in the background and may still
 * write its own real result a little later. That's fine: the goal here is
 * only to guarantee the overall pipeline request always returns in time and
 * every stage gets SOME logged pipeline_runs row, never silent nothing.
 */
async function withStageTimeout(
  stageLabel: string,
  promise: Promise<IngestStageResult>,
  ms: number,
  db: SupabaseClient,
  runDate: string
): Promise<IngestStageResult> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutResult = new Promise<IngestStageResult>((resolve) => {
    timer = setTimeout(() => {
      const detail = { error: `stage exceeded its ${Math.round(ms / 1000)}s safety budget and was abandoned so the rest of this pipeline run could still finish on time` };
      logRun(db, runDate, stageLabel, "failed", detail).catch(() => {});
      resolve({ stage: stageLabel, status: "failed", detail });
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutResult]);
  } finally {
    clearTimeout(timer!);
  }
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

// Separate from the FRED_SERIES manifest/lookbackDaysFor above on purpose:
// every other FRED series only needs a few years of trailing history for its
// own zScore() window, but the Historical Backtesting proxy (energyBacktest.ts)
// needs WTI's full real history back to 1946 to reach the 1973 oil embargo —
// routing this through the generic 5.2-year monthly lookback would silently
// starve it of the exact decades of history the whole feature exists to use.
export async function ingestEnergyBacktestSeries(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    await logRun(db, runDate, "ingest_energy_backtest_series", "warning", { reason: "FRED_API_KEY not set" });
    return { stage: "ingest_energy_backtest_series", status: "warning", detail: { reason: "FRED_API_KEY not set" } };
  }
  try {
    const points = await fetchFredSeries({ metricKey: "energy.wti_longrun_monthly", seriesId: "WTISPLC", frequency: "monthly", unit: "USD/bbl" }, apiKey, "1946-01-01");
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_energy_backtest_series", status, detail);
    return { stage: "ingest_energy_backtest_series", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_energy_backtest_series", "failed", detail);
    return { stage: "ingest_energy_backtest_series", status: "failed", detail };
  }
}

// Same reasoning as ingestEnergyBacktestSeries above, for a different feature:
// centralBankDecisionImpact.ts's event study needs genuine past HIKE cycles to
// have anything to sample, but ingestFred's generic 400-day daily lookback
// (lookbackDaysFor — sized only for zScore()'s 20-observation minimum) means
// rate.fed_funds_effective and rate.ecb_deposit_facility only ever carried
// ~13 months of real history: enough to see 2025's cutting cycle, but not the
// 2022-2023 hiking cycle (or, for Fed, 2004-2006/2015-2018 either) — verified
// live against this app's own stored data (0 sampled Fed hikes despite the
// real 2022-2023 cycle existing) before writing this fix. The other five
// banks' own connectors (govBondYields.ts) already fetch deep, unwindowed
// history directly from their source (UK/Canada from 2000, BOJ's full
// available series) — this brings the two FRED-sourced series to the same
// standard rather than inventing a new convention. 2000-01-01 matches the
// UK/Canada connectors' own start date for consistency; both series' real
// FRED history goes back further still (DFF to 1954, ECBDFR to the euro's
// 1999 launch) but 2000 already covers three real Fed hiking cycles.
export async function ingestCentralBankRateHistory(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    await logRun(db, runDate, "ingest_central_bank_rate_history", "warning", { reason: "FRED_API_KEY not set" });
    return { stage: "ingest_central_bank_rate_history", status: "warning", detail: { reason: "FRED_API_KEY not set" } };
  }
  const DEEP_HISTORY_SERIES: FredSeriesDef[] = [
    { metricKey: "rate.fed_funds_effective", seriesId: "DFF", frequency: "daily", unit: "%" },
    { metricKey: "rate.ecb_deposit_facility", seriesId: "ECBDFR", frequency: "daily", unit: "%" },
  ];
  let ok = 0;
  let totalPoints = 0;
  const errors: string[] = [];
  for (const def of DEEP_HISTORY_SERIES) {
    try {
      const points = await fetchFredSeries(def, apiKey, "2000-01-01");
      await upsertMetrics(db, points);
      totalPoints += points.length;
      ok++;
    } catch (e) {
      errors.push(`${def.seriesId}: ${(e as Error).message}`);
    }
  }
  const status = errors.length === 0 ? "ok" : ok > 0 ? "warning" : "failed";
  const detail = { ok, total: DEEP_HISTORY_SERIES.length, points: totalPoints, errors };
  await logRun(db, runDate, "ingest_central_bank_rate_history", status, detail);
  return { stage: "ingest_central_bank_rate_history", status, detail };
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

/** Disaggregated COT + Traders-in-Financial-Futures — separate stage from Legacy COT above so a
 * naming/schema issue in either report can't take down the other's well-established 15 markets. */
export async function ingestCftcExtended(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 400);
  let ok = 0;
  const errors: string[] = [];
  const total = COT_DISAGGREGATED_MARKETS.length + COT_TFF_MARKETS.length;
  for (const def of COT_DISAGGREGATED_MARKETS) {
    try {
      const points = await fetchDisaggregatedCotSeries(def, since.toISOString());
      await upsertMetrics(db, points);
      ok++;
    } catch (e) {
      errors.push(`${def.marketName}: ${(e as Error).message}`);
    }
  }
  for (const def of COT_TFF_MARKETS) {
    try {
      const points = await fetchTffCotSeries(def, since.toISOString());
      await upsertMetrics(db, points);
      ok++;
    } catch (e) {
      errors.push(`${def.marketName}: ${(e as Error).message}`);
    }
  }
  const status = errors.length === 0 ? "ok" : ok > 0 ? "warning" : "failed";
  await logRun(db, runDate, "ingest_cftc_extended", status, { ok, total, errors });
  return { stage: "ingest_cftc_extended", status, detail: { ok, total, errors } };
}

export async function ingestBisOtcDerivatives(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchBisOtcDerivativesNotional();
    await upsertMetrics(db, points);
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_bis_otc_derivatives", "ok", detail);
    return { stage: "ingest_bis_otc_derivatives", status: "ok", detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_bis_otc_derivatives", "failed", detail);
    return { stage: "ingest_bis_otc_derivatives", status: "failed", detail };
  }
}

export async function ingestNyFedRepo(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchNyFedRepoRates();
    await upsertMetrics(db, points);
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_nyfed_repo", "ok", detail);
    return { stage: "ingest_nyfed_repo", status: "ok", detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_nyfed_repo", "failed", detail);
    return { stage: "ingest_nyfed_repo", status: "failed", detail };
  }
}

export async function ingestOkxPerpetuals(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchOkxPerpetuals();
    await upsertMetrics(db, points);
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_okx_perpetuals", "ok", detail);
    return { stage: "ingest_okx_perpetuals", status: "ok", detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_okx_perpetuals", "failed", detail);
    return { stage: "ingest_okx_perpetuals", status: "failed", detail };
  }
}

export async function ingestNseFoBhavcopy(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchNseFoBhavcopy();
    await upsertMetrics(db, points);
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_nse_fo_bhavcopy", "ok", detail);
    return { stage: "ingest_nse_fo_bhavcopy", status: "ok", detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_nse_fo_bhavcopy", "failed", detail);
    return { stage: "ingest_nse_fo_bhavcopy", status: "failed", detail };
  }
}

export async function ingestDtccSwapData(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchDtccSwapData();
    await upsertMetrics(db, points);
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_dtcc_swap_data", "ok", detail);
    return { stage: "ingest_dtcc_swap_data", status: "ok", detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_dtcc_swap_data", "failed", detail);
    return { stage: "ingest_dtcc_swap_data", status: "failed", detail };
  }
}

export async function ingestIceFuturesEuropeCot(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchIceFuturesEuropeCot();
    await upsertMetrics(db, points);
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_ice_futures_europe_cot", "ok", detail);
    return { stage: "ingest_ice_futures_europe_cot", status: "ok", detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_ice_futures_europe_cot", "failed", detail);
    return { stage: "ingest_ice_futures_europe_cot", status: "failed", detail };
  }
}

export async function ingestDeribitOptions(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchDeribitOptions();
    await upsertMetrics(db, points);
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_deribit_options", "ok", detail);
    return { stage: "ingest_deribit_options", status: "ok", detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_deribit_options", "failed", detail);
    return { stage: "ingest_deribit_options", status: "failed", detail };
  }
}

export async function ingestCffexDerivatives(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchCffexDerivatives();
    await upsertMetrics(db, points);
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_cffex_derivatives", "ok", detail);
    return { stage: "ingest_cffex_derivatives", status: "ok", detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_cffex_derivatives", "failed", detail);
    return { stage: "ingest_cffex_derivatives", status: "failed", detail };
  }
}

export async function ingestTaifexDerivatives(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchTaifexDerivatives();
    await upsertMetrics(db, points);
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_taifex_derivatives", "ok", detail);
    return { stage: "ingest_taifex_derivatives", status: "ok", detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_taifex_derivatives", "failed", detail);
    return { stage: "ingest_taifex_derivatives", status: "failed", detail };
  }
}

export async function ingestHkexDerivatives(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchHkexDerivatives();
    await upsertMetrics(db, points);
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_hkex_derivatives", "ok", detail);
    return { stage: "ingest_hkex_derivatives", status: "ok", detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_hkex_derivatives", "failed", detail);
    return { stage: "ingest_hkex_derivatives", status: "failed", detail };
  }
}

export async function ingestB3Derivatives(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchB3Derivatives();
    await upsertMetrics(db, points);
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_b3_derivatives", "ok", detail);
    return { stage: "ingest_b3_derivatives", status: "ok", detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_b3_derivatives", "failed", detail);
    return { stage: "ingest_b3_derivatives", status: "failed", detail };
  }
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
    { name: "China Corporate AAA (ChinaBond/CCDC)", fn: fetchChinaCorpAaaYield10y },
    { name: "Japan (Ministry of Finance)", fn: fetchJapanYield10y },
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

export async function ingestGovLiquidity(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const fetchers = [
    { name: "UK (BoE reserve balances)", fn: fetchUkReserveBalances },
    { name: "Canada (BoC total assets)", fn: fetchCanadaCentralBankAssets },
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
  await logRun(db, runDate, "ingest_gov_liquidity", status, detail);
  return { stage: "ingest_gov_liquidity", status, detail };
}

// Below this many stored observations, ingestion additionally pulls full prior
// calendar years via RBI's own year/month archive (rbiArchive.ts) — the default
// listing alone only shows a rolling few weeks, which isn't enough history to see
// more than one Diwali/fiscal-year-end cycle for the seasonal analysis
// (indiaSeasonality.ts). Runs once; subsequent runs see the row count above the
// threshold and fall back to the cheap current-listing-only fetch.
const MIN_RBI_LIQUIDITY_OBSERVATIONS = 700; // ~2 years of daily net-liquidity/WACR pairs
const MIN_RBI_YIELD_CURVE_OBSERVATIONS = 150; // T-Bill+G-Sec auctions are weekly/irregular, not daily

function priorCalendarYears(count: number): number[] {
  const currentYear = new Date().getUTCFullYear();
  return Array.from({ length: count }, (_, i) => currentYear - count + i);
}

export async function ingestCentralBankShortRates(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const fetchers = [
    { name: "UK (BoE SONIA/Bank Rate)", fn: fetchUkShortRates },
    { name: "Canada (BoC CORRA/Target)", fn: fetchCanadaShortRates },
    { name: "Eurozone (ECB €STR)", fn: fetchEcbShortRate },
    { name: "Japan (BOJ call rate)", fn: fetchBojCallRate },
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
  await logRun(db, runDate, "ingest_central_bank_short_rates", status, detail);
  return { stage: "ingest_central_bank_short_rates", status, detail };
}

export async function ingestRbiLiquidity(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const { count, error: countError } = await db
      .from("metric_series")
      .select("observed_at", { count: "exact", head: true })
      .eq("metric_key", "india.rbi_net_liquidity");
    if (countError) throw new Error(`row count check: ${countError.message}`);
    const needsBackfill = (count ?? 0) < MIN_RBI_LIQUIDITY_OBSERVATIONS;

    const [current, backfill] = await Promise.all([
      fetchIndiaLiquiditySeries(),
      needsBackfill ? fetchIndiaLiquidityBackfill(priorCalendarYears(3)) : Promise.resolve([]),
    ]);
    const points = [...current, ...backfill];
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length, backfilled: needsBackfill, currentPoints: current.length, backfillPoints: backfill.length };
    await logRun(db, runDate, "ingest_rbi_liquidity", status, detail);
    return { stage: "ingest_rbi_liquidity", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_rbi_liquidity", "failed", detail);
    return { stage: "ingest_rbi_liquidity", status: "failed", detail };
  }
}

export async function ingestRbiYieldCurve(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  // Upserts T-Bill points and G-Sec points as soon as each is ready (see
  // fetchIndiaYieldCurveSeries's onBatch doc comment) rather than waiting
  // for both — a real pipeline run showed this stage sometimes needs more
  // wall-clock time than its isolated pre-phase budget allows, especially
  // during a multi-year backfill; this way an abandonment (which doesn't
  // cancel the underlying fetch, just stops waiting for it) still keeps
  // whichever half already finished, instead of losing both to an
  // all-or-nothing single upsert at the very end.
  let upserted = 0;
  try {
    const { count, error: countError } = await db
      .from("metric_series")
      .select("observed_at", { count: "exact", head: true })
      .eq("metric_key", "india.tbill_364d");
    if (countError) throw new Error(`row count check: ${countError.message}`);
    const needsBackfill = (count ?? 0) < MIN_RBI_YIELD_CURVE_OBSERVATIONS;

    const points = await fetchIndiaYieldCurveSeries(needsBackfill ? priorCalendarYears(3) : [], async (batch) => {
      await upsertMetrics(db, batch);
      upserted += batch.length;
    });
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length, backfilled: needsBackfill };
    await logRun(db, runDate, "ingest_rbi_yield_curve", status, detail);
    return { stage: "ingest_rbi_yield_curve", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message, upserted };
    await logRun(db, runDate, "ingest_rbi_yield_curve", upserted > 0 ? "warning" : "failed", detail);
    return { stage: "ingest_rbi_yield_curve", status: upserted > 0 ? "warning" : "failed", detail };
  }
}

export async function ingestBisCreditGaps(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const fetchers = [
    { name: "China", fn: fetchChinaCreditGap },
    { name: "UK", fn: fetchUkCreditGap },
    { name: "Canada", fn: fetchCanadaCreditGap },
    { name: "Japan", fn: fetchJapanCreditGap },
    // Added for the Property Systemic Risk engine's Credit domain — see
    // bisCreditGap.ts's own comment on these five entries.
    { name: "US", fn: fetchUsCreditGap },
    { name: "Germany", fn: fetchGermanyCreditGap },
    { name: "France", fn: fetchFranceCreditGap },
    { name: "Italy", fn: fetchItalyCreditGap },
    { name: "India", fn: fetchIndiaCreditGap },
    // Added for the Credit Data Verification table (creditDataRegistry.ts)
    // — the 19 of 25 non-BANKING_COUNTRIES this BIS dataflow actually
    // covers (verified live; Philippines/Romania/Peru/UAE/Kenya/Egypt do
    // not have this series and are disclosed as unavailable instead).
    { name: "Brazil", fn: fetchBrazilCreditGap },
    { name: "Russia", fn: fetchRussiaCreditGap },
    { name: "South Korea", fn: fetchSouthKoreaCreditGap },
    { name: "Indonesia", fn: fetchIndonesiaCreditGap },
    { name: "Mexico", fn: fetchMexicoCreditGap },
    { name: "Saudi Arabia", fn: fetchSaudiArabiaCreditGap },
    { name: "South Africa", fn: fetchSouthAfricaCreditGap },
    { name: "Turkey", fn: fetchTurkeyCreditGap },
    { name: "Argentina", fn: fetchArgentinaCreditGap },
    { name: "Australia", fn: fetchAustraliaCreditGap },
    { name: "Malaysia", fn: fetchMalaysiaCreditGap },
    { name: "Singapore", fn: fetchSingaporeCreditGap },
    { name: "Thailand", fn: fetchThailandCreditGap },
    { name: "Poland", fn: fetchPolandCreditGap },
    { name: "Czech Republic", fn: fetchCzechRepublicCreditGap },
    { name: "Hungary", fn: fetchHungaryCreditGap },
    { name: "Chile", fn: fetchChileCreditGap },
    { name: "Colombia", fn: fetchColombiaCreditGap },
    { name: "Israel", fn: fetchIsraelCreditGap },
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
  await logRun(db, runDate, "ingest_bis_credit_gaps", status, detail);
  return { stage: "ingest_bis_credit_gaps", status, detail };
}

export async function ingestEmDebtStructural(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchWorldBankEmDebtIndicators();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_em_debt_structural", "ok", { points: points.length });
    return { stage: "ingest_em_debt_structural", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_em_debt_structural", "failed", detail);
    return { stage: "ingest_em_debt_structural", status: "failed", detail };
  }
}

export async function ingestEmDebtSovereignCds(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchSovereignRiskPremium();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_em_debt_sovereign_cds", "ok", { points: points.length });
    return { stage: "ingest_em_debt_sovereign_cds", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_em_debt_sovereign_cds", "failed", detail);
    return { stage: "ingest_em_debt_sovereign_cds", status: "failed", detail };
  }
}

export async function ingestEmDebtForeignHoldings(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchImfForeignHoldings();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_em_debt_foreign_holdings", "ok", { points: points.length });
    return { stage: "ingest_em_debt_foreign_holdings", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_em_debt_foreign_holdings", "failed", detail);
    return { stage: "ingest_em_debt_foreign_holdings", status: "failed", detail };
  }
}

export async function ingestEmDebtCorporateFx(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchBisCorporateFxDebt();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_em_debt_corporate_fx", "ok", { points: points.length });
    return { stage: "ingest_em_debt_corporate_fx", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_em_debt_corporate_fx", "failed", detail);
    return { stage: "ingest_em_debt_corporate_fx", status: "failed", detail };
  }
}

export async function ingestEmDebtFiscalGaps(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchImfFiscalGapFillers();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_em_debt_fiscal_gaps", "ok", { points: points.length });
    return { stage: "ingest_em_debt_fiscal_gaps", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_em_debt_fiscal_gaps", "failed", detail);
    return { stage: "ingest_em_debt_fiscal_gaps", status: "failed", detail };
  }
}

export async function ingestEmDebtQedsGaps(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchQedsExternalDebtGapFillers();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_em_debt_qeds_gaps", "ok", { points: points.length });
    return { stage: "ingest_em_debt_qeds_gaps", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_em_debt_qeds_gaps", "failed", detail);
    return { stage: "ingest_em_debt_qeds_gaps", status: "failed", detail };
  }
}

export async function ingestG7FiscalData(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchG7FiscalData();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_g7_fiscal_data", "ok", { points: points.length });
    return { stage: "ingest_g7_fiscal_data", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_g7_fiscal_data", "failed", detail);
    return { stage: "ingest_g7_fiscal_data", status: "failed", detail };
  }
}

export async function ingestUsTreasuryLiveData(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchUsTreasuryLiveData();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_us_treasury_live", "ok", { points: points.length });
    return { stage: "ingest_us_treasury_live", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_us_treasury_live", "failed", detail);
    return { stage: "ingest_us_treasury_live", status: "failed", detail };
  }
}

export async function ingestUsTreasuryCash(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchUsTreasuryCash();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_us_treasury_cash", "ok", { points: points.length });
    return { stage: "ingest_us_treasury_cash", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_us_treasury_cash", "failed", detail);
    return { stage: "ingest_us_treasury_cash", status: "failed", detail };
  }
}

export async function ingestChinaFxReserves(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchChinaOfficialReserveAssets();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_china_fx_reserves", "ok", { points: points.length });
    return { stage: "ingest_china_fx_reserves", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_china_fx_reserves", "failed", detail);
    return { stage: "ingest_china_fx_reserves", status: "failed", detail };
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

    const { pmi, supplierDeliveryTime, property, financing, discovered } = await fetchChinaMonthlyReleases(pageLimit);
    await upsertMetrics(db, pmi);
    await upsertMetrics(db, supplierDeliveryTime);
    await upsertMetrics(db, property);
    await upsertMetrics(db, financing);
    const detail = {
      pageLimit,
      backfilled: needsBackfill,
      pmiPoints: pmi.length,
      supplierDeliveryTimePoints: supplierDeliveryTime.length,
      propertyPoints: property.length,
      financingPoints: financing.length,
      discovered,
    };
    const status = pmi.length > 0 || property.length > 0 || financing.length > 0 ? "ok" : "warning";
    await logRun(db, runDate, "ingest_gov_cn_statistics", status, detail);
    return { stage: "ingest_gov_cn_statistics", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_gov_cn_statistics", "failed", detail);
    return { stage: "ingest_gov_cn_statistics", status: "failed", detail };
  }
}

export async function ingestStatCan(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchCanadaInventoryToSalesRatio();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    await logRun(db, runDate, "ingest_statcan", status, { points: points.length });
    return { stage: "ingest_statcan", status, detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_statcan", "failed", detail);
    return { stage: "ingest_statcan", status: "failed", detail };
  }
}

export async function ingestBankFinancialSoundness(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchBankFinancialSoundnessData();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_bank_financial_soundness", "ok", { points: points.length });
    return { stage: "ingest_bank_financial_soundness", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_bank_financial_soundness", "failed", detail);
    return { stage: "ingest_bank_financial_soundness", status: "failed", detail };
  }
}

export async function ingestBankSecFilings(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchAllBankSecFilings();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_bank_sec_filings", "ok", { points: points.length });
    return { stage: "ingest_bank_sec_filings", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_bank_sec_filings", "failed", detail);
    return { stage: "ingest_bank_sec_filings", status: "failed", detail };
  }
}

export async function ingestIndiaPropertyPrices(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchIndiaPropertyPrices();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_india_property_prices", "ok", { points: points.length });
    return { stage: "ingest_india_property_prices", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_india_property_prices", "failed", detail);
    return { stage: "ingest_india_property_prices", status: "failed", detail };
  }
}

export async function ingestBankFdicMetrics(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchAllBankFdicMetrics();
    await upsertMetrics(db, points);
    await logRun(db, runDate, "ingest_bank_fdic_metrics", "ok", { points: points.length });
    return { stage: "ingest_bank_fdic_metrics", status: "ok", detail: { points: points.length } };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_bank_fdic_metrics", "failed", detail);
    return { stage: "ingest_bank_fdic_metrics", status: "failed", detail };
  }
}

export async function ingestCentralBankFsrChecks(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const results = await runCentralBankFsrChecks(db);
    const rows = results.map((r) => ({ key: r.key, last_checked_at: new Date().toISOString(), check_status: r.status, note: r.note }));
    const { error } = await db.from("central_bank_fsr_checks").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    const needsReview = results.filter((r) => r.status === "needs_review").map((r) => r.key);
    const failed = results.filter((r) => r.status === "check_failed").map((r) => r.key);
    const notAutomated = results.filter((r) => r.status === "not_automated").length;
    const status = needsReview.length > 0 || failed.length > 0 ? "warning" : "ok";
    const detail = { total: results.length, needsReview, failed, notAutomated };
    await logRun(db, runDate, "ingest_central_bank_fsr_checks", status, detail);
    return { stage: "ingest_central_bank_fsr_checks", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_central_bank_fsr_checks", "failed", detail);
    return { stage: "ingest_central_bank_fsr_checks", status: "failed", detail };
  }
}

/** BIS Global Liquidity Indicators (bisGlobalLiquidityIndicators.ts) — feeds
 * getGlobalDollarLiquidityIndex in liquiditySystemicRisk.ts. */
export async function ingestBisGlobalLiquidity(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const fetchers = [
    { name: "USD ex-US", fn: fetchGlobalUsdCreditGrowth },
    { name: "EUR ex-euro-area", fn: fetchGlobalEurCreditGrowth },
    { name: "JPY ex-Japan", fn: fetchGlobalJpyCreditGrowth },
    { name: "USD to EMDE", fn: fetchEmUsdCreditGrowth },
  ];
  let ok = 0;
  let points = 0;
  const errors: string[] = [];
  for (const f of fetchers) {
    try {
      const p = await f.fn();
      await upsertMetrics(db, p);
      ok++;
      points += p.length;
    } catch (e) {
      errors.push(`${f.name}: ${(e as Error).message}`);
    }
  }
  const status = errors.length === 0 ? "ok" : ok > 0 ? "warning" : "failed";
  const detail = { ok, total: fetchers.length, points, errors };
  await logRun(db, runDate, "ingest_bis_global_liquidity", status, detail);
  return { stage: "ingest_bis_global_liquidity", status, detail };
}

/** NBFI Monitoring Registry freshness check (nbfiCheck.ts/nbfiRegistry.ts) —
 * same "check the page, flag needs_review, never rewrite the curated content
 * automatically" discipline as ingestCentralBankFsrChecks above. */
export async function ingestNbfiChecks(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const results = await runNbfiChecks();
    const rows = results.map((r) => ({ key: r.key, last_checked_at: new Date().toISOString(), check_status: r.status, note: r.note }));
    const { error } = await db.from("nbfi_checks").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    const needsReview = results.filter((r) => r.status === "needs_review").map((r) => r.key);
    const failed = results.filter((r) => r.status === "check_failed").map((r) => r.key);
    const status = needsReview.length > 0 || failed.length > 0 ? "warning" : "ok";
    const detail = { total: results.length, needsReview, failed };
    await logRun(db, runDate, "ingest_nbfi_checks", status, detail);
    return { stage: "ingest_nbfi_checks", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_nbfi_checks", "failed", detail);
    return { stage: "ingest_nbfi_checks", status: "failed", detail };
  }
}

export async function ingestEnergyChokepoints(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 400);
  try {
    const points = await fetchImfPortwatchChokepoints(since.toISOString());
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_energy_chokepoints", status, detail);
    return { stage: "ingest_energy_chokepoints", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_energy_chokepoints", "failed", detail);
    return { stage: "ingest_energy_chokepoints", status: "failed", detail };
  }
}

export async function ingestEiaEnergy(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    await logRun(db, runDate, "ingest_eia_energy", "warning", { reason: "EIA_API_KEY not set" });
    return { stage: "ingest_eia_energy", status: "warning", detail: { reason: "EIA_API_KEY not set" } };
  }
  // International production/consumption is monthly with a ~3-4 month lag —
  // a 15-year window keeps every country's history without hitting the API's
  // 5000-row page cap (16 countries * 2 series * ~15y * 12mo < 5000).
  const sinceOil = new Date();
  sinceOil.setUTCFullYear(sinceOil.getUTCFullYear() - 15);
  let ok = 0;
  const errors: string[] = [];
  let points = 0;
  try {
    const pts = await fetchEiaCountryPetroleum(apiKey, sinceOil.toISOString());
    await upsertMetrics(db, pts);
    points += pts.length;
    ok++;
  } catch (e) {
    errors.push(`country petroleum: ${(e as Error).message}`);
  }
  try {
    const pts = await fetchEiaNaturalGasStorage(apiKey);
    await upsertMetrics(db, pts);
    points += pts.length;
    ok++;
  } catch (e) {
    errors.push(`natural gas storage: ${(e as Error).message}`);
  }
  const status = errors.length === 0 ? "ok" : ok > 0 ? "warning" : "failed";
  const detail = { ok, total: 2, points, errors };
  await logRun(db, runDate, "ingest_eia_energy", status, detail);
  return { stage: "ingest_eia_energy", status, detail };
}

/**
 * Deliberately NOT part of runIngestionPipeline's stage list below — this
 * stage is invoked exclusively by /api/cron/chemicals-spot, triggered by an
 * external scheduler twice a day (see .github/workflows). Folding it into
 * the once-daily pipeline as well would make it run three times a day, past
 * the "twice a day, not more" ask this connector was built for.
 */
export async function ingestEiaChemicalFeedstockSpot(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    await logRun(db, runDate, "ingest_eia_chemical_feedstock_spot", "warning", { reason: "EIA_API_KEY not set" });
    return { stage: "ingest_eia_chemical_feedstock_spot", status: "warning", detail: { reason: "EIA_API_KEY not set" } };
  }
  try {
    const points = await fetchEiaChemicalFeedstockSpot(apiKey);
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_eia_chemical_feedstock_spot", status, detail);
    return { stage: "ingest_eia_chemical_feedstock_spot", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_eia_chemical_feedstock_spot", "failed", detail);
    return { stage: "ingest_eia_chemical_feedstock_spot", status: "failed", detail };
  }
}

export async function ingestIsoNeGrid(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const username = process.env.ISO_NE_USERNAME;
  if (!username) {
    await logRun(db, runDate, "ingest_iso_ne_grid", "warning", { reason: "ISO_NE_USERNAME/ISO_NE_PASSWORD not set" });
    return { stage: "ingest_iso_ne_grid", status: "warning", detail: { reason: "ISO_NE_USERNAME/ISO_NE_PASSWORD not set" } };
  }
  try {
    const points = await fetchIsoNeGridSnapshot();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_iso_ne_grid", status, detail);
    return { stage: "ingest_iso_ne_grid", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_iso_ne_grid", "failed", detail);
    return { stage: "ingest_iso_ne_grid", status: "failed", detail };
  }
}

export async function ingestCaisoGrid(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchCaisoGridSnapshot();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_caiso_grid", status, detail);
    return { stage: "ingest_caiso_grid", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_caiso_grid", "failed", detail);
    return { stage: "ingest_caiso_grid", status: "failed", detail };
  }
}

export async function ingestNyisoGrid(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchNyisoGridSnapshot();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_nyiso_grid", status, detail);
    return { stage: "ingest_nyiso_grid", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_nyiso_grid", "failed", detail);
    return { stage: "ingest_nyiso_grid", status: "failed", detail };
  }
}

export async function ingestEiaGridMonitor(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    await logRun(db, runDate, "ingest_eia_grid_monitor", "warning", { reason: "EIA_API_KEY not set" });
    return { stage: "ingest_eia_grid_monitor", status: "warning", detail: { reason: "EIA_API_KEY not set" } };
  }
  try {
    const points = await fetchEiaGridSnapshots(apiKey);
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_eia_grid_monitor", status, detail);
    return { stage: "ingest_eia_grid_monitor", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_eia_grid_monitor", "failed", detail);
    return { stage: "ingest_eia_grid_monitor", status: "failed", detail };
  }
}

export async function ingestIrenaRenewables(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  let ok = 0;
  const errors: string[] = [];
  let points = 0;
  try {
    const pts = await fetchIrenaRenewablesCapacity();
    await upsertMetrics(db, pts);
    points += pts.length;
    ok++;
  } catch (e) {
    errors.push(`capacity: ${(e as Error).message}`);
  }
  try {
    const pts = await fetchIrenaRenewablesGeneration();
    await upsertMetrics(db, pts);
    points += pts.length;
    ok++;
  } catch (e) {
    errors.push(`generation: ${(e as Error).message}`);
  }
  const status = errors.length === 0 ? "ok" : ok > 0 ? "warning" : "failed";
  const detail = { ok, total: 2, points, errors };
  await logRun(db, runDate, "ingest_irena_renewables", status, detail);
  return { stage: "ingest_irena_renewables", status, detail };
}

export async function ingestUnComtradeEnergyFlows(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  // Same resumable-cursor, incremental-upsert, stop-early-on-rate-limit
  // design as ingestUsgsCommodityCountryTrade/ingestChemicalHsUnitValues
  // below — this stage shares the same account-wide UN Comtrade rate limit
  // (unComtradeRateLimit.ts) with three other concurrent stages, so a
  // ComtradeRateLimitedError here means the shared bucket is exhausted
  // RIGHT NOW, not that this commodity specifically is broken; stopping and
  // deferring to the next run beats burning the rest of this stage's time
  // budget on calls guaranteed to fail the same way.
  const n = TRADE_COMMODITIES.length;
  const { data: lastRun } = await db
    .from("pipeline_runs")
    .select("detail")
    .eq("stage", "ingest_un_comtrade_energy_flows")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastNextIndex = (lastRun?.detail as { nextIndex?: number } | null)?.nextIndex;
  const startIndex = typeof lastNextIndex === "number" && Number.isInteger(lastNextIndex) ? ((lastNextIndex % n) + n) % n : 0;

  let totalPoints = 0;
  const errors: string[] = [];
  let stoppedAtIndex: number | null = null;
  // Stop starting new items 45s before this stage's 190s budget so it returns normally with a resumable
  // cursor, instead of being abandoned (which logs no nextIndex and would restart at the same items every run).
  const deadline = Date.now() + 145000;
  for (let i = 0; i < n; i++) {
    const index = (startIndex + i) % n;
    if (i > 0 && Date.now() > deadline) {
      errors.push(`time budget reached; ${index} onward resumes on the next run`);
      stoppedAtIndex = index;
      break;
    }
    const commodity = TRADE_COMMODITIES[index];
    try {
      const points = await fetchUnComtradeEnergyFlowsForCommodity(commodity);
      await upsertMetrics(db, points);
      totalPoints += points.length;
    } catch (e) {
      if (e instanceof ComtradeRateLimitedError || e instanceof SharedComtradeQuotaExceededError) {
        errors.push(`stopped early: ${e.message} (${commodity.slug} onward deferred to a later run)`);
        stoppedAtIndex = index;
        break;
      }
      errors.push(`${commodity.slug}: ${(e as Error).message}`);
    }
  }
  const nextIndex = stoppedAtIndex ?? 0;
  const status = errors.length === 0 ? "ok" : totalPoints > 0 ? "warning" : "failed";
  const detail = { points: totalPoints, errors, startIndex, nextIndex };
  await logRun(db, runDate, "ingest_un_comtrade_energy_flows", status, detail);
  return { stage: "ingest_un_comtrade_energy_flows", status, detail };
}

export async function ingestUnComtradeOleochemicalFlows(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  // Upserts after EACH commodity, not once at the end — going from 4 to 7 HS
  // codes pushed this aggressively-rate-limited endpoint close enough to (and
  // once, past) the 150s stage timeout that a slow/rate-limited commodity
  // could otherwise cost every other commodity's already-fetched data too,
  // whether the failure is a thrown error or the whole stage being abandoned
  // on timeout. This way, whatever finished before that point is already
  // safely in Supabase regardless of what happens to the rest.
  //
  // Resumable cursor + stop-early-on-rate-limit, same design (and same
  // reason: a shared UN Comtrade rate limit split across 4 concurrent
  // stages) as ingestUnComtradeEnergyFlows/ingestUsgsCommodityCountryTrade/
  // ingestChemicalHsUnitValues. Before this, the loop always started at
  // Palm Oil and kept retrying every remaining commodity even after the
  // shared bucket was already exhausted, burning the stage's time budget
  // on guaranteed failures instead of stopping and giving the LATER
  // commodities (Glycerine, FAME/Biodiesel, Soap Noodles) a fair turn on a
  // future run.
  const n = OLEOCHEMICAL_TRADE_COMMODITIES.length;
  const { data: lastRun } = await db
    .from("pipeline_runs")
    .select("detail")
    .eq("stage", "ingest_un_comtrade_oleochemical_flows")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastNextIndex = (lastRun?.detail as { nextIndex?: number } | null)?.nextIndex;
  const startIndex = typeof lastNextIndex === "number" && Number.isInteger(lastNextIndex) ? ((lastNextIndex % n) + n) % n : 0;

  let totalPoints = 0;
  const errors: string[] = [];
  let stoppedAtIndex: number | null = null;
  // Stop starting new items 45s before this stage's 190s budget so it returns normally with a resumable
  // cursor, instead of being abandoned (which logs no nextIndex and would restart at the same items every run).
  const deadline = Date.now() + 145000;
  for (let i = 0; i < n; i++) {
    const index = (startIndex + i) % n;
    if (i > 0 && Date.now() > deadline) {
      errors.push(`time budget reached; ${index} onward resumes on the next run`);
      stoppedAtIndex = index;
      break;
    }
    const commodity = OLEOCHEMICAL_TRADE_COMMODITIES[index];
    try {
      const points = await fetchUnComtradeOleochemicalFlowsForCommodity(commodity);
      await upsertMetrics(db, points);
      totalPoints += points.length;
    } catch (e) {
      if (e instanceof ComtradeRateLimitedError || e instanceof SharedComtradeQuotaExceededError) {
        errors.push(`stopped early: ${e.message} (${commodity.slug} onward deferred to a later run)`);
        stoppedAtIndex = index;
        break;
      }
      errors.push(`${commodity.slug}: ${(e as Error).message}`);
    }
  }
  const nextIndex = stoppedAtIndex ?? 0;
  const status = errors.length === 0 ? "ok" : totalPoints > 0 ? "warning" : "failed";
  const detail = { points: totalPoints, errors, startIndex, nextIndex };
  await logRun(db, runDate, "ingest_un_comtrade_oleochemical_flows", status, detail);
  return { stage: "ingest_un_comtrade_oleochemical_flows", status, detail };
}

/** ENTSO-E Transparency Platform — European Grid Monitor (spec §23-25
 * equivalent, extended to Europe) + Cross-Border Electricity Trade Network.
 * Free, official, all TSOs' own reported data via ENTSO-E's central hub. */
export async function ingestEntsoeDayAheadPrices(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const { points, errors } = await fetchEntsoeDayAheadPrices();
    await upsertMetrics(db, points);
    const status = errors.length === 0 ? "ok" : points.length > 0 ? "warning" : "failed";
    const detail = { points: points.length, errors };
    await logRun(db, runDate, "ingest_entsoe_day_ahead_prices", status, detail);
    return { stage: "ingest_entsoe_day_ahead_prices", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_entsoe_day_ahead_prices", "failed", detail);
    return { stage: "ingest_entsoe_day_ahead_prices", status: "failed", detail };
  }
}

export async function ingestEntsoeLoad(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const { points, errors } = await fetchEntsoeLoad();
    await upsertMetrics(db, points);
    const status = errors.length === 0 ? "ok" : points.length > 0 ? "warning" : "failed";
    const detail = { points: points.length, errors };
    await logRun(db, runDate, "ingest_entsoe_load", status, detail);
    return { stage: "ingest_entsoe_load", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_entsoe_load", "failed", detail);
    return { stage: "ingest_entsoe_load", status: "failed", detail };
  }
}

export async function ingestEntsoeGeneration(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const { points, errors } = await fetchEntsoeGeneration();
    await upsertMetrics(db, points);
    const status = errors.length === 0 ? "ok" : points.length > 0 ? "warning" : "failed";
    const detail = { points: points.length, errors };
    await logRun(db, runDate, "ingest_entsoe_generation", status, detail);
    return { stage: "ingest_entsoe_generation", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_entsoe_generation", "failed", detail);
    return { stage: "ingest_entsoe_generation", status: "failed", detail };
  }
}

export async function ingestEntsoeCrossBorderFlows(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  // Same per-item-isolation + incremental-upsert lesson as the oleochemical
  // trade flows above: 18 borders x 2 directions x a 1-month ENTSO-E query
  // each is enough calls that one border's failure (or the stage running
  // long) shouldn't cost every other border's already-fetched data.
  let totalPoints = 0;
  const errors: string[] = [];
  for (const border of EU_GRID_BORDERS) {
    try {
      const points = await fetchEntsoeCrossBorderFlowsForBorder(border);
      await upsertMetrics(db, points);
      totalPoints += points.length;
    } catch (e) {
      errors.push(`${border.outSlug}-${border.inSlug}: ${(e as Error).message}`);
    }
  }
  const status = errors.length === 0 ? "ok" : totalPoints > 0 ? "warning" : "failed";
  const detail = { points: totalPoints, errors };
  await logRun(db, runDate, "ingest_entsoe_cross_border_flows", status, detail);
  return { stage: "ingest_entsoe_cross_border_flows", status, detail };
}

export async function ingestWorldBankCommodities(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    // The Pink Sheet workbook itself has genuine monthly data back to 1960
    // (fetchWorldBankCommodityPrices parses the whole sheet regardless of
    // this cutoff), but this stage previously discarded everything older
    // than 10 years before it ever reached Supabase — so every "monthly
    // since 1960" claim elsewhere in this codebase (taxonomy.ts,
    // oilseedsPriceCycles.ts, commodities.ts) was actually only true of the
    // source file, not of what was stored. Multi-year cycle detection
    // (oilseedsPriceCycles.ts) specifically needs decades of history to be
    // meaningful, so this now stores the full series, matching the
    // ingestEnergyBacktestSeries precedent above for the same reason.
    const points = await fetchWorldBankCommodityPrices("1960-01-01");
    // ~54 commodities x up to 66 years x 12 months can approach ~40,000 rows
    // on a full backfill (vs. ~800/month on every run after) — chunked to
    // stay well under any single-request payload/row limit rather than
    // risking one oversized upsert.
    const CHUNK_SIZE = 5000;
    for (let i = 0; i < points.length; i += CHUNK_SIZE) {
      await upsertMetrics(db, points.slice(i, i + CHUNK_SIZE));
    }
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_world_bank_commodities", status, detail);
    return { stage: "ingest_world_bank_commodities", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_world_bank_commodities", "failed", detail);
    return { stage: "ingest_world_bank_commodities", status: "failed", detail };
  }
}

export async function ingestCriticalMinerals(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const since = new Date();
    since.setUTCFullYear(since.getUTCFullYear() - 20);
    const points = await fetchCriticalMineralPrices(since.toISOString());
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_critical_minerals", status, detail);
    return { stage: "ingest_critical_minerals", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_critical_minerals", "failed", detail);
    return { stage: "ingest_critical_minerals", status: "failed", detail };
  }
}

export async function ingestUsdaPsdBalances(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchUsdaPsdBalances();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_usda_psd_balances", status, detail);
    return { stage: "ingest_usda_psd_balances", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_usda_psd_balances", "failed", detail);
    return { stage: "ingest_usda_psd_balances", status: "failed", detail };
  }
}

export async function ingestUsdaPsdSoybeanCountries(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchUsdaPsdSoybeanCountryBalances();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_usda_psd_soybean_countries", status, detail);
    return { stage: "ingest_usda_psd_soybean_countries", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_usda_psd_soybean_countries", "failed", detail);
    return { stage: "ingest_usda_psd_soybean_countries", status: "failed", detail };
  }
}

export async function ingestUsdaPsdCountryBalances(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchUsdaPsdCountryBalances();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_usda_psd_country_balances", status, detail);
    return { stage: "ingest_usda_psd_country_balances", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_usda_psd_country_balances", "failed", detail);
    return { stage: "ingest_usda_psd_country_balances", status: "failed", detail };
  }
}

export async function ingestUsgsMineralCommodities(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchUsgsMineralCommodities();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_usgs_mineral_commodities", status, detail);
    return { stage: "ingest_usgs_mineral_commodities", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_usgs_mineral_commodities", "failed", detail);
    return { stage: "ingest_usgs_mineral_commodities", status: "failed", detail };
  }
}

export async function ingestUsgsCommodityCountryTrade(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  // Same per-commodity incremental-upsert lesson as the oleochemical UN
  // Comtrade connector: ~18 commodities x up to 10 countries each must never
  // let one slow/gap-heavy commodity cost every other commodity's
  // already-fetched data.
  //
  // Resumes from wherever the previous run left off instead of always
  // restarting at index 0 of USGS_TRADE_COMMODITIES. The shared UN Comtrade
  // daily quota is split across three concurrent pipeline stages (this one,
  // ingest_un_comtrade_energy_flows, ingest_un_comtrade_oleochemical_flows),
  // and always starting this stage at the same commodity meant whichever
  // commodity happened to be first (Gold) absorbed every retry while
  // everything after it — in practice every Base Metal and Fertilizer,
  // including Nickel and Tin — never got a turn. Confirmed live: before this
  // fix, this stage had run exactly once ever and failed on its very first
  // API call with a quota-exhausted error, so zero country-level trade data
  // existed for any of the 18 commodities.
  const n = USGS_TRADE_COMMODITIES.length;
  const { data: lastRun } = await db
    .from("pipeline_runs")
    .select("detail")
    .eq("stage", "ingest_usgs_commodity_country_trade")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastNextIndex = (lastRun?.detail as { nextIndex?: number } | null)?.nextIndex;
  const startIndex = typeof lastNextIndex === "number" && Number.isInteger(lastNextIndex) ? ((lastNextIndex % n) + n) % n : 0;

  let totalPoints = 0;
  const errors: string[] = [];
  let stoppedAtIndex: number | null = null;
  // Stop starting new items 45s before this stage's 190s budget so it returns normally with a resumable
  // cursor, instead of being abandoned (which logs no nextIndex and would restart at the same items every run).
  const deadline = Date.now() + 145000;
  for (let i = 0; i < n; i++) {
    const index = (startIndex + i) % n;
    if (i > 0 && Date.now() > deadline) {
      errors.push(`time budget reached; ${index} onward resumes on the next run`);
      stoppedAtIndex = index;
      break;
    }
    const commodity = USGS_TRADE_COMMODITIES[index];
    try {
      const { points, errors: commodityErrors } = await fetchUsgsCommodityCountryTradeForCommodity(commodity);
      await upsertMetrics(db, points);
      totalPoints += points.length;
      errors.push(...commodityErrors);
    } catch (e) {
      // The registered key's DAILY call-volume quota (distinct from the
      // per-burst rate limit) is shared across every UN Comtrade stage in
      // this pipeline — once exhausted, every remaining call fails
      // identically, so stop here rather than recording the same failure
      // once per remaining commodity. Whatever already upserted above stays
      // safe; the rest resumes right here (not from the top) on the next run.
      // ComtradeRateLimitedError (the shared 429-after-retries bucket, most
      // likely exhausted by one of the other 3 concurrent UN Comtrade
      // stages in this same run) is treated the same way as the daily 403
      // quota below — both mean every remaining call this run is guaranteed
      // to fail identically.
      if (e instanceof ComtradeQuotaExceededError || e instanceof ComtradeRateLimitedError) {
        errors.push(`stopped early: ${e.message} (${commodity.slug} onward deferred to a later run)`);
        stoppedAtIndex = index;
        break;
      }
      errors.push(`${commodity.slug}: ${(e as Error).message}`);
    }
  }
  const nextIndex = stoppedAtIndex ?? 0; // full cycle completed -> next run starts over from the top
  const status = errors.length === 0 ? "ok" : totalPoints > 0 ? "warning" : "failed";
  const detail = { points: totalPoints, errors, startIndex, nextIndex };
  await logRun(db, runDate, "ingest_usgs_commodity_country_trade", status, detail);
  return { stage: "ingest_usgs_commodity_country_trade", status, detail };
}

/** Same resumable-cursor design as ingestUsgsCommodityCountryTrade just
 * above, for the same reason: a shared UN Comtrade daily quota split across
 * several concurrent stages must not let this one always restart at the
 * same HS code and starve everything after it. Much cheaper per cycle than
 * that stage though (one reference-reporter call per HS code, ~46 codes,
 * vs. ~150-180 (country, commodity) pairs), so it's far less likely to need
 * more than one run to finish. */
export async function ingestChemicalHsUnitValues(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const codes = getChemicalPriceHsCodes();
  const n = codes.length;
  const { data: lastRun } = await db
    .from("pipeline_runs")
    .select("detail")
    .eq("stage", "ingest_chemical_hs_unit_values")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastNextIndex = (lastRun?.detail as { nextIndex?: number } | null)?.nextIndex;
  const startIndex = typeof lastNextIndex === "number" && Number.isInteger(lastNextIndex) ? ((lastNextIndex % n) + n) % n : 0;

  let totalPoints = 0;
  const errors: string[] = [];
  let stoppedAtIndex: number | null = null;
  // Stop starting new items 45s before this stage's 190s budget so it returns normally with a resumable
  // cursor, instead of being abandoned (which logs no nextIndex and would restart at the same items every run).
  const deadline = Date.now() + 145000;
  for (let i = 0; i < n; i++) {
    const index = (startIndex + i) % n;
    if (i > 0 && Date.now() > deadline) {
      errors.push(`time budget reached; ${index} onward resumes on the next run`);
      stoppedAtIndex = index;
      break;
    }
    const group = codes[index];
    try {
      const points = await fetchChemicalHsUnitValue(group);
      await upsertMetrics(db, points);
      totalPoints += points.length;
    } catch (e) {
      // Same shared-bucket reasoning as ingestUsgsCommodityCountryTrade's
      // identical check just above.
      if (e instanceof ChemicalPriceQuotaExceededError || e instanceof ComtradeRateLimitedError) {
        errors.push(`stopped early: ${e.message} (hs ${group.primary} onward deferred to a later run)`);
        stoppedAtIndex = index;
        break;
      }
      errors.push(`hs ${group.primary}: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, CHEMICAL_PRICE_DELAY_MS));
  }
  const nextIndex = stoppedAtIndex ?? 0;
  const status = errors.length === 0 ? "ok" : totalPoints > 0 ? "warning" : "failed";
  const detail = { points: totalPoints, errors, startIndex, nextIndex };
  await logRun(db, runDate, "ingest_chemical_hs_unit_values", status, detail);
  return { stage: "ingest_chemical_hs_unit_values", status, detail };
}

/** Same resumable-cursor design as ingestChemicalHsUnitValues just above,
 * for the same reason: Massive's undocumented per-minute rate limit
 * (confirmed live) can stop this mid-list, and the next run should pick up
 * where this one left off rather than always restarting at Crude Oil and
 * starving whatever comes later in MASSIVE_FUTURES_PRODUCTS. */
export async function ingestMassiveFutures(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const apiKey = process.env.MASSIVE_API_KEY;
  if (!apiKey) {
    await logRun(db, runDate, "ingest_massive_futures", "warning", { reason: "MASSIVE_API_KEY not set" });
    return { stage: "ingest_massive_futures", status: "warning", detail: { reason: "MASSIVE_API_KEY not set" } };
  }
  const n = MASSIVE_FUTURES_PRODUCTS.length;
  const { data: lastRun } = await db
    .from("pipeline_runs")
    .select("detail")
    .eq("stage", "ingest_massive_futures")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastNextIndex = (lastRun?.detail as { nextIndex?: number } | null)?.nextIndex;
  const startIndex = typeof lastNextIndex === "number" && Number.isInteger(lastNextIndex) ? ((lastNextIndex % n) + n) % n : 0;

  let totalPoints = 0;
  const notFound: string[] = [];
  const errors: string[] = [];
  let stoppedAtIndex: number | null = null;
  for (let i = 0; i < n; i++) {
    const index = (startIndex + i) % n;
    const product = MASSIVE_FUTURES_PRODUCTS[index];
    try {
      const points = await fetchMassiveFuturesProduct(apiKey, product);
      if (points.length === 0) notFound.push(product.slug);
      await upsertMetrics(db, points);
      totalPoints += points.length;
    } catch (e) {
      if (e instanceof MassiveRateLimitError) {
        errors.push(`stopped early: ${e.message} (${product.slug} onward deferred to a later run)`);
        stoppedAtIndex = index;
        break;
      }
      errors.push(`${product.slug}: ${(e as Error).message}`);
    }
  }
  const nextIndex = stoppedAtIndex ?? 0;
  const status = errors.length === 0 ? "ok" : totalPoints > 0 ? "warning" : "failed";
  const detail = { points: totalPoints, notFound, errors, startIndex, nextIndex };
  await logRun(db, runDate, "ingest_massive_futures", status, detail);
  return { stage: "ingest_massive_futures", status, detail };
}

export async function ingestFaostatProduction(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchFaostatProduction();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_faostat_production", status, detail);
    return { stage: "ingest_faostat_production", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_faostat_production", "failed", detail);
    return { stage: "ingest_faostat_production", status: "failed", detail };
  }
}

export async function ingestEiaWorldEnergy(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) {
    await logRun(db, runDate, "ingest_eia_world_energy", "warning", { reason: "EIA_API_KEY not set" });
    return { stage: "ingest_eia_world_energy", status: "warning", detail: { reason: "EIA_API_KEY not set" } };
  }
  try {
    const points = await fetchEiaWorldEnergyBalances(apiKey);
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_eia_world_energy", status, detail);
    return { stage: "ingest_eia_world_energy", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_eia_world_energy", "failed", detail);
    return { stage: "ingest_eia_world_energy", status: "failed", detail };
  }
}

export async function ingestBpsIndonesia(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  const apiKey = process.env.BPS_API_KEY;
  if (!apiKey) {
    await logRun(db, runDate, "ingest_bps_indonesia", "warning", { reason: "BPS_API_KEY not set" });
    return { stage: "ingest_bps_indonesia", status: "warning", detail: { reason: "BPS_API_KEY not set" } };
  }
  try {
    const points = await fetchBpsIndonesiaBalances(apiKey);
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_bps_indonesia", status, detail);
    return { stage: "ingest_bps_indonesia", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_bps_indonesia", "failed", detail);
    return { stage: "ingest_bps_indonesia", status: "failed", detail };
  }
}

export async function ingestMpobMalaysia(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchMpobMalaysiaExports();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_mpob_malaysia", status, detail);
    return { stage: "ingest_mpob_malaysia", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_mpob_malaysia", "failed", detail);
    return { stage: "ingest_mpob_malaysia", status: "failed", detail };
  }
}

export async function ingestNoaaOni(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchNoaaOni();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_noaa_oni", status, detail);
    return { stage: "ingest_noaa_oni", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_noaa_oni", "failed", detail);
    return { stage: "ingest_noaa_oni", status: "failed", detail };
  }
}

export async function ingestNasaPowerRainfall(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchNasaPowerRainfall();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_nasa_power_rainfall", status, detail);
    return { stage: "ingest_nasa_power_rainfall", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_nasa_power_rainfall", "failed", detail);
    return { stage: "ingest_nasa_power_rainfall", status: "failed", detail };
  }
}

export async function ingestFaostatOilseedsCountryProduction(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchFaostatOilseedsCountryProduction();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_faostat_oilseeds_country", status, detail);
    return { stage: "ingest_faostat_oilseeds_country", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_faostat_oilseeds_country", "failed", detail);
    return { stage: "ingest_faostat_oilseeds_country", status: "failed", detail };
  }
}

export async function ingestMpobMirror(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchMpobMirror();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_mpob_mirror", status, detail);
    return { stage: "ingest_mpob_mirror", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_mpob_mirror", "failed", detail);
    return { stage: "ingest_mpob_mirror", status: "failed", detail };
  }
}

export async function ingestCpcEnsoForecast(db: SupabaseClient, runDate: string): Promise<IngestStageResult> {
  try {
    const points = await fetchCpcEnsoForecast();
    await upsertMetrics(db, points);
    const status = points.length > 0 ? "ok" : "warning";
    const detail = { points: points.length };
    await logRun(db, runDate, "ingest_cpc_enso_forecast", status, detail);
    return { stage: "ingest_cpc_enso_forecast", status, detail };
  } catch (e) {
    const detail = { error: (e as Error).message };
    await logRun(db, runDate, "ingest_cpc_enso_forecast", "failed", detail);
    return { stage: "ingest_cpc_enso_forecast", status: "failed", detail };
  }
}

export async function runIngestionPipeline(db: SupabaseClient) {
  const runDate = new Date().toISOString().slice(0, 10);

  // RBI ("ingest_rbi_liquidity"/"ingest_rbi_yield_curve") runs as its own
  // pre-phase, isolated from the ~75-way concurrent flood below, before
  // that flood starts. Real evidence for why, gathered live in production
  // rather than assumed: a standalone call to the exact same fetch
  // succeeded in 3.8s; a full pipeline run then succeeded outright (20 +
  // 299 real points) once the per-fetch timeout was widened; the very next,
  // otherwise-identical run failed again with the same generic timeout.
  // Same code, different outcome, with RBI's own server independently
  // confirmed fast — the variable is how much OTHER concurrent load this
  // invocation happens to be under, i.e. event-loop/network contention from
  // ~75 other stages all firing at once, not RBI or its timeout value.
  // Running these two to completion first gives them a much quieter
  // environment. Not the 220s they got inline, and not the 100s first tried
  // here (see route.ts's own comment on why 100s + a raised maxDuration got
  // reverted — this account's plan caps function duration at 300s). Live-
  // tested at 60s each: liquidity succeeded (20 real points) but yield
  // curve was abandoned at 60s — it fetches more releases per run (299
  // points in an earlier full-backfill run) than liquidity typically does,
  // so it genuinely needs more wall-clock time even fully uncontended. The
  // two run concurrently with each other here, so giving yield curve more
  // only costs extra time on days it actually needs it — liquidity finishing
  // early doesn't wait around. This adds up to 90s of real serial time on
  // top of the route's existing (unchanged, plan-capped) 300s ceiling
  // rather than creating dedicated headroom for it — accepted as the same
  // "not every stage hits its worst case simultaneously" empirical
  // assumption the whole pipeline already ran on before this change, not a
  // formally airtight worst-case guarantee.
  const rbiResults = await Promise.all([
    withStageTimeout("ingest_rbi_liquidity", ingestRbiLiquidity(db, runDate), 60_000, db, runDate),
    withStageTimeout("ingest_rbi_yield_curve", ingestRbiYieldCurve(db, runDate), 90_000, db, runDate),
  ]);

  // Every stage below races against a shared 150s safety net (see
  // withStageTimeout above) — comfortably under the remaining budget even
  // with several stages concurrently at their own limit, since they all run
  // in parallel with each other (just no longer with RBI).
  const withTimeout = (stage: string, p: Promise<IngestStageResult>) => withStageTimeout(stage, p, 150_000, db, runDate);
  // The four UN Comtrade stages share ONE account-wide rate limit (~1 call / 3s, see
  // unComtradeRateLimit.ts) — roughly 60 calls per 190s window in total. Run all four at
  // once and each got ~15, so none finished (energy_flows never did). Instead each day only
  // one pair runs and gets the whole limit; the other pair runs the next day. A skipped
  // stage is NOT logged to pipeline_runs — its resume cursor lives in its last row there.
  const comtradeGroupToday: "A" | "B" = Math.floor(Date.now() / 86_400_000) % 2 === 0 ? "A" : "B";
  const comtradeRotated = (group: "A" | "B", stage: string, run: () => Promise<IngestStageResult>): Promise<IngestStageResult> =>
    group === comtradeGroupToday
      ? withStageTimeout(stage, run(), 190_000, db, runDate)
      : Promise.resolve({ stage, status: "ok" as const, detail: { skipped: true, reason: "UN Comtrade stages rotate daily to share one rate limit; this stage runs on alternate days" } });
  const results = await Promise.all([
    withTimeout("ingest_fred", ingestFred(db, runDate)),
    withTimeout("ingest_fx", ingestFx(db, runDate)),
    withTimeout("ingest_yahoo_indices", ingestYahooIndices(db, runDate)),
    withTimeout("ingest_cftc", ingestCftc(db, runDate)),
    withTimeout("ingest_cftc_extended", ingestCftcExtended(db, runDate)),
    withTimeout("ingest_bis_otc_derivatives", ingestBisOtcDerivatives(db, runDate)),
    withTimeout("ingest_nyfed_repo", ingestNyFedRepo(db, runDate)),
    withTimeout("ingest_okx_perpetuals", ingestOkxPerpetuals(db, runDate)),
    withTimeout("ingest_nse_fo_bhavcopy", ingestNseFoBhavcopy(db, runDate)),
    // Downloads and streams 4 separate multi-MB DTCC files sequentially (own internal
    // 180s budget, see dtccSwapData.ts) — longer stage ceiling than the default 150s.
    withStageTimeout("ingest_dtcc_swap_data", ingestDtccSwapData(db, runDate), 190_000, db, runDate),
    withTimeout("ingest_hkex_derivatives", ingestHkexDerivatives(db, runDate)),
    withTimeout("ingest_taifex_derivatives", ingestTaifexDerivatives(db, runDate)),
    withTimeout("ingest_cffex_derivatives", ingestCffexDerivatives(db, runDate)),
    withTimeout("ingest_deribit_options", ingestDeribitOptions(db, runDate)),
    withTimeout("ingest_ice_futures_europe_cot", ingestIceFuturesEuropeCot(db, runDate)),
    withTimeout("ingest_b3_derivatives", ingestB3Derivatives(db, runDate)),
    withTimeout("ingest_central_bank_feeds", ingestCentralBankFeeds(db, runDate)),
    withTimeout("ingest_gscpi", ingestGscpi(db, runDate)),
    withTimeout("ingest_gpr", ingestGpr(db, runDate)),
    withTimeout("ingest_crypto", ingestCrypto(db, runDate)),
    withTimeout("ingest_cloud_status", ingestCloudStatus(db, runDate)),
    withTimeout("ingest_sec_edgar", ingestSecEdgar(db, runDate)),
    withTimeout("ingest_gov_bond_yields", ingestGovBondYields(db, runDate)),
    withTimeout("ingest_gov_liquidity", ingestGovLiquidity(db, runDate)),
    withTimeout("ingest_central_bank_short_rates", ingestCentralBankShortRates(db, runDate)),
    withTimeout("ingest_bis_credit_gaps", ingestBisCreditGaps(db, runDate)),
    withTimeout("ingest_china_lgfv_debt", ingestChinaLgfvDebt(db, runDate)),
    withStageTimeout("ingest_gov_cn_statistics", ingestGovCnStatistics(db, runDate), 190_000, db, runDate),
    withTimeout("ingest_statcan", ingestStatCan(db, runDate)),
    withTimeout("ingest_em_debt_structural", ingestEmDebtStructural(db, runDate)),
    withTimeout("ingest_em_debt_sovereign_cds", ingestEmDebtSovereignCds(db, runDate)),
    withTimeout("ingest_em_debt_foreign_holdings", ingestEmDebtForeignHoldings(db, runDate)),
    withTimeout("ingest_em_debt_corporate_fx", ingestEmDebtCorporateFx(db, runDate)),
    withTimeout("ingest_em_debt_fiscal_gaps", ingestEmDebtFiscalGaps(db, runDate)),
    withTimeout("ingest_em_debt_qeds_gaps", ingestEmDebtQedsGaps(db, runDate)),
    withTimeout("ingest_g7_fiscal_data", ingestG7FiscalData(db, runDate)),
    withTimeout("ingest_us_treasury_live", ingestUsTreasuryLiveData(db, runDate)),
    withTimeout("ingest_us_treasury_cash", ingestUsTreasuryCash(db, runDate)),
    withTimeout("ingest_china_fx_reserves", ingestChinaFxReserves(db, runDate)),
    withTimeout("ingest_bank_financial_soundness", ingestBankFinancialSoundness(db, runDate)),
    withTimeout("ingest_bank_sec_filings", ingestBankSecFilings(db, runDate)),
    withTimeout("ingest_bank_fdic_metrics", ingestBankFdicMetrics(db, runDate)),
    withTimeout("ingest_india_property_prices", ingestIndiaPropertyPrices(db, runDate)),
    withTimeout("ingest_central_bank_fsr_checks", ingestCentralBankFsrChecks(db, runDate)),
    withTimeout("ingest_bis_global_liquidity", ingestBisGlobalLiquidity(db, runDate)),
    withTimeout("ingest_nbfi_checks", ingestNbfiChecks(db, runDate)),
    withTimeout("ingest_energy_chokepoints", ingestEnergyChokepoints(db, runDate)),
    withTimeout("ingest_eia_energy", ingestEiaEnergy(db, runDate)),
    withTimeout("ingest_iso_ne_grid", ingestIsoNeGrid(db, runDate)),
    withTimeout("ingest_caiso_grid", ingestCaisoGrid(db, runDate)),
    withTimeout("ingest_nyiso_grid", ingestNyisoGrid(db, runDate)),
    withTimeout("ingest_eia_grid_monitor", ingestEiaGridMonitor(db, runDate)),
    withTimeout("ingest_irena_renewables", ingestIrenaRenewables(db, runDate)),
    comtradeRotated("A", "ingest_un_comtrade_energy_flows", () => ingestUnComtradeEnergyFlows(db, runDate)),
    // 7 commodities x (1 probe + 3 reporter-chunks + 2 trend calls) each with
    // its own 429-retry risk measured live at ~130-140s end-to-end even on
    // the registered-key tier — comfortably reports "ok" within 250s rather
    // than relying on the "keeps running in the background after the
    // timeout fires" fallback (still safe either way, but this way the
    // pipeline_runs row reflects reality). Other stages are unaffected: this
    // only raises THIS stage's own individual ceiling, still under the
    // route's shared 300s maxDuration, and Promise.all already waits for
    // whichever stage is slowest regardless.
    comtradeRotated("B", "ingest_un_comtrade_oleochemical_flows", () => ingestUnComtradeOleochemicalFlows(db, runDate)),
    withTimeout("ingest_entsoe_day_ahead_prices", ingestEntsoeDayAheadPrices(db, runDate)),
    withTimeout("ingest_entsoe_load", ingestEntsoeLoad(db, runDate)),
    withTimeout("ingest_entsoe_generation", ingestEntsoeGeneration(db, runDate)),
    withStageTimeout("ingest_entsoe_cross_border_flows", ingestEntsoeCrossBorderFlows(db, runDate), 190_000, db, runDate),
    withTimeout("ingest_energy_backtest_series", ingestEnergyBacktestSeries(db, runDate)),
    withTimeout("ingest_central_bank_rate_history", ingestCentralBankRateHistory(db, runDate)),
    withTimeout("ingest_world_bank_commodities", ingestWorldBankCommodities(db, runDate)),
    withTimeout("ingest_critical_minerals", ingestCriticalMinerals(db, runDate)),
    withTimeout("ingest_usda_psd_balances", ingestUsdaPsdBalances(db, runDate)),
    withTimeout("ingest_usda_psd_soybean_countries", ingestUsdaPsdSoybeanCountries(db, runDate)),
    withTimeout("ingest_usda_psd_country_balances", ingestUsdaPsdCountryBalances(db, runDate)),
    withTimeout("ingest_usgs_mineral_commodities", ingestUsgsMineralCommodities(db, runDate)),
    // ~18 commodities x up to 10 countries x 1-5 probe calls each — same
    // reasoning as the oleochemical stage's own 250s override: measured
    // wall-clock cost is close enough to the shared 150s budget that normal
    // network jitter would routinely trip the "abandoned" fallback even
    // though the underlying per-commodity upserts land safely regardless.
    comtradeRotated("B", "ingest_usgs_commodity_country_trade", () => ingestUsgsCommodityCountryTrade(db, runDate)),
    comtradeRotated("A", "ingest_chemical_hs_unit_values", () => ingestChemicalHsUnitValues(db, runDate)),
    withTimeout("ingest_massive_futures", ingestMassiveFutures(db, runDate)),
    withTimeout("ingest_faostat_production", ingestFaostatProduction(db, runDate)),
    withTimeout("ingest_eia_world_energy", ingestEiaWorldEnergy(db, runDate)),
    withTimeout("ingest_bps_indonesia", ingestBpsIndonesia(db, runDate)),
    withTimeout("ingest_mpob_malaysia", ingestMpobMalaysia(db, runDate)),
    withTimeout("ingest_noaa_oni", ingestNoaaOni(db, runDate)),
    withTimeout("ingest_nasa_power_rainfall", ingestNasaPowerRainfall(db, runDate)),
    withTimeout("ingest_faostat_oilseeds_country", ingestFaostatOilseedsCountryProduction(db, runDate)),
    withTimeout("ingest_mpob_mirror", ingestMpobMirror(db, runDate)),
    withTimeout("ingest_cpc_enso_forecast", ingestCpcEnsoForecast(db, runDate)),
  ]);
  return { runDate, results: [...rbiResults, ...results] };
}
