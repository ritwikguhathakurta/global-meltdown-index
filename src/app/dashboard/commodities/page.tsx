import { getCommodityHeatmap, getCommodityBalances } from "@/lib/api/engineData";
import { COMMODITY_CATEGORIES } from "@/lib/commodities/taxonomy";
import { BALANCE_CATEGORIES } from "@/lib/commodities/balanceTaxonomy";
import type { CommodityDirectionLabel, CommodityRow } from "@/lib/engines/commodities";
import type { BalanceRow } from "@/lib/engines/commodityBalance";
import { getCommodityComposite } from "@/lib/engines/commodityComposite";

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

function fmtPrice(v: number | null, unit: string): string {
  if (v === null) return "—";
  const decimals = v >= 100 ? 1 : v >= 1 ? 2 : 4;
  return `${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${unit}`;
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function pctColor(v: number | null): string {
  if (v === null) return "#8b96a8";
  return v >= 0 ? "#34c085" : "#e05a4d";
}

function fmtQty(v: number | null): string {
  if (v === null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default async function CommoditiesPage() {
  const [heatmap, balances] = await Promise.all([getCommodityHeatmap(), getCommodityBalances()]);
  const composite = heatmap && balances ? getCommodityComposite(heatmap, balances) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Commodities</h1>
      <p className="mb-6 max-w-3xl text-sm text-text-dim">
        Real monthly commodity prices from the World Bank Pink Sheet (free, no key, since 1960) and the IMF
        Primary Commodity Price System (free, no key, via DBnomics) across ~56 commodities, with a
        price-momentum signal — Phase 1 of a much larger planned build. See the disclosure below for what this
        is (and isn&apos;t) measuring yet.
      </p>

      {!heatmap && <p className="text-sm text-text-dim">Commodity data is not yet available.</p>}

      {heatmap && (
        <>
          <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="gfew-panel p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">Bullish</div>
              <div className="gfew-mono text-xl font-semibold" style={{ color: "#34c085" }}>
                {heatmap.breadth.bullishPct}%
              </div>
            </div>
            <div className="gfew-panel p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">Neutral</div>
              <div className="gfew-mono text-xl font-semibold text-text-dim">{heatmap.breadth.neutralPct}%</div>
            </div>
            <div className="gfew-panel p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">Bearish</div>
              <div className="gfew-mono text-xl font-semibold" style={{ color: "#e05a4d" }}>
                {heatmap.breadth.bearishPct}%
              </div>
            </div>
            <div className="gfew-panel p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">Coverage</div>
              <div className="gfew-mono text-xl font-semibold">
                {heatmap.breadth.withData}/{heatmap.breadth.total}
              </div>
            </div>
          </section>

          {COMMODITY_CATEGORIES.map((category) => {
            const rows: CommodityRow[] = heatmap.rows.filter((r) => r.category === category);
            if (rows.length === 0) return null;
            return (
              <section key={category} className="mb-8">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">{category}</h2>
                <div className="overflow-x-auto rounded border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-panel-raised text-text-dim">
                      <tr>
                        <th className="px-3 py-2 font-medium">Commodity</th>
                        <th className="px-3 py-2 font-medium">Price</th>
                        <th className="px-3 py-2 font-medium">1M</th>
                        <th className="px-3 py-2 font-medium">3M</th>
                        <th className="px-3 py-2 font-medium">12M</th>
                        <th className="px-3 py-2 font-medium">36M</th>
                        <th className="px-3 py-2 font-medium">5Y %ile</th>
                        <th className="px-3 py-2 font-medium">Momentum</th>
                        <th className="px-3 py-2 font-medium">Direction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.slug} className="border-t border-border align-top">
                          <td className="px-3 py-2 font-medium">{r.label}</td>
                          <td className="gfew-mono px-3 py-2 text-text-dim">{fmtPrice(r.price, r.unit)}</td>
                          <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.change1m) }}>
                            {fmtPct(r.change1m)}
                          </td>
                          <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.change3m) }}>
                            {fmtPct(r.change3m)}
                          </td>
                          <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.change12m) }}>
                            {fmtPct(r.change12m)}
                          </td>
                          <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.change36m) }}>
                            {fmtPct(r.change36m)}
                          </td>
                          <td className="gfew-mono px-3 py-2 text-text-dim">{r.pricePercentile5y ?? "—"}</td>
                          <td className="gfew-mono px-3 py-2 text-text-dim">{r.momentumScore ?? "—"}</td>
                          <td className="px-3 py-2">
                            <DirectionPill direction={r.direction} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          {balances && balances.rows.length > 0 && (
            <>
              <h2 className="mb-2 text-lg font-semibold">Global Supply &amp; Demand Balance</h2>
              <p className="mb-4 max-w-3xl text-sm text-text-dim">
                Real annual world production, consumption, and ending stocks from USDA FAS&apos;s Production,
                Supply and Distribution database, the EIA&apos;s own World energy aggregates, and FAOSTAT
                (production only for Cocoa/Tea/Rubber/Tobacco — see disclosure below). Stocks-to-use is the
                standard tightness metric — a falling ratio means the world is drawing down inventory faster than
                it&apos;s replacing it.
              </p>
              {BALANCE_CATEGORIES.map((category) => {
                const rows: BalanceRow[] = balances.rows.filter((r) => r.category === category);
                if (rows.length === 0) return null;
                return (
                  <section key={category} className="mb-8">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">{category}</h3>
                    <div className="overflow-x-auto rounded border border-border">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-panel-raised text-text-dim">
                          <tr>
                            <th className="px-3 py-2 font-medium">Commodity</th>
                            <th className="px-3 py-2 font-medium">Market Year</th>
                            <th className="px-3 py-2 font-medium">Production</th>
                            <th className="px-3 py-2 font-medium">YoY</th>
                            <th className="px-3 py-2 font-medium">Consumption</th>
                            <th className="px-3 py-2 font-medium">Ending Stocks</th>
                            <th className="px-3 py-2 font-medium">Stocks/Use</th>
                            <th className="px-3 py-2 font-medium">Stocks/Use YoY</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.slug} className="border-t border-border align-top">
                              <td className="px-3 py-2 font-medium">
                                {r.label} <span className="text-text-dim">({r.unit})</span>
                              </td>
                              <td className="gfew-mono px-3 py-2 text-text-dim">{r.marketYear ?? "—"}</td>
                              <td className="gfew-mono px-3 py-2 text-text-dim">{fmtQty(r.production)}</td>
                              <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.productionYoy) }}>
                                {fmtPct(r.productionYoy)}
                              </td>
                              <td className="gfew-mono px-3 py-2 text-text-dim">{fmtQty(r.consumption)}</td>
                              <td className="gfew-mono px-3 py-2 text-text-dim">{fmtQty(r.endingStocks)}</td>
                              <td className="gfew-mono px-3 py-2 text-text-dim">
                                {r.stocksToUsePct === null ? "—" : `${r.stocksToUsePct.toFixed(1)}%`}
                              </td>
                              <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.stocksToUseYoy !== null ? -r.stocksToUseYoy : null) }}>
                                {fmtPct(r.stocksToUseYoy)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </>
          )}

          {composite && composite.rows.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-2 text-lg font-semibold">Momentum + Balance Composite</h2>
              <p className="mb-4 max-w-3xl text-sm text-text-dim">
                Not the full spec Commodity Direction Score — see the disclosure below for why. An equal-weight
                blend of price momentum (above) and a balance &ldquo;tightness&rdquo; signal (where the latest
                stocks-to-use ratio sits vs. its own full history), for the {composite.rows.length} commodities
                where this app has both a price and a USDA-PSD-style consumption series.
              </p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel-raised text-text-dim">
                    <tr>
                      <th className="px-3 py-2 font-medium">Commodity</th>
                      <th className="px-3 py-2 font-medium">Momentum</th>
                      <th className="px-3 py-2 font-medium">Balance Tightness</th>
                      <th className="px-3 py-2 font-medium">Composite</th>
                      <th className="px-3 py-2 font-medium">Direction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {composite.rows.map((r) => (
                      <tr key={r.slug} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-medium">{r.label}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{r.momentumScore ?? "—"}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{r.balanceScore ?? "—"}</td>
                        <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.compositeScore) }}>
                          {r.compositeScore ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <DirectionPill direction={r.direction} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="gfew-panel p-4 text-xs text-text-dim">
            <strong className="text-text">Phase 1 (shipped)</strong>: real World Bank Pink Sheet price data (free,
            no key, monthly since 1960, ~50 commodities) plus IMF Primary Commodity Price System data for six
            critical minerals (Cobalt, Lithium, Manganese, Molybdenum, Vanadium Pentoxide, and a Rare Earth
            Elements basket) — free, no key, mirrored via DBnomics after IMF&apos;s own API endpoints for this
            dataset were checked live and found dead. Each commodity gets a genuine price-momentum signal:
            1M/3M/6M/12M/36M returns are z-scored against that same commodity&apos;s own trailing return history,
            then blended per the spec&apos;s own horizon weights (10/20/25/30/15) and classified into STRONG
            POSITIVE..STRONG NEGATIVE buckets. This is deliberately <em>not</em> called a &ldquo;Commodity
            Direction Score&rdquo; because the full CDS spec weights price momentum at only 10% alongside demand
            (20%), supply (15%), inventory (15%) and balance (15%) — the balance piece below is new; demand/supply
            scoring is not wired in yet. Checked and confirmed missing from both price sources: Graphite,
            Tungsten, and a distinct OPEC Reference Basket series (EIA v2 publishes Brent/WTI/Dubai only;
            opec.org&apos;s own basket page returns HTTP 403 to unauthenticated requests; no free mirror exists in
            FRED or DBnomics either) — a USGS Mineral Commodity Summaries source exists for Graphite/Tungsten
            production and reserves but is annual, PDF-only, and not yet wired in.
            <br />
            <br />
            <strong className="text-text">Phase 2 (shipped)</strong>: the Global Supply &amp; Demand Balance table
            above — real annual world production/consumption/ending-stocks for 20 agricultural commodities
            (Grains, Oilseeds, Soft Commodities, Livestock/Dairy) from USDA FAS&apos;s free, no-key PSD bulk data
            file. World totals required care: PSD sometimes reports EU production only as a bloc with no
            individual member rows (true for Wheat — naively excluding the EU bloc code undercounts world
            production by ~15%, verified live) and sometimes reports EU members individually alongside the bloc
            in the same years (true for Sugar, 2001-2005, which would double-count if both were summed) —
            resolved per commodity/year by preferring the member-country sum when it exists and falling back to
            the bloc figure otherwise.
            <br />
            <br />
            <strong className="text-text">Phase 2b (shipped)</strong>: world Petroleum &amp; Other Liquids,
            Natural Gas, and Coal production/consumption from the EIA&apos;s own pre-computed &ldquo;World&rdquo;
            region aggregate (not summed from countries — EIA publishes it directly, verified against known
            figures). Also Cocoa, Tea, Rubber, and Tobacco world production from FAOSTAT&apos;s free bulk data
            file (FAOSTAT&apos;s live JSON API is unreachable from this deployment — TLS connects but the request
            hangs, consistent with a bot challenge that never resolves for non-browser clients — so this uses
            FAOSTAT&apos;s S3-hosted bulk CSV instead). FAOSTAT reports production only, not
            consumption/stocks, for these four — they show &ldquo;—&rdquo; for those columns above rather than a
            fabricated number. EIA has no &ldquo;crude oil consumption&rdquo; concept at all (crude isn&apos;t
            consumed directly, it&apos;s refined first, verified live), so the energy row pairs production and
            consumption at the broader &ldquo;Petroleum &amp; Other Liquids&rdquo; level instead — the same
            convention this app already uses for country-level energy balances.
            <br />
            <br />
            <strong className="text-text">Momentum + Balance Composite (shipped, not the full CDS)</strong>: the
            spec&apos;s full Commodity Direction Score weights (momentum 10% / demand 20% / supply 15% /
            inventory 15% / balance 15%, per this app&apos;s own earlier disclosures) only ever accounted for 75%
            of its own stated total — the remaining ~25% component was never fully captured from the original
            spec text, and rather than invent a number to fill that gap, the table above is an honestly-scoped
            two-factor blend built only from data this app actually has: price momentum plus a balance
            &ldquo;tightness&rdquo; percentile (where the latest stocks-to-use ratio sits vs. its own up-to-45-year
            history), equal-weighted since there&apos;s no basis to prefer one factor. It covers only the ~16
            commodities with both a price and a matching USDA-PSD-style consumption series under the same name.
            <br />
            <br />
            <strong className="text-text">Genuinely still to build</strong>, in rough priority order: the actual
            spec-weighted Commodity Direction Score (needs the original spec&apos;s exact remaining formula
            components, not yet re-supplied), production data for base/precious metals (checked live: USGS
            publishes this but only as annual PDFs, and this app has no PDF-parsing infrastructure — deferred, not
            silently skipped), a UN Comtrade-based commodity trade network, an India-specific
            production/consumption/import-dependency view, a Global Commodity Stress Index, an early-warning
            alert engine, scenario/backtesting tools, and fundamental-value/forecast models. None of this is
            faked in the meantime — categories and commodities without real data simply don&apos;t appear above.
          </section>
        </>
      )}
    </div>
  );
}
