import Link from "next/link";
import {
  getCommodityHeatmap,
  getCommodityBalances,
  getSoybeanCountryBalances,
  getSoybeanCrushMargin,
  getVegetableOilSpreads,
  getOilseedPositioning,
  getSeAsiaPalmBalances,
  getSoybeanTradeIntelligence,
  getEnsoState,
  getOilseedsPriceCycles,
  getOilseedsSeasonality,
  getOilseedsRainfall,
  getOilseedsPriceHeatmap,
  getOilseedsRainfallImpact,
} from "@/lib/api/engineData";
import type { CountryClass } from "@/lib/engines/oilseedsCountry";
import type { CommodityDirectionLabel } from "@/lib/engines/commodities";
import type { EnsoPhase } from "@/lib/engines/oilseedsEnso";
import type { HeatmapCell } from "@/lib/engines/oilseedsPriceHeatmap";

const OILSEED_SLUGS = new Set([
  "soybeans",
  "soybean_oil",
  "soybean_meal",
  "rapeseed_seed",
  "rapeseed_oil",
  "sunflowerseed",
  "sunflower_oil",
  "palm_oil",
  "palm_kernel_oil",
  "coconut_oil",
]);

const DIRECTION_COLORS: Record<CommodityDirectionLabel, string> = {
  "STRONG POSITIVE": "#34c085",
  POSITIVE: "#3fa9f5",
  FLAT: "#8b96a8",
  NEGATIVE: "#e0793d",
  "STRONG NEGATIVE": "#e05a4d",
  INSUFFICIENT_DATA: "#5a6472",
};

function DirectionPill({ direction }: { direction: CommodityDirectionLabel }) {
  const color = DIRECTION_COLORS[direction];
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${color}22`, color }}>
      {direction.replace(/_/g, " ")}
    </span>
  );
}

const CLASS_COLORS: Record<NonNullable<CountryClass>, string> = {
  "Major Exporter": "#34c085",
  "Net Exporter": "#3fa9f5",
  Balanced: "#8b96a8",
  "Net Importer": "#e0793d",
  "Major Importer": "#e05a4d",
};

function ClassPill({ classification }: { classification: NonNullable<CountryClass> }) {
  const color = CLASS_COLORS[classification];
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${color}22`, color }}>
      {classification}
    </span>
  );
}

const ENSO_COLORS: Record<EnsoPhase, string> = {
  "El Nino": "#e0793d",
  "La Nina": "#3fa9f5",
  Neutral: "#8b96a8",
};

function EnsoPill({ phase }: { phase: EnsoPhase }) {
  const color = ENSO_COLORS[phase];
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${color}22`, color }}>
      {phase}
    </span>
  );
}

const CROP_PHASE_COLORS: Record<string, string> = {
  "Peak Crop": "#34c085",
  "Rising Crop": "#3fa9f5",
  "Low Crop": "#e0793d",
  "Declining Crop": "#e0793d",
  "Seasonal Bottom": "#e05a4d",
};

function CropPhasePill({ phase }: { phase: string }) {
  const color = CROP_PHASE_COLORS[phase] ?? "#8b96a8";
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${color}22`, color }}>
      {phase}
    </span>
  );
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const REGIME_COLORS: Record<string, string> = {
  Deficit: "#e05a4d",
  Normal: "#34c085",
  Excess: "#3fa9f5",
};

function RegimePill({ regime }: { regime: string }) {
  const color = REGIME_COLORS[regime] ?? "#8b96a8";
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${color}22`, color }}>
      {regime}
    </span>
  );
}

function fmt(v: number | null, decimals = 1): string {
  if (v === null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function pctColor(v: number | null): string {
  if (v === null) return "#8b96a8";
  return v >= 0 ? "#34c085" : "#e05a4d";
}

function HeatmapCellView({ cell }: { cell: HeatmapCell }) {
  if (!cell.available) {
    return (
      <div className="rounded bg-panel-raised px-2 py-1.5 text-center" title={cell.unavailableReason}>
        <div className="gfew-mono text-sm font-semibold text-text-dim">N/A</div>
        <div className="text-[9px] uppercase tracking-wide text-text-dim">monthly only</div>
      </div>
    );
  }
  const color = DIRECTION_COLORS[cell.direction];
  return (
    <div className="rounded px-2 py-1.5 text-center" style={{ background: `${color}22` }}>
      <div className="gfew-mono text-sm font-semibold" style={{ color }}>
        {fmtPct(cell.changePct)}
      </div>
      <div className="text-[9px] uppercase tracking-wide" style={{ color }}>
        {cell.direction.replace(/_/g, " ")}
      </div>
    </div>
  );
}

function CycleGauge({ distanceFromPeakPct, phase }: { distanceFromPeakPct: number | null; phase: "Bull" | "Bear" | null }) {
  if (distanceFromPeakPct === null || phase === null) return null;
  const clamped = Math.max(-50, Math.min(0, distanceFromPeakPct));
  const positionPct = ((clamped + 50) / 50) * 100; // 0% = -50 (deep bear), 100% = 0 (at/above peak)
  const bearThresholdPct = ((-20 + 50) / 50) * 100; // where the -20% bear-confirmation line sits on this same 0-100 scale
  const color = phase === "Bull" ? "#34c085" : "#e05a4d";
  return (
    <div className="mt-2">
      <div className="relative h-2 rounded-full bg-panel-raised">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${positionPct}%`, background: `${color}55` }} />
        <div className="absolute inset-y-0 w-px bg-text-dim opacity-50" style={{ left: `${bearThresholdPct}%` }} />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-panel"
          style={{ left: `${positionPct}%`, background: color }}
        />
      </div>
      <div className="relative mt-1 h-3 text-[9px] uppercase tracking-wide text-text-dim">
        <span className="absolute left-0">-50%</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${bearThresholdPct}%` }}>
          -20% (bear line)
        </span>
        <span className="absolute right-0">Peak</span>
      </div>
    </div>
  );
}

export default async function OilseedsPage() {
  const [heatmap, balances, countryBalances, crush, spreads, positioning, seAsia, tradeIntel, enso, priceCycles, seasonality, rainfall, priceHeatmap, rainfallImpact] =
    await Promise.all([
      getCommodityHeatmap(),
      getCommodityBalances(),
      getSoybeanCountryBalances(),
      getSoybeanCrushMargin(),
      getVegetableOilSpreads(),
      getOilseedPositioning(),
      getSeAsiaPalmBalances(),
      getSoybeanTradeIntelligence(),
      getEnsoState(),
      getOilseedsPriceCycles(),
      getOilseedsSeasonality(),
      getOilseedsRainfall(),
      getOilseedsPriceHeatmap(),
      getOilseedsRainfallImpact(),
    ]);

  const regimeBySlug = new Map((rainfallImpact?.currentRegimeByRegion ?? []).map((r) => [r.slug, r.regime]));

  const priceRows = (heatmap?.rows ?? []).filter((r) => OILSEED_SLUGS.has(r.slug));
  const balanceRows = (balances?.rows ?? []).filter((r) => OILSEED_SLUGS.has(r.slug));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <Link href="/dashboard/commodities" className="text-xs text-accent hover:underline">
          ← Commodities
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Oilseeds</h1>
        <Link href="/dashboard/commodities/oilseeds/history" className="text-xs text-accent hover:underline">
          See full 10-year history →
        </Link>
      </div>
      <p className="mb-8 max-w-3xl text-sm text-text-dim">
        The oilseed complex modeled as seed → crush → oil + meal, not three unrelated prices. Built against the
        Oilseeds Engine spec, scoped to what live free data actually supports — see the disclosure at the bottom
        for what&apos;s real here and what genuinely isn&apos;t built (weather/ENSO, futures curves, freight,
        biofuel-policy modeling, scenario shocks, AI integration).
      </p>

      <section className="mb-10">
        <h2 className="mb-2 text-lg font-semibold">Complex Overview</h2>
        <p className="mb-3 text-sm text-text-dim">Price momentum and world supply-demand balance, filtered to the oilseed complex.</p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Commodity</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">12M</th>
                <th className="px-3 py-2 font-medium">Direction</th>
                <th className="px-3 py-2 font-medium">World Prod.</th>
                <th className="px-3 py-2 font-medium">World Consum.</th>
                <th className="px-3 py-2 font-medium">Stocks/Use</th>
              </tr>
            </thead>
            <tbody>
              {[...OILSEED_SLUGS].map((slug) => {
                const p = priceRows.find((r) => r.slug === slug);
                const b = balanceRows.find((r) => r.slug === slug);
                if (!p && !b) return null;
                return (
                  <tr key={slug} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">{p?.label ?? b?.label}</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{p ? `${fmt(p.price, p.price !== null && p.price >= 100 ? 1 : 2)} ${p.unit}` : "—"}</td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(p?.change12m ?? null) }}>
                      {p ? fmtPct(p.change12m) : "—"}
                    </td>
                    <td className="px-3 py-2">{p ? <DirectionPill direction={p.direction} /> : "—"}</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{b ? `${fmt(b.production)} ${b.unit}` : "—"}</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{b ? `${fmt(b.consumption)} ${b.unit}` : "—"}</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{b?.stocksToUsePct === null || b?.stocksToUsePct === undefined ? "—" : `${b.stocksToUsePct.toFixed(1)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {countryBalances && countryBalances.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Soybean Country Balance Sheet</h2>
          <p className="mb-3 text-sm text-text-dim">
            Real USDA PSD country-level data — the deepest single-commodity module per the spec (§10-15). Apparent
            Consumption, Stocks/Use and Classification (spec §9, §106, §141) are computed from this same data via
            the balance-sheet identity, not a new source.
          </p>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-raised text-text-dim">
                <tr>
                  <th className="px-3 py-2 font-medium">Country</th>
                  <th className="px-3 py-2 font-medium">Market Year</th>
                  <th className="px-3 py-2 font-medium">Production</th>
                  <th className="px-3 py-2 font-medium">YoY</th>
                  <th className="px-3 py-2 font-medium">Crush</th>
                  <th className="px-3 py-2 font-medium">Imports</th>
                  <th className="px-3 py-2 font-medium">Exports</th>
                  <th className="px-3 py-2 font-medium">Net Trade</th>
                  <th className="px-3 py-2 font-medium">Ending Stocks</th>
                  <th className="px-3 py-2 font-medium">Apparent Consum.</th>
                  <th className="px-3 py-2 font-medium">Stocks/Use</th>
                  <th className="px-3 py-2 font-medium">Classification</th>
                </tr>
              </thead>
              <tbody>
                {countryBalances.map((r) => (
                  <tr key={r.slug} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">{r.label}</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{r.marketYear ?? "—"}</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.production)} Mt</td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.productionYoy) }}>
                      {fmtPct(r.productionYoy)}
                    </td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.crush)} Mt</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.imports)} Mt</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.exports)} Mt</td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.netTrade) }}>
                      {r.netTrade === null ? "—" : `${r.netTrade >= 0 ? "+" : ""}${r.netTrade.toFixed(1)} Mt`}
                    </td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.endingStocks)} Mt</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{r.apparentConsumption === null ? "—" : `${fmt(r.apparentConsumption)} Mt`}</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{r.stocksToUsePct === null ? "—" : `${r.stocksToUsePct.toFixed(1)}%`}</td>
                    <td className="px-3 py-2">{r.classification ? <ClassPill classification={r.classification} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tradeIntel && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Soybean Trade Concentration &amp; China Import Demand</h2>
          <p className="mb-3 text-sm text-text-dim">
            Export HHI (spec §50) and China&apos;s import demand (spec §15) — both computed directly from the
            country balance data above, no new source.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="gfew-panel p-4">
              <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">Export HHI (tracked countries)</div>
              <div className="mb-3 flex items-baseline gap-3">
                <span className="gfew-mono text-2xl font-semibold">
                  {tradeIntel.concentration.exportHHI === null ? "—" : tradeIntel.concentration.exportHHI.toFixed(0)}
                </span>
                <span className="text-xs text-text-dim">0-10,000 · &gt;2,500 is considered highly concentrated</span>
              </div>
              <div className="space-y-1 text-xs text-text-dim">
                {tradeIntel.concentration.topExporters.map((e) => (
                  <div key={e.label} className="flex justify-between">
                    <span>{e.label}</span>
                    <span className="gfew-mono text-text">{e.shareOfTracked === null ? "—" : `${e.shareOfTracked.toFixed(1)}%`}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="gfew-panel p-4">
              <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">China Soybean Import Demand</div>
              <div className="mb-3 flex items-baseline gap-3">
                <span className="gfew-mono text-2xl font-semibold" style={{ color: pctColor(tradeIntel.chinaImportDemand.indexValue) }}>
                  {fmtPct(tradeIntel.chinaImportDemand.indexValue)}
                </span>
                <span className="text-xs text-text-dim">equal-weighted avg. of imports YoY + crush YoY</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-text-dim">
                <div>
                  <div className="uppercase tracking-wide">Imports YoY</div>
                  <div className="gfew-mono font-semibold" style={{ color: pctColor(tradeIntel.chinaImportDemand.importsYoy) }}>
                    {fmtPct(tradeIntel.chinaImportDemand.importsYoy)}
                  </div>
                </div>
                <div>
                  <div className="uppercase tracking-wide">Crush YoY</div>
                  <div className="gfew-mono font-semibold" style={{ color: pctColor(tradeIntel.chinaImportDemand.crushYoy) }}>
                    {fmtPct(tradeIntel.chinaImportDemand.crushYoy)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {crush && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Soybean Crush Margin</h2>
            <p className="mb-3 text-sm text-text-dim">
              (Oil Yield × Oil Price) + (Meal Yield × Meal Price) − Seed Price, per mt crushed. Standard
              industry-average yields ({(crush.oilYield * 100).toFixed(1)}% oil / {(crush.mealYield * 100).toFixed(1)}%
              meal) — not country- or plant-specific.
            </p>
            <div className="gfew-panel p-4">
              <div className="mb-3 flex items-baseline gap-3">
                <span className="gfew-mono text-2xl font-semibold" style={{ color: pctColor(crush.latestValue) }}>
                  {crush.latestValue === null ? "—" : `$${crush.latestValue.toFixed(0)}/mt`}
                </span>
                <span className="text-xs text-text-dim">as of {crush.latestDate ?? "—"}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs text-text-dim">
                <div>
                  <div className="uppercase tracking-wide">12M Change</div>
                  <div className="gfew-mono font-semibold" style={{ color: pctColor(crush.change12m) }}>
                    {fmtPct(crush.change12m)}
                  </div>
                </div>
                <div>
                  <div className="uppercase tracking-wide">5Y Z-Score</div>
                  <div className="gfew-mono font-semibold text-text">{crush.zScore5y === null ? "—" : crush.zScore5y.toFixed(2)}</div>
                </div>
                <div>
                  <div className="uppercase tracking-wide">Seed / Oil / Meal</div>
                  <div className="gfew-mono font-semibold text-text">
                    {fmt(crush.seedPrice, 0)} / {fmt(crush.oilPrice, 0)} / {fmt(crush.mealPrice, 0)}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {positioning && positioning.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">CFTC Positioning</h2>
            <p className="mb-3 text-sm text-text-dim">Non-commercial (speculative) net positioning, weekly.</p>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel-raised text-text-dim">
                  <tr>
                    <th className="px-3 py-2 font-medium">Market</th>
                    <th className="px-3 py-2 font-medium">Net Non-Comm.</th>
                    <th className="px-3 py-2 font-medium">% of OI</th>
                  </tr>
                </thead>
                <tbody>
                  {positioning.map((r) => (
                    <tr key={r.label} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-medium">
                        {r.label}
                        <div className="text-[10px] text-text-dim">{r.asOf ?? ""}</div>
                      </td>
                      <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.netNonCommercial) }}>
                        {r.netNonCommercial === null ? "—" : r.netNonCommercial.toLocaleString()}
                      </td>
                      <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.netPctOpenInterest) }}>
                        {r.netPctOpenInterest === null ? "—" : `${r.netPctOpenInterest.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {spreads && spreads.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Vegetable Oil Relative Value Matrix</h2>
          <p className="mb-3 text-sm text-text-dim">Each spread z-scored against its own trailing 5-year history.</p>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-raised text-text-dim">
                <tr>
                  <th className="px-3 py-2 font-medium">Pair</th>
                  <th className="px-3 py-2 font-medium">Spread ($/mt)</th>
                  <th className="px-3 py-2 font-medium">5Y Z-Score</th>
                  <th className="px-3 py-2 font-medium">As of</th>
                </tr>
              </thead>
              <tbody>
                {spreads.map((s) => (
                  <tr key={s.label} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">{s.label}</td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(s.spread) }}>
                      {s.spread === null ? "—" : `${s.spread >= 0 ? "+" : ""}${s.spread.toFixed(0)}`}
                    </td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{s.zScore5y === null ? "—" : s.zScore5y.toFixed(2)}</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{s.asOf ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {seAsia && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Malaysia &amp; Indonesia — Palm Oil Complex</h2>
          <p className="mb-3 text-sm text-text-dim">
            Indonesia via BPS (Statistics Indonesia), Malaysia via MPOB (Malaysian Palm Oil Board) — the two
            countries that together produce roughly 85% of the world&apos;s palm oil.
          </p>

          {seAsia.cmeFuturesPrice.latestValue !== null && (
            <div className="gfew-panel mb-6 p-4">
              <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">
                Live Price — CME Crude Palm Oil Calendar Swap Futures (CPO=F)
              </div>
              <div className="flex items-baseline gap-3">
                <span className="gfew-mono text-2xl font-semibold">${fmt(seAsia.cmeFuturesPrice.latestValue, 2)}/mt</span>
                <span className="text-xs text-text-dim">as of {seAsia.cmeFuturesPrice.latestDate?.slice(0, 10) ?? "—"}</span>
                <span className="gfew-mono text-sm font-semibold" style={{ color: pctColor(seAsia.cmeFuturesPrice.change12m) }}>
                  {fmtPct(seAsia.cmeFuturesPrice.change12m)} (12M)
                </span>
              </div>
              <p className="mt-2 text-xs text-text-dim">
                Cash-settled against MPOB&apos;s own daily posted Malaysian palm oil settlement price — the live
                proxy used here instead of scraping TradingView, which has no public data API.
              </p>
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[seAsia.indonesiaOilPalm, seAsia.indonesiaCoconut].map((row) => (
              <div key={row.label} className="gfew-panel p-4">
                <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">Indonesia — {row.label}</div>
                <div className="mb-2 flex items-baseline gap-3">
                  <span className="gfew-mono text-xl font-semibold">{fmt(row.latestAnnual)} Mt</span>
                  <span className="text-xs text-text-dim">{row.latestAnnualYear ?? "—"} (annual, all ownership)</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-text-dim">
                  <div>
                    <div className="uppercase tracking-wide">YoY</div>
                    <div className="gfew-mono font-semibold" style={{ color: pctColor(row.annualYoy) }}>
                      {fmtPct(row.annualYoy)}
                    </div>
                  </div>
                  {row.latestMonthlyLargeEstate !== null && (
                    <div>
                      <div className="uppercase tracking-wide">Latest Month (large estates only)</div>
                      <div className="gfew-mono font-semibold text-text">
                        {fmt(row.latestMonthlyLargeEstate)} Mt <span className="text-text-dim">({row.latestMonthlyLargeEstateDate?.slice(0, 7)})</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {(seAsia.malaysiaStocks.length > 0 || seAsia.longRunProduction.length > 0) && (
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {seAsia.malaysiaStocks.map((row) => (
                <div key={row.label} className="gfew-panel p-4">
                  <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">Malaysia — {row.label} (MPOB, mirrored)</div>
                  <div className="mb-2 flex items-baseline gap-3">
                    <span className="gfew-mono text-xl font-semibold">{fmt(row.latestValue, 3)} Mt</span>
                    <span className="text-xs text-text-dim">{row.latestDate?.slice(0, 7) ?? "—"}</span>
                  </div>
                  <div className="text-xs text-text-dim">
                    <span className="uppercase tracking-wide">YoY </span>
                    <span className="gfew-mono font-semibold" style={{ color: pctColor(row.yoy) }}>{fmtPct(row.yoy)}</span>
                  </div>
                </div>
              ))}
              {seAsia.longRunProduction.map((row) => (
                <div key={row.label} className="gfew-panel p-4">
                  <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">{row.label} — Long-Run Production (FAOSTAT)</div>
                  <div className="mb-2 flex items-baseline gap-3">
                    <span className="gfew-mono text-xl font-semibold">{fmt(row.latestValue)} Mt</span>
                    <span className="text-xs text-text-dim">{row.latestYear ?? "—"}</span>
                  </div>
                  <div className="text-xs text-text-dim">{row.yearsOfHistory} years of annual history</div>
                </div>
              ))}
            </div>
          )}

          {seAsia.malaysiaExports.length > 0 && (
            <>
              <p className="mb-3 text-sm text-text-dim">Malaysia — monthly exports of oil palm products (MPOB), by product.</p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel-raised text-text-dim">
                    <tr>
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Latest Month</th>
                      <th className="px-3 py-2 font-medium">Exports (Mt)</th>
                      <th className="px-3 py-2 font-medium">YoY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seAsia.malaysiaExports.map((r) => (
                      <tr key={r.slug} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-medium">{r.label}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{r.latestDate?.slice(0, 7) ?? "—"}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.latestValue, 3)}</td>
                        <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.yoy) }}>
                          {fmtPct(r.yoy)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {enso && enso.phase && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">ENSO Status (El Niño / La Niña)</h2>
          <p className="mb-3 text-sm text-text-dim">
            NOAA&apos;s Oceanic Niño Index — the official basin-wide basis for El Niño/La Niña declarations.
            Malaysia/Indonesia-specific rainfall, soil moisture, and yield-lag modeling are not built (see
            disclosure below); this is the raw basin-wide signal those models would eventually sit on top of.
          </p>
          <div className="gfew-panel p-4">
            <div className="mb-2 flex flex-wrap items-baseline gap-3">
              <span className="gfew-mono text-2xl font-semibold">{enso.latestOni! >= 0 ? "+" : ""}{enso.latestOni!.toFixed(2)}°C</span>
              <EnsoPill phase={enso.phase} />
              <span className="text-xs text-text-dim">as of {enso.asOf?.slice(0, 7) ?? "—"}</span>
            </div>
            <p className="text-xs text-text-dim">
              {enso.phase === "Neutral"
                ? "Within the +/-0.5°C neutral band — no active episode."
                : `${enso.consecutiveSeasons} consecutive overlapping 3-month season(s) at or beyond the +/-0.5°C threshold — ${
                    enso.established ? "an established episode (NOAA's own 5-season convention)." : "still a developing signal, not yet NOAA's own 5-season threshold for a declared episode."
                  }`}
            </p>
          </div>
        </section>
      )}

      {rainfall && rainfall.some((r) => r.latestValue !== null) && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Regional Rainfall (NASA POWER)</h2>
          <p className="mb-3 text-sm text-text-dim">
            Monthly precipitation (MERRA-2 reanalysis) for one representative point per major oil-palm-growing
            region. Anomaly = latest month vs. that same calendar month&apos;s own historical average. This is a
            raw rainfall signal, not a fitted rainfall-to-yield lag model — see disclosure below.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {rainfall
              .filter((r) => r.latestValue !== null)
              .map((r) => (
                <div key={r.slug} className="gfew-panel p-3">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-text-dim">
                    {r.country} — {r.label}
                  </div>
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="gfew-mono text-lg font-semibold">{fmt(r.latestValue, 1)} mm/day</span>
                    <span className="text-[10px] text-text-dim">{r.asOf?.slice(0, 7) ?? "—"}</span>
                  </div>
                  <div className="mb-1 gfew-mono text-xs font-semibold" style={{ color: pctColor(r.anomalyPct) }}>
                    {fmtPct(r.anomalyPct)} vs. {r.yearsOfHistory}y avg for this month
                  </div>
                  {regimeBySlug.get(r.slug) && <RegimePill regime={regimeBySlug.get(r.slug)!} />}
                </div>
              ))}
          </div>
        </section>
      )}

      {rainfallImpact && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Rainfall Impact: Production &amp; Price Linkage</h2>
          <p className="mb-3 text-sm text-text-dim">
            Regimes are classified by a disclosed ±{rainfallImpact.regimeThresholdPct}% anomaly threshold (Deficit /
            Normal / Excess) vs. each region&apos;s own history for that calendar month. Every probability below is
            a plain empirical frequency from paired historical observations — not a fitted model — with a Wilson
            95% confidence interval, since the underlying samples are modest. Production is linked at a{" "}
            {rainfallImpact.productionLagMonths}-month lag (a commonly cited oil palm FFB gestation lag in agronomic
            literature, not fitted to this data); price is linked at a much shorter {rainfallImpact.priceReactionMonths}-month
            forward window, since markets react to rainfall news well before the resulting harvest actually prints.
          </p>

          <h3 className="mb-2 text-sm font-semibold text-text-dim">
            Indonesia Production Outcome Probability ({rainfallImpact.productionLagMonths} months after rainfall, large-estate BPS series)
          </h3>
          <div className="mb-6 overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-raised text-text-dim">
                <tr>
                  <th className="px-3 py-2 font-medium">Rainfall Regime (at time of rain)</th>
                  <th className="px-3 py-2 font-medium">Sample</th>
                  <th className="px-3 py-2 font-medium">P(Increase vs. seasonal norm)</th>
                  <th className="px-3 py-2 font-medium">P(At-Par)</th>
                  <th className="px-3 py-2 font-medium">P(Decrease)</th>
                </tr>
              </thead>
              <tbody>
                {rainfallImpact.productionLinkage.map((row) => (
                  <tr key={row.regime} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <RegimePill regime={row.regime} />
                    </td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">n={row.sampleSize}</td>
                    {row.outcomes.length === 0 ? (
                      <td className="px-3 py-2 text-xs text-text-dim" colSpan={3}>
                        Insufficient historical sample (need 3+) to estimate a probability.
                      </td>
                    ) : (
                      ["Increase", "At-Par", "Decrease"].map((outcomeName) => {
                        const o = row.outcomes.find((x) => x.outcome === outcomeName)!;
                        return (
                          <td key={outcomeName} className="gfew-mono px-3 py-2 text-text-dim">
                            {(o.probability * 100).toFixed(0)}%{" "}
                            <span className="text-[10px]">
                              ({(o.ciLow * 100).toFixed(0)}-{(o.ciHigh * 100).toFixed(0)}%)
                            </span>
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mb-2 text-sm font-semibold text-text-dim">
            Palm Oil Price Reaction ({rainfallImpact.priceReactionMonths}-month forward return, palm-belt composite of all 6 regions)
          </h3>
          <div className="mb-3 overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-raised text-text-dim">
                <tr>
                  <th className="px-3 py-2 font-medium">Rainfall Regime</th>
                  <th className="px-3 py-2 font-medium">Sample</th>
                  <th className="px-3 py-2 font-medium">Avg Forward Return</th>
                  <th className="px-3 py-2 font-medium">Median Forward Return</th>
                </tr>
              </thead>
              <tbody>
                {rainfallImpact.priceReaction.map((row) => (
                  <tr key={row.regime} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <RegimePill regime={row.regime} />
                    </td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">n={row.sampleSize}</td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(row.avgForwardReturnPct) }}>
                      {fmtPct(row.avgForwardReturnPct)}
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(row.medianForwardReturnPct) }}>
                      {fmtPct(row.medianForwardReturnPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rainfallImpact.priceSensitivity && (
            <div className="gfew-panel mb-6 p-4">
              <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">Price Sensitivity to Rainfall Anomaly</div>
              <div className="mb-2 flex items-baseline gap-3">
                <span className="gfew-mono text-xl font-semibold" style={{ color: pctColor(rainfallImpact.priceSensitivity.slopePctPer10ptAnomaly) }}>
                  {fmtPct(rainfallImpact.priceSensitivity.slopePctPer10ptAnomaly)}
                </span>
                <span className="text-xs text-text-dim">
                  per +10 percentage points of composite rainfall anomaly, over the following {rainfallImpact.priceReactionMonths} months
                </span>
              </div>
              <div className="text-xs text-text-dim">
                R² = {rainfallImpact.priceSensitivity.rSquared?.toFixed(3)} on n={rainfallImpact.priceSensitivity.sampleSize} months.{" "}
                {rainfallImpact.priceSensitivity.rSquared !== null && rainfallImpact.priceSensitivity.rSquared < 0.1 ? (
                  <strong className="text-text">
                    This R² is low — rainfall alone explains very little of palm oil&apos;s short-term price moves (biodiesel mandates,
                    substitute-oil prices, FX, and Indonesian export policy all move it too), so treat the slope above as a weak, noisy
                    association, not a reliable trading signal on its own.
                  </strong>
                ) : (
                  "A moderate-to-strong R² here would mean rainfall alone explains a meaningful share of near-term price moves."
                )}
              </div>
            </div>
          )}

          <h3 className="mb-2 text-sm font-semibold text-text-dim">Forward-Looking Rainfall Outlook (from NOAA CPC&apos;s ENSO Forecast)</h3>
          <p className="mb-3 text-sm text-text-dim">
            NOAA CPC publishes an official ENSO probability forecast monthly (La Niña / Neutral / El Niño chances for 9 upcoming
            overlapping seasons). Combined with this app&apos;s own historical ENSO-phase-vs-rainfall-regime relationship per
            region, that forecast is mixed into a probabilistic near-term rainfall regime outlook below — recomputed every time
            the pipeline re-ingests a fresh CPC forecast, not a static snapshot.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rainfallImpact.forecastByRegion.map((r) => (
              <div key={r.slug} className="gfew-panel p-4">
                <div className="mb-2 text-xs uppercase tracking-wide text-text-dim">
                  {r.country} — {r.label}
                </div>
                {r.months === null ? (
                  <div className="text-xs text-text-dim">
                    Insufficient historical ENSO-phase overlap to project an outlook (El Niño n={r.phaseSampleSizes["El Nino"]}, La
                    Niña n={r.phaseSampleSizes["La Nina"]}, Neutral n={r.phaseSampleSizes.Neutral} — need 10+ each).
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-text-dim">
                        <tr>
                          <th className="py-1 pr-2 font-medium">Month</th>
                          <th className="py-1 pr-2 font-medium">Deficit</th>
                          <th className="py-1 pr-2 font-medium">Normal</th>
                          <th className="py-1 pr-2 font-medium">Excess</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.months.slice(0, 4).map((m) => (
                          <tr key={m.targetMonth} className="border-t border-border">
                            <td className="gfew-mono py-1 pr-2 text-text-dim">{m.targetMonth}</td>
                            <td className="gfew-mono py-1 pr-2" style={{ color: REGIME_COLORS.Deficit }}>
                              {(m.deficitProb * 100).toFixed(0)}%
                            </td>
                            <td className="gfew-mono py-1 pr-2" style={{ color: REGIME_COLORS.Normal }}>
                              {(m.normalProb * 100).toFixed(0)}%
                            </td>
                            <td className="gfew-mono py-1 pr-2" style={{ color: REGIME_COLORS.Excess }}>
                              {(m.excessProb * 100).toFixed(0)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {priceHeatmap && priceHeatmap.rows.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Multi-Timeframe Price Heatmap</h2>
          <p className="mb-3 text-sm text-text-dim">
            Each cell is its own horizon-weighted, z-scored momentum read — the same methodology as the
            Commodities page&apos;s own momentum score (spec §32), but split into three independent timeframe
            buckets instead of one blended number, so Short/Medium/Long are three different calculations, not the
            same figure shown three times. <strong className="text-text">Short-Term (0-30D)</strong> is shown for
            Palm Oil (CME&apos;s daily CPO=F futures) and, as of this pass, Soybeans/Soybean Oil/Soybean Meal —
            the crush complex&apos;s own three legs — from real CBOT daily futures settlement prices via Massive (a
            paid, delayed-not-real-time market-data API). The remaining 4 products (Coconut Oil, Palm Kernel Oil,
            Rapeseed Oil, Sunflower Oil) have only monthly World Bank Pink Sheet data, where a 0-30 day window
            can&apos;t reflect a genuine sample, so those cells read N/A rather than approximating from a single
            monthly print.{" "}
            <strong className="text-text">Medium-Term (30-90D)</strong> and{" "}
            <strong className="text-text">Long-Term (&gt;90D)</strong> use that same monthly series for all 8
            products, since 90+ days comfortably spans multiple real monthly observations.
          </p>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-raised text-text-dim">
                <tr>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Short-Term (0-30D)</th>
                  <th className="px-3 py-2 font-medium">Medium-Term (30-90D)</th>
                  <th className="px-3 py-2 font-medium">Long-Term (&gt;90D)</th>
                </tr>
              </thead>
              <tbody>
                {priceHeatmap.rows.map((r) => (
                  <tr key={r.slug} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">{r.label}</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      {r.price === null ? "—" : `${fmt(r.price, r.price >= 100 ? 1 : 2)} ${r.unit}`}
                      <div className="text-[10px] text-text-dim">{r.asOf?.slice(0, 7) ?? ""}</div>
                    </td>
                    <td className="px-3 py-2">
                      <HeatmapCellView cell={r.short} />
                    </td>
                    <td className="px-3 py-2">
                      <HeatmapCellView cell={r.medium} />
                    </td>
                    <td className="px-3 py-2">
                      <HeatmapCellView cell={r.long} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {priceCycles && priceCycles.some((c) => c.currentPhase !== null) && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Price Cycle Engine — Long-Term Cycle Position</h2>
          <p className="mb-3 text-sm text-text-dim">
            Bull/bear cycles detected from World Bank Pink Sheet history (monthly since 1960) using the standard
            disclosed -20%/+20% peak-to-trough/trough-to-recovery convention — a mechanical drawdown detector, not
            a fundamentals-based cycle call. The gauge shows where the current price sits between a deep (-50%)
            drawdown and the running peak; the marker crossing the -20% line is what flips the phase from Bull to
            Bear. The transition probability below each gauge is a plain empirical frequency, not a fitted model:
            of every historical bear cycle (or bull leg) for that product that already lasted at least as long as
            the current one has so far, what fraction ended within the next 6/12 months — with a Wilson 95%
            confidence interval on that fraction, since these sample sizes are small (often single digits across
            66 years) and a bare percentage would look far more precise than it is. Below 3 comparable historical
            phases, no probability is shown at all.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {priceCycles
              .filter((c) => c.currentPhase !== null)
              .map((c) => (
                <div key={c.slug} className="gfew-panel p-4">
                  <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">{c.label}</div>
                  <div className="mb-2 flex items-baseline gap-3">
                    <span
                      className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ background: c.currentPhase === "Bull" ? "#34c08522" : "#e05a4d22", color: c.currentPhase === "Bull" ? "#34c085" : "#e05a4d" }}
                    >
                      {c.currentPhase}
                    </span>
                    <span className="text-xs text-text-dim">as of {c.asOf?.slice(0, 7) ?? "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-text-dim">
                    <div>
                      <div className="uppercase tracking-wide">Running Peak</div>
                      <div className="gfew-mono font-semibold text-text">
                        {fmt(c.runningPeakValue, 0)} {c.unit} <span className="text-text-dim">({c.runningPeakDate?.slice(0, 7)})</span>
                      </div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide">Off Peak / Months Since</div>
                      <div className="gfew-mono font-semibold" style={{ color: pctColor(c.distanceFromPeakPct) }}>
                        {fmtPct(c.distanceFromPeakPct)} / {c.monthsSincePeak}mo
                      </div>
                    </div>
                  </div>
                  <CycleGauge distanceFromPeakPct={c.distanceFromPeakPct} phase={c.currentPhase} />
                  {c.transitionProbabilities ? (
                    <div className="mt-3 border-t border-border pt-3">
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-text-dim">
                        Probability of {c.currentPhase === "Bear" ? "Next Bull Cycle Starting" : "Next Bear Cycle Starting"}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {c.transitionProbabilities.map((p) => (
                          <div key={p.horizonMonths}>
                            <div className="uppercase tracking-wide text-text-dim">Within {p.horizonMonths} months</div>
                            <div className="gfew-mono font-semibold text-text">
                              {(p.probability * 100).toFixed(0)}%{" "}
                              <span className="text-text-dim">
                                ({(p.ciLow * 100).toFixed(0)}-{(p.ciHigh * 100).toFixed(0)}% CI)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1 text-[10px] text-text-dim">
                        Empirical: {c.transitionProbabilities[0].sampleSize} historical {c.currentPhase === "Bear" ? "bear cycles" : "bull legs"} that
                        already lasted at least {c.currentPhaseAgeMonths} months (the current phase&apos;s own age) — a plain historical frequency with
                        a Wilson 95% confidence interval, not a fitted model.
                      </div>
                    </div>
                  ) : (
                    c.currentPhaseAgeMonths !== null && (
                      <div className="mt-3 border-t border-border pt-3 text-[10px] text-text-dim">
                        Not enough historical {c.currentPhase === "Bear" ? "bear cycles" : "bull legs"} lasting at least{" "}
                        {c.currentPhaseAgeMonths} months (need {3}+, this product has fewer) to estimate a transition probability without it
                        being spurious.
                      </div>
                    )
                  )}
                  {c.historicalCycleCount > 0 && (
                    <div className="mt-3 border-t border-border pt-3 text-[10px] text-text-dim">
                      {c.historicalCycleCount} completed bear cycle{c.historicalCycleCount === 1 ? "" : "s"} since 1960 — avg drawdown{" "}
                      {c.avgDrawdownPct?.toFixed(0)}% over avg {c.avgDurationMonths?.toFixed(0)} months.
                      {c.currentPhase === "Bear" && c.avgDurationMonths !== null && c.monthsSincePeak !== null && (
                        <>
                          {" "}
                          This drawdown is {c.monthsSincePeak} months old —{" "}
                          {c.monthsSincePeak > c.avgDurationMonths ? "already longer than" : "still within"} the historical average.
                        </>
                      )}
                    </div>
                  )}
                  {c.cycles.length > 0 && (
                    <div className="mt-3 border-t border-border pt-3">
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-text-dim">Most Recent Completed Bear Cycle</div>
                      <div className="text-xs text-text-dim">
                        {c.cycles[0].peakDate.slice(0, 7)} peak ({fmt(c.cycles[0].peakValue, 0)}) → {c.cycles[0].troughDate.slice(0, 7)} trough (
                        {fmt(c.cycles[0].troughValue, 0)}), {c.cycles[0].drawdownPct.toFixed(0)}% over {c.cycles[0].durationMonths}mo
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}

      {seasonality && seasonality.some((s) => s.phase !== null) && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Production &amp; Export Seasonality</h2>
          <p className="mb-3 text-sm text-text-dim">
            Monthly index = that month&apos;s value ÷ that year&apos;s own average monthly value, averaged across
            all full calendar years available. History is short (well under the 20 years this would ideally use —
            see the years-of-history figure on each card), so treat these as early, thin readings, not a mature
            seasonal curve.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {seasonality
              .filter((s) => s.phase !== null)
              .map((s) => (
                <div key={s.slug} className="gfew-panel p-4">
                  <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">{s.label}</div>
                  <div className="mb-2 flex flex-wrap items-baseline gap-3">
                    <span className="gfew-mono text-xl font-semibold">
                      {s.currentMonth ? MONTH_NAMES[s.currentMonth - 1] : "—"} index {fmt(s.currentMonthIndex, 2)}
                    </span>
                    {s.phase && <CropPhasePill phase={s.phase} />}
                  </div>
                  <div className="text-xs text-text-dim">
                    Based on {s.yearsOfHistory} full calendar year{s.yearsOfHistory === 1 ? "" : "s"} (as of {s.asOf?.slice(0, 7) ?? "—"}).
                    An index of 1.00 = that month is exactly average for the year.
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      <section className="gfew-panel p-4 text-xs text-text-dim">
        <strong className="text-text">What&apos;s real here</strong>: World Bank Pink Sheet prices for
        Soybeans/Soybean Oil/Soybean Meal/Rapeseed Oil/Sunflower Oil/Palm Oil/Palm Kernel Oil/Coconut Oil (monthly
        since 1960); USDA PSD world AND country-level (Brazil, US, Argentina, China, India, Paraguay, Canada,
        Russia, Ukraine, EU) production/crush/imports/exports/ending-stocks for Soybeans, plus world balances for
        Rapeseed and Sunflower seed; a genuine soybean crush margin computed from the three Pink Sheet legs using
        disclosed (not hidden) standard industry extraction ratios; live CFTC non-commercial futures positioning
        for Soybeans, Soybean Oil, Soybean Meal, and Canola; a vegetable-oil relative-value matrix computed
        directly from existing prices; Indonesia&apos;s national annual oil palm (CPO) and coconut production, all
        ownership combined, via BPS&apos;s Web API (registered key), plus a large-estates-only monthly palm
        indicator (the only higher-than-annual frequency BPS publishes); Malaysia&apos;s monthly oil-palm
        product export volumes (CPO, PKO, biodiesel, oleochemicals, etc.) via MPOB; and a genuinely live daily
        palm oil price via CME&apos;s Crude Palm Oil Calendar Swap futures (CPO=F on Yahoo Finance) — cash-settled
        against MPOB&apos;s own posted Malaysian benchmark, added instead of scraping TradingView (which has no
        public data API — its charts stream over a private, authenticated feed, not a documented endpoint);
        apparent consumption, stocks/use, and exporter/importer classification per country, plus soybean export
        concentration (HHI) and a China import-demand indicator — all computed directly from the USDA PSD data
        above via the balance-sheet identity and standard HHI formula, no new source; NOAA&apos;s own Oceanic Niño
        Index (ONI) for basin-wide El Niño/La Niña state, classified using NOAA&apos;s own 5-consecutive-season
        convention; a price-cycle engine detecting bull/bear regimes in Palm Oil and Soybean Oil since 1960 via the
        standard disclosed -20%/+20% drawdown/recovery threshold, now extended from 2 to all 8 Oilseeds-category
        products (Soybeans, Soybean Oil, Soybean Meal, Rapeseed Oil, Sunflower Oil, Palm Oil, Palm Kernel Oil,
        Coconut Oil — all share the same 1960-present Pink Sheet history) and enriched with each product&apos;s own
        historical cycle count and average drawdown/duration, shown as a position gauge rather than just a text
        label, so the current cycle&apos;s age can be compared against that product&apos;s own history instead of
        an arbitrary benchmark; a Multi-Timeframe Price Heatmap splitting momentum into three independently
        z-scored buckets (Short 0-30D, Medium 30-90D, Long &gt;90D) instead of one blended score — Short-Term is
        shown only for Palm Oil (the only Oilseeds product with a real daily price, via CME&apos;s CPO=F futures);
        the other seven read N/A there rather than approximating a 0-30 day signal from monthly data that can&apos;t
        support one; a production/export seasonality index for
        Malaysia (MPOB, via the mirror below) exports and Indonesia (BPS) large-estate production, computed from
        already-ingested monthly series (explicitly labeled with how many full calendar years back each reading —
        Indonesia&apos;s BPS large-estate series now runs 2009-present, ~18 years; Malaysia&apos;s seasonality
        specifically draws on the MPOB mirror&apos;s export field rather than MPOB&apos;s own site, since that
        mirror has 6 fully complete calendar years — 2013/2014/2017/2021/2024/2025 — versus 2 years from MPOB&apos;s
        own site restructuring noted below); NASA POWER
        regional rainfall (point-based MERRA-2 reanalysis, no key, no GIS processing needed) for six
        Malaysia/Indonesia plantation regions, shown as a raw monthly anomaly vs. each region&apos;s own historical
        average for that calendar month; FAOSTAT&apos;s own bulk production data (free, no key) for Malaysia and
        Indonesia palm oil specifically, back to 1961 — long-run annual context that BPS/MPOB alone don&apos;t
        cover this far back, cross-checked live against MPOB&apos;s own 2023 total (18.55M MT both ways); and
        Malaysia&apos;s monthly CPO and total palm oil stock levels back to 2000, via a free public CSV that
        mirrors MPOB&apos;s own monthly release (palmoileconomics.com) — live cross-checked against an independent
        news write-up of the same MPOB release and matched to the tonne, kept as its own tier-3 source since it
        isn&apos;t MPOB&apos;s own site (only the two stock indicators from that mirror are used: every other field
        in the same file — production, exports, imports, FFB price — has whole years missing); and a Rainfall
        Impact engine linking NASA POWER rainfall regimes (Deficit/Normal/Excess, a disclosed ±15% anomaly
        threshold) to Indonesia&apos;s production outcomes 18 months later and palm oil&apos;s price reaction 3
        months later, both as plain empirical frequencies with Wilson confidence intervals from paired historical
        observations — plus a genuine forward-looking layer using NOAA CPC&apos;s own official monthly ENSO
        probability forecast (verified live: a real, free, server-rendered HTML table, not a JS-only chart),
        mixed with this app&apos;s own historical ENSO-phase-vs-rainfall-regime relationship per region to project
        a near-term rainfall outlook that updates automatically every time the pipeline re-ingests a fresh CPC
        forecast.
        <br />
        <br />
        <strong className="text-text">Checked and confirmed genuinely unavailable</strong>: a CFTC-reportable
        Sunflower futures contract (traded on Euronext/MATIF, not a US exchange); an EIA-style world &ldquo;WORL&rdquo;
        aggregate for oilseeds (that convenience is EIA-specific — USDA PSD requires the EU bloc/member
        resolution logic documented on the parent Commodities page instead); raw seed and meal price series for
        Rapeseed and Sunflower (only their oils are priced in the Pink Sheet/IMF PCPS), so no crush margin is
        computed for those two — shown as unavailable, not approximated; Malaysia&apos;s official crop-statistics
        API (OpenDOSM/data.gov.my) — real and live, but checked live to contain zero oil palm/soybean/groundnut
        rows (it only covers smallholder cash/fruit/vegetable/spice crops, not the plantation-scale industrial
        crops MPOB tracks separately), so it isn&apos;t used here; MPOB production and FFB/CPO price data directly
        from MPOB&apos;s own site — MPOB has no documented API and its own report catalogue is access-restricted
        (HTTP 401), so only the one confirmed-working export report was built there, and Malaysia&apos;s export
        history above genuinely starts in 2024 (the report code scheme doesn&apos;t resolve to real data before
        that year); CPO/total stock levels are shown above via the third-party mirror instead, but production,
        exports, imports, and FFB price from that same mirror are NOT shown because that file has whole years
        missing for those specific fields (checked per-indicator, not assumed complete just because the file
        exists); and Indonesia
        soybean/groundnut production — BPS&apos;s own dynamic series for these stopped updating in 2015 per its
        own published notes, with no replacement table found, so it isn&apos;t shown as a live figure.
        <br />
        <br />
        <strong className="text-text">Not built</strong>, and why: a rainfall-to-yield lag model for
        Malaysia/Indonesia specifically (the spec asks for lags tested from 1-18 months against regional yield
        data — Indonesia&apos;s BPS large-estate series is now long enough, ~18 years, to plausibly support this,
        but Malaysia&apos;s own MPOB export history is still genuinely short at ~3 years, and a credible
        distributed-lag regression needs proper walk-forward validation infrastructure this pass doesn&apos;t
        include — building it without that rigor would risk an unvalidated model dressed up as a real signal, so
        only the raw rainfall anomaly and basin-wide ONI signals above are shown, without a derived
        production-impact estimate);
        Bursa Malaysia&apos;s FCPO futures term structure and options data — a real, public, no-login JSON endpoint
        was actually found (the same one Bursa&apos;s own price page calls), and it returns full 24-contract-month
        settlement/volume/open-interest data when tested with <code className="gfew-mono">curl</code>, but it sits
        behind Cloudflare bot protection that specifically blocks Node&apos;s own fetch client (confirmed live —
        curl gets HTTP 200, Node&apos;s <code className="gfew-mono">fetch</code>, with an identical User-Agent and a
        full browser header set, gets HTTP 403 and a JS challenge page) — since this app&apos;s ingestion pipeline
        runs as a Node serverless function, that block is unconditional in production, not a fixable header
        omission; tree-age and replanting-cohort modeling (this would need a genuine satellite remote-sensing
        analysis pipeline — concession-boundary overlay and cloud-based raster processing — a separate specialized
        project, not an ingestion task); freight/BDI, port congestion via AIS, and biofuel-mandate/policy
        realization tracking (checked live — FRED carries no Baltic Dry Index series at all, and AIS-based port
        congestion needs vessel-position-stream processing infrastructure this app doesn&apos;t have); Monte Carlo
        simulation, Granger causality/VAR/regime-switching statistical testing, and a machine-learning layer (these
        would mean standing up a separate Python analytics service alongside this app&apos;s TypeScript/Supabase
        stack, and even done right, that kind of model is prone to overfitting on series this short — building it
        without proper walk-forward validation would be exactly the unvalidated-model risk this project avoids);
        the full scenario/shock propagation engine, systemic risk score, early-warning indicator set, daily AI
        report generation, and price-alert/event-notification system (large net-new subsystems beyond this
        pass&apos;s scope). None of this is faked — sections without real data simply don&apos;t appear above.
      </section>
    </div>
  );
}
