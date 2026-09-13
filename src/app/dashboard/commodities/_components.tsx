import Link from "next/link";
import {
  getCommodityHeatmap,
  getCommodityBalances,
  getCommodityPriceHeatmapForCategory,
  getCommodityPriceCyclesForCategory,
  getCommodityCountryBalancesForCategory,
} from "@/lib/api/engineData";
import type { CommodityCategory } from "@/lib/commodities/taxonomy";
import type { CountryBalanceCommodityDef } from "@/lib/commodities/countryBalanceTaxonomy";
import type { CommodityDirectionLabel } from "@/lib/engines/commodities";
import type { HeatmapCell } from "@/lib/engines/commodityPriceHeatmap";
import type { GenericCountryClass } from "@/lib/engines/commodityCountryBalance";

export const DIRECTION_COLORS: Record<CommodityDirectionLabel, string> = {
  "STRONG POSITIVE": "#34c085",
  POSITIVE: "#3fa9f5",
  FLAT: "#8b96a8",
  NEGATIVE: "#e0793d",
  "STRONG NEGATIVE": "#e05a4d",
  INSUFFICIENT_DATA: "#5a6472",
};

export function DirectionPill({ direction }: { direction: CommodityDirectionLabel }) {
  const color = DIRECTION_COLORS[direction];
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${color}22`, color }}>
      {direction.replace(/_/g, " ")}
    </span>
  );
}

const CLASS_COLORS: Record<NonNullable<GenericCountryClass>, string> = {
  "Major Exporter": "#34c085",
  "Net Exporter": "#3fa9f5",
  Balanced: "#8b96a8",
  "Net Importer": "#e0793d",
  "Major Importer": "#e05a4d",
};

export function ClassPill({ classification }: { classification: NonNullable<GenericCountryClass> }) {
  const color = CLASS_COLORS[classification];
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${color}22`, color }}>
      {classification}
    </span>
  );
}

export function fmt(v: number | null, decimals = 1): string {
  if (v === null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function pctColor(v: number | null): string {
  if (v === null) return "#8b96a8";
  return v >= 0 ? "#34c085" : "#e05a4d";
}

export function HeatmapCellView({ cell }: { cell: HeatmapCell }) {
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

export function CycleGauge({ distanceFromPeakPct, phase }: { distanceFromPeakPct: number | null; phase: "Bull" | "Bear" | null }) {
  if (distanceFromPeakPct === null || phase === null) return null;
  const clamped = Math.max(-50, Math.min(0, distanceFromPeakPct));
  const positionPct = ((clamped + 50) / 50) * 100;
  const bearThresholdPct = ((-20 + 50) / 50) * 100;
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

export type CategoryPageProps = {
  category: CommodityCategory;
  slug: string;
  title: string;
  intro: string;
  dailySeriesMetricKeyBySlug?: Record<string, string>;
  countryBalanceCategory?: CountryBalanceCommodityDef["category"];
  countryBalanceNote?: string;
  seasonalityNote?: string;
  disclosureReal: string;
  disclosureNotBuilt: string;
};

export async function CommodityCategoryPage(props: CategoryPageProps) {
  const [heatmap, balances, priceHeatmap, priceCycles, countryBalances] = await Promise.all([
    getCommodityHeatmap(),
    getCommodityBalances(),
    getCommodityPriceHeatmapForCategory(props.category, props.dailySeriesMetricKeyBySlug),
    getCommodityPriceCyclesForCategory(props.category),
    props.countryBalanceCategory ? getCommodityCountryBalancesForCategory(props.countryBalanceCategory) : Promise.resolve(null),
  ]);

  const priceRows = (heatmap?.rows ?? []).filter((r) => r.category === props.category);
  const balanceRows = (balances?.rows ?? []).filter((r) => r.category === props.category);
  const allSlugs = new Set([...priceRows.map((r) => r.slug), ...balanceRows.map((r) => r.slug)]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <Link href="/dashboard/commodities" className="text-xs text-accent hover:underline">
          ← Commodities
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">{props.title}</h1>
      </div>
      <p className="mb-8 max-w-3xl text-sm text-text-dim">{props.intro}</p>

      {allSlugs.size > 0 && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Complex Overview</h2>
          <p className="mb-3 text-sm text-text-dim">
            Price momentum{balanceRows.length > 0 ? " and world supply-demand balance" : ""}, filtered to the {props.title} complex.
          </p>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-raised text-text-dim">
                <tr>
                  <th className="px-3 py-2 font-medium">Commodity</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">12M</th>
                  <th className="px-3 py-2 font-medium">Direction</th>
                  {balanceRows.length > 0 && (
                    <>
                      <th className="px-3 py-2 font-medium">World Prod.</th>
                      <th className="px-3 py-2 font-medium">World Consum.</th>
                      <th className="px-3 py-2 font-medium">Stocks/Use</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {[...allSlugs].map((slug) => {
                  const p = priceRows.find((r) => r.slug === slug);
                  const b = balanceRows.find((r) => r.slug === slug);
                  return (
                    <tr key={slug} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-medium">{p?.label ?? b?.label}</td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">{p ? `${fmt(p.price, p.price !== null && p.price >= 100 ? 1 : 2)} ${p.unit}` : "—"}</td>
                      <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(p?.change12m ?? null) }}>
                        {p ? fmtPct(p.change12m) : "—"}
                      </td>
                      <td className="px-3 py-2">{p ? <DirectionPill direction={p.direction} /> : "—"}</td>
                      {balanceRows.length > 0 && (
                        <>
                          <td className="gfew-mono px-3 py-2 text-text-dim">{b ? `${fmt(b.production)} ${b.unit}` : "—"}</td>
                          <td className="gfew-mono px-3 py-2 text-text-dim">{b ? `${fmt(b.consumption)} ${b.unit}` : "—"}</td>
                          <td className="gfew-mono px-3 py-2 text-text-dim">{b?.stocksToUsePct === null || b?.stocksToUsePct === undefined ? "—" : `${b.stocksToUsePct.toFixed(1)}%`}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {countryBalances && countryBalances.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Country Balance Sheet</h2>
          <p className="mb-3 text-sm text-text-dim">
            Real USDA PSD country-level data, same methodology as the Oilseeds engine&apos;s Soybean Country Balance Sheet. Apparent
            Consumption, Stocks/Use and Classification are computed from this same data via the balance-sheet identity, not a new source.
          </p>
          {countryBalances.map((cb) => (
            <div key={cb.commoditySlug} className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-text-dim">{cb.commodityLabel}</h3>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel-raised text-text-dim">
                    <tr>
                      <th className="px-3 py-2 font-medium">Country</th>
                      <th className="px-3 py-2 font-medium">Market Year</th>
                      <th className="px-3 py-2 font-medium">Production</th>
                      <th className="px-3 py-2 font-medium">YoY</th>
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
                    {cb.rows.map((r) => (
                      <tr key={r.slug} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-medium">{r.label}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{r.marketYear ?? "—"}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.production)}</td>
                        <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.productionYoy) }}>
                          {fmtPct(r.productionYoy)}
                        </td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.imports)}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.exports)}</td>
                        <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.netTrade) }}>
                          {r.netTrade === null ? "—" : `${r.netTrade >= 0 ? "+" : ""}${r.netTrade.toFixed(1)}`}
                        </td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.endingStocks)}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{r.apparentConsumption === null ? "—" : fmt(r.apparentConsumption)}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{r.stocksToUsePct === null ? "—" : `${r.stocksToUsePct.toFixed(1)}%`}</td>
                        <td className="px-3 py-2">{r.classification ? <ClassPill classification={r.classification} /> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {cb.exportHHI !== null && (
                <p className="mt-2 text-xs text-text-dim">
                  Export HHI (tracked countries): <span className="gfew-mono text-text">{cb.exportHHI.toFixed(0)}</span> (0-10,000 · &gt;2,500 is
                  highly concentrated) — top exporter{cb.topExporters.length === 1 ? "" : "s"}:{" "}
                  {cb.topExporters.map((e) => `${e.label} (${e.shareOfTracked?.toFixed(0) ?? "—"}%)`).join(", ")}.
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {props.countryBalanceNote && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Country Balance Sheet</h2>
          <p className="text-sm text-text-dim">{props.countryBalanceNote}</p>
        </section>
      )}

      {priceHeatmap && priceHeatmap.rows.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Multi-Timeframe Price Heatmap</h2>
          <p className="mb-3 text-sm text-text-dim">
            Each cell is its own horizon-weighted, z-scored momentum read — the same methodology as the Commodities page&apos;s own momentum
            score, split into three independent timeframe buckets instead of one blended number.{" "}
            <strong className="text-text">Short-Term (0-30D)</strong>{" "}
            {props.dailySeriesMetricKeyBySlug && Object.keys(props.dailySeriesMetricKeyBySlug).length > 0
              ? "is shown only for products with a genuine daily price feed — every other product here has only monthly price data, where a 0-30 day window can't reflect a genuine sample, so those cells read N/A."
              : "reads N/A for every product below — every one of them has only monthly World Bank Pink Sheet / IMF PCPS data, where a 0-30 day window can't reflect a genuine sample rather than approximating from a single monthly print."}{" "}
            <strong className="text-text">Medium-Term (30-90D)</strong> and <strong className="text-text">Long-Term (&gt;90D)</strong> use that
            same monthly series, since 90+ days comfortably spans multiple real monthly observations.
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
            Bull/bear cycles detected from historical price series using the standard disclosed -20%/+20% peak-to-trough/trough-to-recovery
            convention — a mechanical drawdown detector, not a fundamentals-based cycle call. The gauge shows where the current price sits
            between a deep (-50%) drawdown and the running peak; the marker crossing the -20% line is what flips the phase from Bull to Bear.
            The transition probability below each gauge is a plain empirical frequency, not a fitted model: of every historical bear cycle (or
            bull leg) for that product that already lasted at least as long as the current one has so far, what fraction ended within the next
            6/12 months — with a Wilson 95% confidence interval, since sample sizes are small. Below 3 comparable historical phases, no
            probability is shown at all.
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
                        Empirical: {c.transitionProbabilities[0].sampleSize} historical {c.currentPhase === "Bear" ? "bear cycles" : "bull legs"}{" "}
                        that already lasted at least {c.currentPhaseAgeMonths} months (the current phase&apos;s own age) — a plain historical
                        frequency with a Wilson 95% confidence interval, not a fitted model.
                      </div>
                    </div>
                  ) : (
                    c.currentPhaseAgeMonths !== null && (
                      <div className="mt-3 border-t border-border pt-3 text-[10px] text-text-dim">
                        Not enough historical {c.currentPhase === "Bear" ? "bear cycles" : "bull legs"} lasting at least {c.currentPhaseAgeMonths}{" "}
                        months (need 3+, this product has fewer) to estimate a transition probability without it being spurious.
                      </div>
                    )
                  )}
                  {c.historicalCycleCount > 0 && (
                    <div className="mt-3 border-t border-border pt-3 text-[10px] text-text-dim">
                      {c.historicalCycleCount} completed bear cycle{c.historicalCycleCount === 1 ? "" : "s"} on record — avg drawdown{" "}
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

      {props.seasonalityNote && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold">Production &amp; Export Seasonality</h2>
          <p className="text-sm text-text-dim">{props.seasonalityNote}</p>
        </section>
      )}

      <section className="gfew-panel p-4 text-xs text-text-dim">
        <strong className="text-text">What&apos;s real here</strong>: {props.disclosureReal}
        <br />
        <br />
        <strong className="text-text">Not built</strong>, and why: {props.disclosureNotBuilt}
      </section>
    </div>
  );
}
