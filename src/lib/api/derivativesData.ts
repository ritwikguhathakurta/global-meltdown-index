import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchSeries, fetchLatestForKeys } from "@/lib/metrics/store";
import type { Point } from "@/lib/metrics/stats";
import { zScore } from "@/lib/metrics/stats";
import { computePci, buildPositioningRow, type PositioningMarketDef } from "@/lib/derivatives/positioning";
import { computeGli, computeCri } from "@/lib/derivatives/leverage";
import { computeMsi, computeCsi, computeFdrAndDls, computeCalciAndRegime } from "@/lib/derivatives/stress";
import { HISTORICAL_CRISES } from "@/lib/derivatives/historical";
import { BIS_OTC_RISK_CATEGORIES } from "@/lib/sources/bisOtcDerivatives";
import { BANK_COMPANIES } from "@/lib/sources/bankSecFilings";
import type { CompositeIndex, LeverageRegime, PositioningRow } from "@/lib/derivatives/types";

const POSITIONING_MARKETS: PositioningMarketDef[] = [
  { market: "E-mini S&P 500", category: "Non-commercial", metricKey: "cot.sp500_emini.noncomm_net_pct_oi" },
  { market: "VIX Futures", category: "Non-commercial", metricKey: "cot.vix_futures.noncomm_net_pct_oi" },
  { market: "10Y Treasury", category: "Leveraged Funds", metricKey: "cot_tff.treasury_10y.leveraged_funds_net_pct_oi" },
  { market: "10Y Treasury", category: "Asset Manager", metricKey: "cot_tff.treasury_10y.asset_manager_net_pct_oi" },
  { market: "10Y Treasury", category: "Dealer", metricKey: "cot_tff.treasury_10y.dealer_net_pct_oi" },
  { market: "2Y Treasury", category: "Leveraged Funds", metricKey: "cot_tff.treasury_2y.leveraged_funds_net_pct_oi" },
  { market: "5Y Treasury", category: "Leveraged Funds", metricKey: "cot_tff.treasury_5y.leveraged_funds_net_pct_oi" },
  { market: "30Y Treasury Bond", category: "Leveraged Funds", metricKey: "cot_tff.treasury_30y.leveraged_funds_net_pct_oi" },
  { market: "Gold", category: "Managed Money", metricKey: "cot_disagg.gold.managed_money_net_pct_oi" },
  { market: "Gold", category: "Swap Dealer", metricKey: "cot_disagg.gold.swap_dealer_net_pct_oi" },
  { market: "Crude Oil (WTI)", category: "Managed Money", metricKey: "cot_disagg.crude_oil.managed_money_net_pct_oi" },
  { market: "Natural Gas", category: "Managed Money", metricKey: "cot_disagg.natural_gas.managed_money_net_pct_oi" },
];

const NEEDED_KEYS = [
  ...POSITIONING_MARKETS.map((d) => d.metricKey),
  ...Object.values(BIS_OTC_RISK_CATEGORIES).map((r) => r.metricKey),
  "derivatives.repo.sofr.rate",
  "derivatives.repo.sofr.dispersion",
  "derivatives.repo.sofr.volume",
  "derivatives.repo.tgcr.rate",
  "derivatives.repo.bgcr.rate",
  "derivatives.crypto_perp.btc.funding_rate",
  "derivatives.crypto_perp.btc.open_interest",
  "derivatives.crypto_perp.eth.funding_rate",
  "derivatives.crypto_perp.eth.open_interest",
  "derivatives.move_index",
  "vol.vix",
  "credit.hy_oas",
  "credit.us_credit_gap",
  ...BANK_COMPANIES.flatMap((b) => [`bankfdic.${b.key}.leverage_ratio`, `bank.${b.key}.derivative_notional`, `bank.${b.key}.derivative_assets`, `bank.${b.key}.derivative_liabilities`]),
];

export type BisOtcRow = { key: string; label: string; notionalUsd: number | null; asOf: string | null };
export type RepoRow = { key: string; label: string; rate: number | null; dispersion: number | null; volumeBn: number | null; asOf: string | null };
export type BankLeverageRow = { key: string; name: string; leverageRatio: number | null; derivativeNotional: number | null; derivativeAssets: number | null; derivativeLiabilities: number | null };
export type CryptoRow = { symbol: string; fundingRate: number | null; openInterest: number | null; asOf: string | null };

export type DerivativesPageData = {
  fetchedAt: string;
  indices: { gli: CompositeIndex; cri: CompositeIndex; msi: CompositeIndex; csi: CompositeIndex; fdr: CompositeIndex; dls: CompositeIndex; calci: CompositeIndex; pci: CompositeIndex };
  regime: LeverageRegime;
  positioningRows: PositioningRow[];
  bisOtc: BisOtcRow[];
  repo: RepoRow[];
  bankLeverage: BankLeverageRow[];
  crypto: CryptoRow[];
  vix: { value: number | null; asOf: string | null };
  move: { value: number | null; asOf: string | null };
  historicalCrises: typeof HISTORICAL_CRISES;
};

export async function getDerivativesPageData(): Promise<DerivativesPageData | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    const since2y = new Date(Date.now() - 780 * 86_400_000).toISOString();
    const since1y = new Date(Date.now() - 400 * 86_400_000).toISOString();

    const [latestMap, positioningSeries, otcSeries, repoSofrDispersionSeries, repoSofrVolumeSeries, vixSeries, moveSeries, hyOasSeries, creditGapSeries] = await Promise.all([
      fetchLatestForKeys(db, NEEDED_KEYS),
      Promise.all(POSITIONING_MARKETS.map((d) => fetchSeries(db, d.metricKey, since2y).catch(() => [] as Point[]))),
      Promise.all(Object.values(BIS_OTC_RISK_CATEGORIES).map((r) => fetchSeries(db, r.metricKey, since2y).catch(() => [] as Point[]))),
      fetchSeries(db, "derivatives.repo.sofr.dispersion", since1y).catch(() => [] as Point[]),
      fetchSeries(db, "derivatives.repo.sofr.volume", since1y).catch(() => [] as Point[]),
      fetchSeries(db, "vol.vix", since1y).catch(() => [] as Point[]),
      fetchSeries(db, "derivatives.move_index", since1y).catch(() => [] as Point[]),
      fetchSeries(db, "credit.hy_oas", since1y).catch(() => [] as Point[]),
      fetchSeries(db, "credit.us_credit_gap", since2y).catch(() => [] as Point[]),
    ]);

    const positioningSeriesByKey = new Map<string, Point[]>(POSITIONING_MARKETS.map((d, i) => [d.metricKey, positioningSeries[i]]));
    const positioningRows = POSITIONING_MARKETS.map((d) => buildPositioningRow(d, positioningSeriesByKey.get(d.metricKey) ?? []));
    const pci = computePci(POSITIONING_MARKETS, positioningSeriesByKey);

    const otcSeriesByKey = new Map(Object.values(BIS_OTC_RISK_CATEGORIES).map((r, i) => [r.metricKey, otcSeries[i]]));
    const bisOtc: BisOtcRow[] = Object.entries(BIS_OTC_RISK_CATEGORIES).map(([, r]) => {
      const l = latestMap.get(r.metricKey);
      return { key: r.code, label: r.label, notionalUsd: l?.v ?? null, asOf: l?.t ?? null };
    });
    const otcTotalSeries = otcSeriesByKey.get(BIS_OTC_RISK_CATEGORIES.total.metricKey) ?? [];

    const bankLeverage: BankLeverageRow[] = BANK_COMPANIES.map((b) => ({
      key: b.key,
      name: b.name,
      leverageRatio: latestMap.get(`bankfdic.${b.key}.leverage_ratio`)?.v ?? null,
      derivativeNotional: latestMap.get(`bank.${b.key}.derivative_notional`)?.v ?? null,
      derivativeAssets: latestMap.get(`bank.${b.key}.derivative_assets`)?.v ?? null,
      derivativeLiabilities: latestMap.get(`bank.${b.key}.derivative_liabilities`)?.v ?? null,
    }));
    const bankLeverageRatios = bankLeverage.map((b) => ({ bank: b.key, ratio: b.leverageRatio, asOf: null }));

    const repoRates: RepoRow[] = [
      { key: "sofr", label: "SOFR", rate: latestMap.get("derivatives.repo.sofr.rate")?.v ?? null, dispersion: latestMap.get("derivatives.repo.sofr.dispersion")?.v ?? null, volumeBn: latestMap.get("derivatives.repo.sofr.volume")?.v ?? null, asOf: latestMap.get("derivatives.repo.sofr.rate")?.t ?? null },
      { key: "tgcr", label: "TGCR (Tri-Party GC)", rate: latestMap.get("derivatives.repo.tgcr.rate")?.v ?? null, dispersion: null, volumeBn: null, asOf: latestMap.get("derivatives.repo.tgcr.rate")?.t ?? null },
      { key: "bgcr", label: "BGCR (Broad GC)", rate: latestMap.get("derivatives.repo.bgcr.rate")?.v ?? null, dispersion: null, volumeBn: null, asOf: latestMap.get("derivatives.repo.bgcr.rate")?.t ?? null },
    ];

    const crypto: CryptoRow[] = [
      { symbol: "BTC", fundingRate: latestMap.get("derivatives.crypto_perp.btc.funding_rate")?.v ?? null, openInterest: latestMap.get("derivatives.crypto_perp.btc.open_interest")?.v ?? null, asOf: latestMap.get("derivatives.crypto_perp.btc.funding_rate")?.t ?? null },
      { symbol: "ETH", fundingRate: latestMap.get("derivatives.crypto_perp.eth.funding_rate")?.v ?? null, openInterest: latestMap.get("derivatives.crypto_perp.eth.open_interest")?.v ?? null, asOf: latestMap.get("derivatives.crypto_perp.eth.funding_rate")?.t ?? null },
    ];

    const gli = computeGli({ otcNotionalTotal: otcTotalSeries, creditGapSeries: [creditGapSeries], bankLeverageRatios, repoVolume: repoSofrVolumeSeries });
    const creditSpreadZ = zScore(hyOasSeries, 252);
    const cri = computeCri({ bankLeverageRatios, creditSpreadZ });
    const msi = computeMsi({ vix: vixSeries, move: moveSeries, positioningLevel: pci.level });
    const csi = computeCsi({ repoDispersion: repoSofrDispersionSeries, repoVolumeChange: null });
    const { fdr, dls } = computeFdrAndDls(msi, csi, pci);
    const { calci, regime } = computeCalciAndRegime(gli, msi, csi, pci);

    return {
      fetchedAt: new Date().toISOString(),
      indices: { gli, cri, msi, csi, fdr, dls, calci, pci },
      regime,
      positioningRows,
      bisOtc,
      repo: repoRates,
      bankLeverage,
      crypto,
      vix: { value: latestMap.get("vol.vix")?.v ?? null, asOf: latestMap.get("vol.vix")?.t ?? null },
      move: { value: latestMap.get("derivatives.move_index")?.v ?? null, asOf: latestMap.get("derivatives.move_index")?.t ?? null },
      historicalCrises: HISTORICAL_CRISES,
    };
  } catch (e) {
    console.error(`getDerivativesPageData: ${(e as Error).message}`);
    return null;
  }
}
