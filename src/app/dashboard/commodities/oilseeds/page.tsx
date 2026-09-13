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
} from "@/lib/api/engineData";
import type { CountryClass } from "@/lib/engines/oilseedsCountry";
import type { CommodityDirectionLabel } from "@/lib/engines/commodities";
import type { EnsoPhase } from "@/lib/engines/oilseedsEnso";

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

export default async function OilseedsPage() {
  const [heatmap, balances, countryBalances, crush, spreads, positioning, seAsia, tradeIntel, enso, priceCycles, seasonality] = await Promise.all([
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
  ]);

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

      {priceCycles && priceCycles.some((c) => c.currentPhase !== null) && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Price Cycle Engine</h2>
          <p className="mb-3 text-sm text-text-dim">
            Bull/bear cycles detected from World Bank Pink Sheet history (monthly since 1960) using the standard
            disclosed -20%/+20% peak-to-trough/trough-to-recovery convention — a mechanical drawdown detector, not
            a fundamentals-based cycle call.
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
        standard disclosed -20%/+20% drawdown/recovery threshold; and a production/export seasonality index for
        Malaysia (MPOB) exports and Indonesia (BPS) large-estate production, computed from the same already-ingested
        monthly series (explicitly labeled with how many full calendar years back each reading, since neither
        series yet has more than ~1-2 years of history).
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
        crops MPOB tracks separately), so it isn&apos;t used here; MPOB production, stocks, and FFB/CPO price data
        — MPOB has no documented API and its own report catalogue is access-restricted (HTTP 401), so only the one
        confirmed-working export report was built, and Malaysia&apos;s export history above genuinely starts in
        2024 (the report code scheme doesn&apos;t resolve to real data before that year); and Indonesia
        soybean/groundnut production — BPS&apos;s own dynamic series for these stopped updating in 2015 per its
        own published notes, with no replacement table found, so it isn&apos;t shown as a live figure.
        <br />
        <br />
        <strong className="text-text">Not built</strong>, and why: a rainfall-to-yield lag model for
        Malaysia/Indonesia specifically (the spec asks for lags tested from 1-18 months against station-level
        rainfall and regional yield data — no free, no-key, station-level source for either country was found, and
        fitting a lag without one would be fabrication, so only the basin-wide ONI signal above is shown, without a
        derived production-impact estimate); Bursa Malaysia&apos;s FCPO futures term structure, open interest, and
        options data (no public, no-key API — Bursa data is licensed); futures term structure/basis/carry beyond
        spot positioning more generally (needs a live futures curve feed this app doesn&apos;t have); tree-age and
        replanting-cohort modeling (MPOB/BPS don&apos;t publish age-cohort area breakdowns in a form this app can
        ingest); freight/BDI, port congestion, and biofuel-mandate/policy realization tracking (no free live source
        found); Monte Carlo simulation, Granger causality/VAR/regime-switching statistical testing, and a machine-learning
        layer (these need a proper backtesting and model-validation infrastructure this app doesn&apos;t have yet —
        building them without walk-forward validation would be exactly the unvalidated-model risk this project
        avoids); the full scenario/shock propagation engine, systemic risk score, early-warning indicator set, daily
        AI report generation, and price-alert/event-notification system (large net-new subsystems beyond this
        pass&apos;s scope). None of this is faked — sections without real data simply don&apos;t appear above.
      </section>
    </div>
  );
}
