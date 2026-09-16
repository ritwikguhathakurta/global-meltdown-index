import Link from "next/link";
import { getOleochemicals } from "@/lib/api/engineData";
import { SPEC_OLI_INPUTS } from "@/lib/engines/oleochemicals";
import { fmtPct, pctColor } from "../../_components";

function fmtIndexOrPrice(value: number | null, unit: string): string {
  if (value === null) return "—";
  const decimals = unit.startsWith("index") ? 1 : 2;
  return `${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${unit}`;
}

function fmtUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function fmtTonnes(millionMt: number | null): string {
  if (millionMt === null) return "—";
  return `${(millionMt * 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 0 })} t`;
}

function oliScoreColor(score: number | null): string {
  if (score === null) return "#8b96a8";
  if (score >= 80) return "#e05a4d";
  if (score >= 60) return "#e0793d";
  if (score >= 40) return "#8b96a8";
  if (score >= 20) return "#3fa9f5";
  return "#34c085";
}

function oliScoreLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 80) return "Extreme Tightening";
  if (score >= 60) return "Strengthening";
  if (score >= 40) return "Neutral";
  if (score >= 20) return "Weakening";
  return "Bearish Demand";
}

export default async function OleochemicalsPage() {
  const oleo = await getOleochemicals();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <Link href="/dashboard/commodities/chemicals" className="text-xs text-accent hover:underline">
          ← Chemicals
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold">Oleochemicals</h1>
      <p className="mb-8 max-w-3xl text-sm text-text-dim">
        The special-depth module the Chemicals engine spec calls for (§2, §10-21): Palm Oil/PKO feedstock context
        (reusing the existing Oilseeds engine&apos;s data, not a new source), downstream chemical price proxies
        (Fatty Acids, Surfactants &amp; Soaps/Detergents US PPI — see disclosure below for why these are indices,
        not spot prices), real Malaysia MPOB monthly export volumes, seven real UN Comtrade HS-code trade flows
        for Malaysia and Indonesia, an export-concentration read, a real-chemistry value-chain map, and an
        Oleochemical Leading Indicator built only from the inputs the spec names that this app can source for free.
      </p>

      {!oleo && <p className="text-sm text-text-dim">Oleochemical data is not yet available.</p>}

      {oleo && (
        <>
          <section className="mb-10">
            <h2 className="mb-2 text-lg font-semibold">Feedstock → Downstream Price Context</h2>
            <p className="mb-3 text-sm text-text-dim">
              Palm Oil/PKO/Soybean Oil are genuine $/mt feedstock prices (World Bank Pink Sheet) — Soybean Oil is
              the real-world alternative oleochemical feedstock to palm-based inputs, shown here for the first time.
              Fatty Acids/Surfactants/Soaps
              are a US producer price index, not $/mt — a &ldquo;conversion margin&rdquo; against Palm Oil would mix
              units and produce a number that looks real but isn&apos;t, so it&apos;s shown side by side instead.
              PFAD, Fatty Alcohols, Methyl Esters/FAME and Glycerine are new: real UN Comtrade average unit values
              (USD/mt, the United States&apos; own declared trade), genuinely comparable to the Palm Oil price for
              the first time — see the PFAD/Palm Oil spread below.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {oleo.priceContext.map((p) => (
                <div key={p.slug} className="gfew-panel p-4">
                  <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">{p.label}</div>
                  <div className="mb-2 flex flex-wrap items-baseline gap-3">
                    <span className="gfew-mono text-xl font-semibold">{fmtIndexOrPrice(p.latestValue, p.unit)}</span>
                    <span className="text-xs text-text-dim">{p.asOf?.slice(0, 7) ?? "—"}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-xs text-text-dim">
                    <span>
                      <span className="uppercase tracking-wide">MoM </span>
                      <span className="gfew-mono font-semibold" style={{ color: pctColor(p.changeMomPct) }}>
                        {fmtPct(p.changeMomPct)}
                      </span>
                    </span>
                    <span>
                      <span className="uppercase tracking-wide">12M change </span>
                      <span className="gfew-mono font-semibold" style={{ color: pctColor(p.change12m) }}>
                        {fmtPct(p.change12m)}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {oleo.pfadPalmOilSpread.spreadUsdPerMt !== null && (
              <div className="mt-4 gfew-panel p-4">
                <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">HS 382319 &ldquo;Other Fatty Acids&rdquo; vs. Palm Oil</div>
                <div className="mb-2 flex flex-wrap items-baseline gap-3">
                  <span className="gfew-mono text-xl font-semibold text-text">
                    {oleo.pfadPalmOilSpread.spreadUsdPerMt >= 0 ? "+" : ""}
                    {oleo.pfadPalmOilSpread.spreadUsdPerMt.toFixed(0)} USD/mt
                  </span>
                  <span className="text-xs text-text-dim">
                    {fmtPct(oleo.pfadPalmOilSpread.spreadPct)} vs. Palm Oil
                  </span>
                </div>
                <p className="text-xs text-text-dim">
                  PFAD-bucket price ({oleo.pfadPalmOilSpread.pfadValue?.toFixed(0)} USD/mt, {oleo.pfadPalmOilSpread.pfadAsOf?.slice(0, 7)}) minus
                  Palm Oil ({oleo.pfadPalmOilSpread.palmOilValue?.toFixed(0)} USD/mt, {oleo.pfadPalmOilSpread.palmOilAsOf?.slice(0, 7)}) — spec
                  §15&apos;s &ldquo;PFAD discount to CPO,&rdquo; genuinely computable now that both sides are real $/mt prices. This reads as a
                  large premium, not the discount true PFAD (a lower-value refining byproduct) normally trades at against crude palm oil — because
                  HS 382319 is a shared &ldquo;other fatty acids&rdquo; bucket that also includes higher-value specialty acids (caproic, caprylic,
                  capric, lauric, myristic, linoleic, linolenic), not PFAD exclusively (see the price context note above). Treat the level as this
                  bucket&apos;s real spread to Palm Oil, not a PFAD-specific quote — the sign and magnitude reflect the bucket&apos;s mix, not
                  necessarily PFAD&apos;s own economics.
                </p>
              </div>
            )}
          </section>

          {oleo.exportVolumes.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-2 text-lg font-semibold">Malaysia MPOB Export Volumes</h2>
              <p className="mb-3 text-sm text-text-dim">
                Real monthly tonnage from the Malaysian Palm Oil Board&apos;s own export report — already ingested
                for the Oilseeds SE Asia page, surfaced here directly since Oleochemicals and Biodiesel are
                genuinely part of this module. No price is reported alongside these, only physical export volume.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {oleo.exportVolumes.map((v) => (
                  <div key={v.slug} className="gfew-panel p-4">
                    <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">{v.label}</div>
                    <div className="mb-2 flex flex-wrap items-baseline gap-3">
                      <span className="gfew-mono text-xl font-semibold">{fmtTonnes(v.latestValue)}</span>
                      <span className="text-xs text-text-dim">{v.latestDate?.slice(0, 7) ?? "—"}</span>
                    </div>
                    <div className="text-xs text-text-dim">
                      <span className="uppercase tracking-wide">YoY </span>
                      <span className="gfew-mono font-semibold" style={{ color: pctColor(v.yoy) }}>
                        {fmtPct(v.yoy)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {oleo.feedstockProduction.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-2 text-lg font-semibold">Feedstock Production (FAOSTAT)</h2>
              <p className="mb-3 text-sm text-text-dim">
                Real annual national production — the supply side this module&apos;s price/trade/export data
                doesn&apos;t otherwise cover. Palm Oil (Malaysia/Indonesia) was already ingested for the Oilseeds
                SE Asia page; Coconut Oil (Philippines/Indonesia/Malaysia, the world&apos;s three largest producers
                in that order) was added here directly, feeding the lauric-acid/coconut-oil side of the value chain
                below.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {oleo.feedstockProduction.map((f) => (
                  <div key={f.slug} className="gfew-panel p-4">
                    <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">{f.label}</div>
                    <div className="mb-2 flex flex-wrap items-baseline gap-3">
                      <span className="gfew-mono text-xl font-semibold">{fmtTonnes(f.latestValueMillionMt)}</span>
                      <span className="text-xs text-text-dim">{f.latestYear ?? "—"}</span>
                    </div>
                    <div className="text-xs text-text-dim">
                      <span className="uppercase tracking-wide">YoY </span>
                      <span className="gfew-mono font-semibold" style={{ color: pctColor(f.yoyPct) }}>
                        {fmtPct(f.yoyPct)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mb-10">
            <h2 className="mb-2 text-lg font-semibold">Oleochemical Leading Indicator (OLI)</h2>
            <p className="mb-3 text-sm text-text-dim">
              Spec §52&apos;s 0-100 composite, built the same way as this app&apos;s Leading Banking Stress Score:
              a weighted average of z-scored momentum across only the inputs the spec names that this app has
              genuine free data for, renormalized to whatever&apos;s available, with completeness disclosed rather
              than papered over. 0-20 Bearish Demand · 20-40 Weakening · 40-60 Neutral · 60-80 Strengthening · 80-100
              Extreme Tightening.
            </p>
            <div className="gfew-panel mb-4 p-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="gfew-mono text-3xl font-semibold" style={{ color: oliScoreColor(oleo.leadingIndicator.score) }}>
                  {oleo.leadingIndicator.score ?? "—"}
                </span>
                <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: oliScoreColor(oleo.leadingIndicator.score) }}>
                  {oliScoreLabel(oleo.leadingIndicator.score)}
                </span>
                <span className="text-xs text-text-dim">as of {oleo.leadingIndicator.asOf?.slice(0, 7) ?? "—"}</span>
              </div>
            </div>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel-raised text-text-dim">
                  <tr>
                    <th className="px-3 py-2 font-medium">Component</th>
                    <th className="px-3 py-2 font-medium">Weight</th>
                    <th className="px-3 py-2 font-medium">Score (0-100)</th>
                  </tr>
                </thead>
                <tbody>
                  {oleo.leadingIndicator.components.map((c) => (
                    <tr key={c.key} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-medium">{c.label}</td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">{(c.weight * 100).toFixed(0)}%</td>
                      <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: c.score === null ? "#8b96a8" : oliScoreColor(c.score) }}>
                        {c.score ?? "N/A — series too short"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-panel-raised text-text-dim">
                  <tr>
                    <th className="px-3 py-2 font-medium">Spec §52 input</th>
                    <th className="px-3 py-2 font-medium">Covered?</th>
                    <th className="px-3 py-2 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {SPEC_OLI_INPUTS.map((i) => (
                    <tr key={i.name} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-medium">{i.name}</td>
                      <td className="px-3 py-2" style={{ color: i.covered ? "#34c085" : "#e05a4d" }}>
                        {i.covered ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-2 text-text-dim">{i.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-3 text-[10px] text-text-dim">
                {SPEC_OLI_INPUTS.filter((i) => i.covered).length} of {SPEC_OLI_INPUTS.length} spec-named inputs
                covered with genuine free data — the score above is renormalized across only those, not silently
                filled in for the rest.
              </p>
            </div>
          </section>

          {oleo.tradeFlows.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-2 text-lg font-semibold">
                Oleochemical Trade Flows ({oleo.tradeFlowsAsOfYear ?? "—"})
              </h2>
              <p className="mb-3 text-sm text-text-dim">
                Real bilateral export values from UN Comtrade, among Malaysia, Indonesia, and their eight largest
                trading partners for these products (China, India, US, Netherlands, Germany, Pakistan, Japan, South
                Korea) — the exact same connector pattern as the Energy Trade Network graph, extended to a country
                and HS-code universe that actually covers the two dominant oleochemical exporters. HS 3823 covers
                industrial monocarboxylic fatty acids, acid oils from refining, and industrial fatty alcohols — the
                actual trade classification for fatty acids/PFAD, not a single dedicated HS code. HS 2905.45
                (Glycerine), HS 3826 (Biodiesel/FAME mixtures) and HS 3401.20 (soap in other forms, incl. noodles)
                were added for this build&apos;s value-chain expansion, live-verified for both reporters first.
              </p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel-raised text-text-dim">
                    <tr>
                      <th className="px-3 py-2 font-medium">Product (HS)</th>
                      <th className="px-3 py-2 font-medium">Exporter</th>
                      <th className="px-3 py-2 font-medium">Importer</th>
                      <th className="px-3 py-2 font-medium">Export Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oleo.tradeFlows.slice(0, 50).map((f, i) => (
                      <tr key={`${f.commoditySlug}-${f.reporter}-${f.partner}-${i}`} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-medium">
                          {f.commodityLabel}
                          <div className="text-[10px] text-text-dim">HS {f.hsCode}</div>
                        </td>
                        <td className="px-3 py-2 text-text-dim">{f.reporter}</td>
                        <td className="px-3 py-2 text-text-dim">{f.partner}</td>
                        <td className="gfew-mono px-3 py-2 font-semibold text-text">{fmtUsd(f.valueUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {oleo.tradeTrends.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-2 text-lg font-semibold">Trade Price &amp; Volume Trend</h2>
              <p className="mb-3 text-sm text-text-dim">
                Customs unit price (declared export value ÷ declared export weight, converted to USD/mt) and
                year-over-year export/import value momentum for Malaysia and Indonesia, world-aggregate (all
                partners combined) — a genuine price derived from the same UN Comtrade customs data as the trade
                flows above, not a market spot price and not fabricated. 3Y/5Y averages use however many years are
                actually available for that commodity (shown in the &quot;Years&quot; column) — never padded to a
                fixed window. Only trusted when Comtrade itself reports the weight in kilograms; a year without a
                trustworthy weight shows a value trend with no price.
              </p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel-raised text-text-dim">
                    <tr>
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Reporter</th>
                      <th className="px-3 py-2 font-medium">Years</th>
                      <th className="px-3 py-2 font-medium">Current-Year Price</th>
                      <th className="px-3 py-2 font-medium">3Y Avg Price</th>
                      <th className="px-3 py-2 font-medium">5Y Avg Price</th>
                      <th className="px-3 py-2 font-medium">Export YoY</th>
                      <th className="px-3 py-2 font-medium">Import YoY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oleo.tradeTrends.map((t) => (
                      <tr key={`${t.commoditySlug}-${t.reporterSlug}`} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-medium">{t.commodityLabel}</td>
                        <td className="px-3 py-2 text-text-dim">{t.reporter}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{t.yearsAvailable}</td>
                        <td className="gfew-mono px-3 py-2 text-text">
                          {t.currentYearPrice !== null ? `$${t.currentYearPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mt` : "—"}
                        </td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">
                          {t.avgPrice3y !== null ? `$${t.avgPrice3y.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mt` : "—"}
                        </td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">
                          {t.avgPrice5y !== null ? `$${t.avgPrice5y.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mt` : "—"}
                        </td>
                        <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(t.exportYoyPct) }}>
                          {fmtPct(t.exportYoyPct)}
                        </td>
                        <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(t.importYoyPct) }}>
                          {fmtPct(t.importYoyPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {oleo.concentration.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-2 text-lg font-semibold">Export Concentration</h2>
              <p className="mb-3 text-sm text-text-dim">
                HHI and top-partner share (spec §44/45), computed directly from the trade-flow values above — no new
                source. Same 0-10,000 HHI scale used on the Country Balance Sheet pages: above 2,500 is highly
                concentrated.
              </p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel-raised text-text-dim">
                    <tr>
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Exporter</th>
                      <th className="px-3 py-2 font-medium">Partners Tracked</th>
                      <th className="px-3 py-2 font-medium">Top-1 Share</th>
                      <th className="px-3 py-2 font-medium">Top-3 Share</th>
                      <th className="px-3 py-2 font-medium">HHI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oleo.concentration.map((c) => (
                      <tr key={`${c.commoditySlug}-${c.reporter}`} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-medium">{c.commodityLabel}</td>
                        <td className="px-3 py-2 text-text-dim">{c.reporter}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{c.partnerCount}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{c.top1SharePct.toFixed(1)}%</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{c.top3SharePct.toFixed(1)}%</td>
                        <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: c.hhi >= 2500 ? "#e0793d" : "#8b96a8" }}>
                          {c.hhi.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-text-dim">
                HHI here is computed only across the ten reporters/partners this module tracks (spec §55 above), not
                every country in the world — a genuinely smaller universe than the Country Balance Sheet pages&apos;
                own HHI, disclosed the same way there.
              </p>
            </section>
          )}

          <section className="mb-10">
            <h2 className="mb-2 text-lg font-semibold">Oleochemical Value-Chain Map</h2>
            <p className="mb-3 text-sm text-text-dim">
              Spec §21&apos;s directed graph, reproduced as real, well-documented industrial chemistry — not a live
              data series. Green nodes have genuine tracked data in this app (linked above); grey nodes are real
              products/processes with no free live source found for them.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {oleo.valueChains.map((chain) => (
                <div key={chain.id} className="gfew-panel p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">{chain.label}</div>
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    {chain.nodeIds.map((nodeId, i) => {
                      const node = oleo.valueChainNodes[nodeId];
                      return (
                        <span key={`${chain.id}-${nodeId}`} className="flex items-center gap-1">
                          <span
                            className="rounded px-2 py-1 font-medium"
                            style={{ background: node.hasData ? "#34c08522" : "#5a647222", color: node.hasData ? "#34c085" : "#8b96a8" }}
                            title={node.dataNote}
                          >
                            {node.label}
                          </span>
                          {i < chain.nodeIds.length - 1 && <span className="text-text-dim">→</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="gfew-panel p-4 text-xs text-text-dim">
        <strong className="text-text">What&apos;s real here</strong>: Palm Oil and Palm Kernel Oil feedstock prices
        (World Bank Pink Sheet, already ingested for the Oilseeds engine, reused here directly); Fatty Acids,
        Surfactants and Soaps/Detergents US Producer Price Index series from FRED, verified live; real monthly
        Malaysia MPOB export tonnage for Oleochemicals, Biodiesel and Finished Products; real bilateral export trade
        values from UN Comtrade across seven HS codes — Palm Oil (1511), Palm Kernel/Coconut Oil (1513), industrial
        Fatty Acids/Acid Oils/Fatty Alcohols (3823), Surfactants (3402), Glycerine (2905.45), Biodiesel/FAME mixtures
        (3826), and Soap/Noodles (3401.20) — among Malaysia, Indonesia, and eight major trading partners (Malaysia
        and Indonesia were verified live as working Comtrade reporters; they aren&apos;t in the 16-country set the
        Energy Trade Network already uses, so a separate, smaller country universe was built for this module
        specifically); export concentration (HHI/top-share) computed from that same trade data; a Trade Price &amp;
        Volume Trend for Malaysia/Indonesia (world-aggregate export and import value and, where Comtrade reports the
        weight in kilograms, a genuine customs unit price in USD/mt) with 3Y/5Y averages and year-over-year
        export/import momentum — the four original HS codes were backfilled with a one-time historical pull to five
        years of history; the three added later (Glycerine, FAME, Soap Noodles) accumulate one more year per
        pipeline run; real annual Feedstock Production from FAOSTAT&apos;s bulk data — Palm Oil for Malaysia/
        Indonesia (already ingested for the Oilseeds SE Asia page) and Coconut Oil for the Philippines/Indonesia/
        Malaysia (added directly for this module, area/item codes verified live against FAOSTAT&apos;s own
        reference columns before use); a real-chemistry value-chain map (spec §21); and an Oleochemical Leading
        Indicator (spec §52) built only from the spec-named inputs this app can source for free, with coverage
        disclosed component-by-component above; real UN Comtrade average unit-value prices (USD/mt, monthly, United
        States) for PFAD (HS 382319), Fatty Alcohols (382370), Methyl Esters/FAME (382600) and Glycerine (290545) —
        newly added, upgrading four of the spec&apos;s own OLI inputs from &ldquo;no free price found&rdquo; to a
        genuine live price; and the PFAD/Palm Oil spread above, the first oleochemical margin this app computes in
        matching $/mt units on both sides.
        <br />
        <br />
        <strong className="text-text">Not built</strong>, and why: individual fatty acids (Lauric/Myristic/Linoleic
        etc.) and methanol as separately priced products — individual fatty acids still share HS 382319&apos;s
        &ldquo;other&rdquo; bucket with each other (only Stearic and Oleic Acid have their own dedicated HS codes,
        382311/382312 — see the Chemical Products Master page), and methanol has no free price/PPI series anywhere,
        checked live; a conversion margin for Fatty Alcohols or Methyl Esters specifically (only the PFAD/Palm Oil
        spread above is computed) — those need an equally well-matched feedstock reference, which PFAD/Palm Oil has
        and this app hasn&apos;t built out for the others yet; bilateral
        per-partner-pair Trade Flow Surprise / seasonality (spec §50) — the world-aggregate trend above now has
        multi-year YoY momentum, but each individual reporter→partner pair in the Trade Flows table still has only
        one year of history, so a per-partner-pair surprise isn&apos;t computable yet;
        company-level oleochemical producer/trader intelligence (Wilmar, IOI, KLK, Musim Mas, etc.), plant capacity
        and outage tracking, and a producer margin engine (spec §26-29, 37-40, 46-47) — these need continuous
        company/plant discovery from customs filings, annual reports and commercial trade databases (Panjiva/Volza/
        ImportGenius), which is paid infrastructure this app doesn&apos;t have, and this project doesn&apos;t
        fabricate company names, capacity figures, or shipment records; Monte Carlo, machine learning, and Granger
        causality/causal-chain analysis (spec §58-60, 75-76) — this app is TypeScript/Next.js/Supabase only, with no
        Python runtime; daily/weekly/monthly automated reports, an alert engine, and a dedicated Command
        Center/Beginner-Advanced UI (spec §87-101) — depend on the data layers above and are an infrastructure
        decision, not something to build silently inside a data page.
      </section>
    </div>
  );
}
