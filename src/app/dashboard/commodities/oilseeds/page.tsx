import Link from "next/link";
import {
  getCommodityHeatmap,
  getCommodityBalances,
  getSoybeanCountryBalances,
  getSoybeanCrushMargin,
  getVegetableOilSpreads,
  getOilseedPositioning,
} from "@/lib/api/engineData";
import type { CommodityDirectionLabel } from "@/lib/engines/commodities";

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
  const [heatmap, balances, countryBalances, crush, spreads, positioning] = await Promise.all([
    getCommodityHeatmap(),
    getCommodityBalances(),
    getSoybeanCountryBalances(),
    getSoybeanCrushMargin(),
    getVegetableOilSpreads(),
    getOilseedPositioning(),
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
            Real USDA PSD country-level data — the deepest single-commodity module per the spec (§10-15).
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
                  </tr>
                ))}
              </tbody>
            </table>
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

      <section className="gfew-panel p-4 text-xs text-text-dim">
        <strong className="text-text">What&apos;s real here</strong>: World Bank Pink Sheet prices for
        Soybeans/Soybean Oil/Soybean Meal/Rapeseed Oil/Sunflower Oil/Palm Oil/Palm Kernel Oil/Coconut Oil (monthly
        since 1960); USDA PSD world AND country-level (Brazil, US, Argentina, China, India, Paraguay, Canada,
        Russia, Ukraine, EU) production/crush/imports/exports/ending-stocks for Soybeans, plus world balances for
        Rapeseed and Sunflower seed; a genuine soybean crush margin computed from the three Pink Sheet legs using
        disclosed (not hidden) standard industry extraction ratios; live CFTC non-commercial futures positioning
        for Soybeans, Soybean Oil, Soybean Meal, and Canola; and a vegetable-oil relative-value matrix computed
        directly from existing prices.
        <br />
        <br />
        <strong className="text-text">Checked and confirmed genuinely unavailable</strong>: a CFTC-reportable
        Sunflower futures contract (traded on Euronext/MATIF, not a US exchange); an EIA-style world &ldquo;WORL&rdquo;
        aggregate for oilseeds (that convenience is EIA-specific — USDA PSD requires the EU bloc/member
        resolution logic documented on the parent Commodities page instead); raw seed and meal price series for
        Rapeseed and Sunflower (only their oils are priced in the Pink Sheet/IMF PCPS), so no crush margin is
        computed for those two — shown as unavailable, not approximated.
        <br />
        <br />
        <strong className="text-text">Not built</strong>, and why: weather/ENSO yield-risk modeling and crop
        calendars (needs a paid or complex-to-integrate agromet data source and a validated yield model — a
        shallow version risked more harm than a clear disclosure); futures term structure/basis/carry beyond spot
        positioning (needs a live futures curve feed this app doesn&apos;t have); freight/BDI, port congestion,
        and biofuel-mandate/policy tracking (no free live source found); the full scenario/shock propagation
        engine, systemic risk score, early-warning indicator set, and AI integration (large net-new subsystems
        beyond this pass&apos;s scope). None of this is faked — sections without real data simply don&apos;t
        appear above.
      </section>
    </div>
  );
}
