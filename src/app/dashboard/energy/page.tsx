import { getLatestEngine, getEnergySystemicRiskResult, getCountryEnergyBalanceTable, getCountryRenewablesTable, getGridSnapshots, getEnergyTradeNetworkGraph } from "@/lib/api/engineData";
import type { EnergyTradeNetworkResult } from "@/lib/engines/energyTradeNetwork";
import { EngineDetail } from "@/components/EngineDetail";
import { ENERGY_STAGES, STRUCTURAL_WEIGHTS, COMPOSITE_WEIGHTS, type EnergyRegimeLabel } from "@/lib/engines/energySystemicRisk";
import { ENERGY_SCENARIOS, runAllEnergyScenarios, type EnergyScenarioResult } from "@/lib/engines/energyScenarios";
import { gfmiColor } from "@/components/RegimeBadge";
import { TrendIndicator } from "@/components/TrendIndicator";

const REGIME_COLORS: Record<EnergyRegimeLabel, string> = {
  AMPLE_SUPPLY: "#34c085",
  BALANCED: "#3fa9f5",
  TIGHTENING: "#e0b93d",
  SHOCK_RISK: "#e0793d",
  ACTIVE_CRISIS: "#e05a4d",
  INSUFFICIENT_DATA: "#5a6472",
};

function RegimePill({ regime }: { regime: EnergyRegimeLabel }) {
  const color = REGIME_COLORS[regime];
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide" style={{ background: `${color}22`, color }}>
      {regime.replace(/_/g, " ")}
    </span>
  );
}

function fmt(v: number | null, unit: string, decimals = 1): string {
  if (v === null) return "—";
  return `${v.toFixed(decimals)}${unit ? " " + unit : ""}`;
}

function scoreColor(score: number | null): string {
  if (score === null) return "#5a6472";
  if (score < 20) return "#34c085";
  if (score < 40) return "#3fa9f5";
  if (score < 60) return "#e0b93d";
  if (score < 80) return "#e0793d";
  return "#e05a4d";
}

const STAGE_SAMPLE_SCORE = [10, 25, 40, 55, 70, 85, 95];

function stageColor(stage: number | null): { bg: string; fg: string } {
  if (stage === null || stage < 1 || stage > 7) return { bg: "#1a1f28", fg: "#8b96a8" };
  return gfmiColor(STAGE_SAMPLE_SCORE[stage - 1]);
}

function contribution(score: number | null, weight: number): number | null {
  if (score === null) return null;
  return Math.round(score * weight * 10) / 10;
}

type Segment = { label: string; value: number | null; color: string };

function ContributionBar({ segments, total }: { segments: Segment[]; total: number | null }) {
  const known = segments.filter((s) => s.value !== null) as { label: string; value: number; color: string }[];
  const sum = known.reduce((a, b) => a + b.value, 0);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded bg-panel-raised">
        {known.map((s) => (
          <div key={s.label} style={{ width: `${sum > 0 ? (s.value / sum) * 100 : 0}%`, background: s.color }} title={`${s.label}: ${s.value} pts`} />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-text-dim">
        {segments.map((s) => (
          <span key={s.label}>
            {s.label} <span className="gfew-mono">{s.value ?? "—"}</span>
          </span>
        ))}
        {total !== null && (
          <span className="ml-auto font-semibold text-text">
            = <span className="gfew-mono">{total}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function pctColor(pct: number | null): string {
  if (pct === null) return "#5a6472";
  if (pct >= 50) return "#e05a4d";
  if (pct >= 20) return "#e0793d";
  if (pct >= 0) return "#e0b93d";
  return "#34c085"; // net exporter
}

function renewableShareColor(pct: number | null): string {
  if (pct === null) return "#5a6472";
  if (pct >= 50) return "#34c085";
  if (pct >= 25) return "#3fa9f5";
  if (pct >= 10) return "#e0b93d";
  return "#e0793d";
}

function fmtUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const COMMODITY_COLORS: Record<string, string> = { oil: "#34c085", gas: "#e0b93d" };

function TradeNetworkSection({ network }: { network: EnergyTradeNetworkResult }) {
  const size = 520;
  const center = size / 2;
  const nodeRadius = 190;
  const labelRadius = 225;
  const activeSlugs = network.nodes.filter((n) => n.degree > 0).map((n) => n.slug);
  const angleFor = (slug: string) => {
    const idx = activeSlugs.indexOf(slug);
    return idx === -1 ? 0 : (idx / activeSlugs.length) * 2 * Math.PI - Math.PI / 2;
  };
  const posFor = (slug: string, r: number) => {
    const a = angleFor(slug);
    return { x: center + r * Math.cos(a), y: center + r * Math.sin(a) };
  };
  const maxEdgeValue = Math.max(1, ...network.edges.map((e) => e.valueUsd));
  const maxBetweenness = Math.max(1, ...network.nodes.map((n) => n.betweenness));

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Global Energy Trade Network</h2>
      <p className="mb-3 max-w-3xl text-xs text-text-dim">
        Real bilateral crude-oil and petroleum-gas export values from UN Comtrade (free, no key), among the
        same 16-country universe used elsewhere on this page. Line thickness scales with trade value; node
        size and color scale with betweenness centrality — computed with Brandes&apos; algorithm on the
        actual trade graph, i.e. how often a country sits on the shortest connective path between two other
        countries in this network, not a hand-picked score.
      </p>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex justify-center rounded border border-border bg-panel-raised p-2 lg:w-1/2">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[520px]">
            {network.edges.map((e, i) => {
              const from = posFor(e.fromSlug, nodeRadius);
              const to = posFor(e.toSlug, nodeRadius);
              const strokeWidth = 0.5 + (Math.log10(1 + e.valueUsd) / Math.log10(1 + maxEdgeValue)) * 4;
              return (
                <line
                  key={`${e.commodity}-${e.fromSlug}-${e.toSlug}-${i}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={COMMODITY_COLORS[e.commodity] ?? "#8b96a8"}
                  strokeOpacity={0.45}
                  strokeWidth={strokeWidth}
                />
              );
            })}
            {activeSlugs.map((slug) => {
              const node = network.nodes.find((n) => n.slug === slug);
              if (!node) return null;
              const pos = posFor(slug, nodeRadius);
              const labelPos = posFor(slug, labelRadius);
              const r = 4 + (node.betweenness / maxBetweenness) * 10;
              return (
                <g key={slug}>
                  <circle cx={pos.x} cy={pos.y} r={r} fill={gfmiColor(Math.min(100, node.betweenness)).bg} stroke={gfmiColor(Math.min(100, node.betweenness)).fg} strokeWidth={1} />
                  <text x={labelPos.x} y={labelPos.y} fontSize={10} fill="#8b96a8" textAnchor="middle" dominantBaseline="middle">
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="overflow-x-auto rounded border border-border lg:w-1/2">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Degree</th>
                <th className="px-3 py-2 font-medium">Betweenness</th>
                <th className="px-3 py-2 font-medium">Exports</th>
                <th className="px-3 py-2 font-medium">Imports*</th>
              </tr>
            </thead>
            <tbody>
              {network.nodes
                .filter((n) => n.degree > 0)
                .map((n) => (
                  <tr key={n.slug} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">{n.label}</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{n.degree}</td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(n.betweenness) }}>
                      {n.betweenness}
                    </td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{fmtUsd(n.exportValueUsd)}</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">{fmtUsd(n.importValueUsd)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-text-dim">
        {network.edges.length} bilateral trade edges across {network.nodes.filter((n) => n.degree > 0).length} countries, as of{" "}
        {network.asOf?.slice(0, 4) ?? "—"}. *Imports are mirror statistics (partners&apos; own declared exports to this country), the standard
        convention when direct import-side reporting isn&apos;t independently pulled. Green = oil (HS 2709), amber = petroleum gas incl. LNG
        (HS 2711).
      </p>
    </section>
  );
}

export default async function EnergyPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const [rows, gesri, countryBalance, countryRenewables, gridSnapshots, tradeNetwork] = await Promise.all([
    getLatestEngine("energy"),
    getEnergySystemicRiskResult(),
    getCountryEnergyBalanceTable(),
    getCountryRenewablesTable(),
    getGridSnapshots(),
    getEnergyTradeNetworkGraph(),
  ]);
  const selectedScenarioId = (await searchParams).scenario ?? null;

  const scenarioResults: EnergyScenarioResult[] | null = gesri
    ? runAllEnergyScenarios({
        oilScore: gesri.oilScore,
        gasScore: gesri.gasScore,
        mineralsScore: gesri.mineralsScore,
        shippingScore: gesri.shippingScore,
        marketScore: gesri.marketScore,
      })
    : null;
  const selectedScenario = scenarioResults?.find((r) => r.scenario.id === selectedScenarioId) ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Energy</h1>
      <EngineDetail title="Energy" rows={rows} />

      <h2 className="mb-2 mt-12 text-xl font-semibold">Global Energy Systemic Risk (GESRI)</h2>
      <p className="mb-6 max-w-3xl text-sm text-text-dim">
        Where is the global energy system becoming fragile, and is that stress converging across
        commodities — a genuinely different question from the flat spot-price composite above. Four
        structural domains (Oil, Natural Gas, Critical Minerals/Nuclear Fuel, Shipping/Supply Chain — the
        last now including real daily chokepoint-transit data from IMF PortWatch), a market domain
        (energy-sector equities), and a Convergence score measuring how many of those four domains are
        independently elevated at once. This is a phased build against a 171-section institutional spec;
        country-level energy balances, OPEC+ quota tracking, a futures-curve/backwardation signal, grid
        data and a network graph are still being worked through — checked against real free sources, not
        faked — see the methodology page for current phase status.
      </p>

      {gesri === null ? (
        <p className="text-sm text-text-dim">No data yet — trigger a pipeline run from /admin.</p>
      ) : (
        <>
          <section className="gfew-panel mb-8 p-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Crisis Stage</h3>
            <p className="mb-3 max-w-3xl text-xs text-text-dim">
              Stages 1-6 come from the global Structural (oil/gas/minerals/shipping) + Market
              (energy-sector equities) blend. Stage 7 requires a high Convergence reading — most
              structural domains elevated simultaneously — alongside an already-high composite.
            </p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {ENERGY_STAGES.map((s) => {
                const active = gesri.stage === s.stage;
                const { bg, fg } = stageColor(s.stage);
                return (
                  <div
                    key={s.stage}
                    className="min-w-[110px] flex-1 rounded px-2 py-2 text-center"
                    style={{
                      background: active ? bg : "#1a1f28",
                      color: active ? fg : "#5a6472",
                      outline: active ? `2px solid ${fg}` : "none",
                      outlineOffset: "-2px",
                    }}
                    title={s.description}
                  >
                    <div className="gfew-mono text-[10px] font-semibold uppercase tracking-wide">Stage {s.stage}</div>
                    <div className="text-[11px] font-medium">{s.shortLabel}</div>
                  </div>
                );
              })}
            </div>
            {gesri.compositeScore !== null ? (
              <p className="text-sm">
                Composite reading:{" "}
                <span className="gfew-mono font-semibold" style={{ color: scoreColor(gesri.compositeScore) }}>
                  {gesri.compositeScore}
                </span>{" "}
                <RegimePill regime={gesri.regime} />{" "}
                {gesri.hiddenRisk && <span className="ml-2 text-xs text-[#e0b93d]">Hidden Energy Risk: structural rising, market still calm</span>}
                {gesri.marketLedWarning && <span className="ml-2 text-xs text-[#e0793d]">Market-led warning: market deteriorating ahead of fundamentals</span>}
              </p>
            ) : (
              <p className="text-sm text-text-dim">Insufficient data for a composite reading yet.</p>
            )}
          </section>

          <section className="mb-8">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Domain Readings</h2>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel-raised text-text-dim">
                  <tr>
                    <th className="px-3 py-2 font-medium">Domain</th>
                    <th className="px-3 py-2 font-medium">Key Reading</th>
                    <th className="px-3 py-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Oil</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      Brent {fmt(gesri.oilReading.brent.value, "USD/bbl")}
                      <TrendIndicator value={gesri.oilReading.brent.value} previous={gesri.oilReading.brent.previousValue} />
                      {" · "}WTI {fmt(gesri.oilReading.wti.value, "USD/bbl")}
                      <TrendIndicator value={gesri.oilReading.wti.value} previous={gesri.oilReading.wti.previousValue} />
                      {" · "}OVX {fmt(gesri.oilReading.ovx.value, "", 1)}
                      <TrendIndicator value={gesri.oilReading.ovx.value} previous={gesri.oilReading.ovx.previousValue} />
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(gesri.oilScore) }}>
                      {gesri.oilScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Natural Gas</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      Henry Hub {fmt(gesri.gasReading.henryHub.value, "USD/MMBtu", 2)}
                      <TrendIndicator value={gesri.gasReading.henryHub.value} previous={gesri.gasReading.henryHub.previousValue} />
                      {" · "}US storage {fmt(gesri.gasReading.storage.value, "Bcf", 0)}
                      <TrendIndicator value={gesri.gasReading.storage.value} previous={gesri.gasReading.storage.previousValue} />
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(gesri.gasScore) }}>
                      {gesri.gasScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Critical Minerals / Nuclear Fuel</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      Copper {fmt(gesri.mineralsReading.copper.value, "USD/t", 0)}
                      <TrendIndicator value={gesri.mineralsReading.copper.value} previous={gesri.mineralsReading.copper.previousValue} />
                      {" · "}Uranium {fmt(gesri.mineralsReading.uranium.value, "USD/lb", 2)}
                      <TrendIndicator value={gesri.mineralsReading.uranium.value} previous={gesri.mineralsReading.uranium.previousValue} />
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(gesri.mineralsScore) }}>
                      {gesri.mineralsScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Shipping / Supply Chain</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      GSCPI {fmt(gesri.shippingReading.value, "std dev", 2)}
                      <TrendIndicator value={gesri.shippingReading.value} previous={gesri.shippingReading.previousValue} />
                      {" · "}blended 45% with Hormuz/Bab el-Mandeb/Suez/Malacca tanker-transit stress (below)
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(gesri.shippingScore) }}>
                      {gesri.shippingScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Market (Energy-Sector Equities)</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      XLE {fmt(gesri.marketReading.value, "USD", 2)}
                      <TrendIndicator value={gesri.marketReading.value} previous={gesri.marketReading.previousValue} />
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(gesri.marketScore) }}>
                      {gesri.marketScore ?? "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Chokepoint Monitor</h2>
            <p className="mb-3 max-w-3xl text-xs text-text-dim">
              Daily AIS-derived tanker-transit counts from IMF PortWatch — the real chokepoint
              throughput data spec &sect;15/&sect;43 call for, not a placeholder. A drop below a
              chokepoint&apos;s own trailing norm scores as risk.
            </p>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel-raised text-text-dim">
                  <tr>
                    <th className="px-3 py-2 font-medium">Chokepoint</th>
                    <th className="px-3 py-2 font-medium">Tanker Transits (latest day)</th>
                    <th className="px-3 py-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {gesri.chokepointReadings.map((c) => (
                    <tr key={c.slug} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-medium">{c.label}</td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">
                        {fmt(c.value, "vessels/day", 0)}
                        <TrendIndicator value={c.value} previous={c.previousValue} />
                        {c.asOf && <span className="ml-2 text-[10px] text-text-dim">as of {c.asOf}</span>}
                      </td>
                      <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(c.score) }}>
                        {c.score ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {countryBalance && countryBalance.some((r) => r.production !== null) && (
            <section className="mb-8">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Country Energy Balance (Oil)</h2>
              <p className="mb-3 max-w-3xl text-xs text-text-dim">
                Real country-level petroleum production and consumption from EIA API v2 (monthly, ~3-4
                month publication lag). Import Dependency = Net Imports / Consumption. Oil only — EIA&apos;s
                free international dataset does not carry natural gas or coal balances at this
                granularity.
              </p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel-raised text-text-dim">
                    <tr>
                      <th className="px-3 py-2 font-medium">Country</th>
                      <th className="px-3 py-2 font-medium">Production</th>
                      <th className="px-3 py-2 font-medium">Consumption</th>
                      <th className="px-3 py-2 font-medium">Net Imports</th>
                      <th className="px-3 py-2 font-medium">Import Dependency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countryBalance.map((r) => (
                      <tr key={r.slug} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-medium">{r.countryLabel}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.production, "kbpd", 0)}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.consumption, "kbpd", 0)}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.netImports, "kbpd", 0)}</td>
                        <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.importDependencyPct) }}>
                          {r.importDependencyPct !== null ? `${r.importDependencyPct}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {countryBalance[0]?.asOf && <p className="mt-2 text-[10px] text-text-dim">Latest reporting month: {countryBalance[0].asOf.slice(0, 7)}</p>}
            </section>
          )}

          {countryRenewables && countryRenewables.some((r) => r.renewableCapacityMw !== null) && (
            <section className="mb-8">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Renewable Energy Mix (IRENA)</h2>
              <p className="mb-3 max-w-3xl text-xs text-text-dim">
                Real electricity capacity and generation by country from IRENA IRENASTAT (free, no key).
                Capacity is published annually in March; generation is published annually in July with a
                longer lag — the two columns can legitimately show different &ldquo;as of&rdquo; years.
              </p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel-raised text-text-dim">
                    <tr>
                      <th className="px-3 py-2 font-medium">Country</th>
                      <th className="px-3 py-2 font-medium">Renewable Capacity</th>
                      <th className="px-3 py-2 font-medium">Capacity Share</th>
                      <th className="px-3 py-2 font-medium">Renewable Generation</th>
                      <th className="px-3 py-2 font-medium">Generation Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countryRenewables.map((r) => (
                      <tr key={r.slug} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-medium">{r.countryLabel}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.renewableCapacityMw, "MW", 0)}</td>
                        <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: renewableShareColor(r.renewableCapacitySharePct) }}>
                          {r.renewableCapacitySharePct !== null ? `${r.renewableCapacitySharePct}%` : "—"}
                        </td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.renewableGenerationGwh, "GWh", 0)}</td>
                        <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: renewableShareColor(r.renewableGenerationSharePct) }}>
                          {r.renewableGenerationSharePct !== null ? `${r.renewableGenerationSharePct}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-text-dim">
                Latest capacity year: {countryRenewables[0]?.capacityAsOf?.slice(0, 4) ?? "—"} · Latest
                generation year: {countryRenewables[0]?.generationAsOf?.slice(0, 4) ?? "—"}
              </p>
            </section>
          )}

          {tradeNetwork && tradeNetwork.edges.length > 0 && <TradeNetworkSection network={tradeNetwork} />}

          {gridSnapshots && gridSnapshots.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Grid Snapshots (US ISOs)</h2>
              <p className="mb-3 max-w-3xl text-xs text-text-dim">
                Live grid-operator data for the Electricity/Grid engine (spec &sect;23-25). Margin is
                generation minus load. ISO-NE, CAISO and NYISO come from each operator&apos;s own
                5-minute real-time feed; MISO, PJM, ERCOT and SPP come from EIA-930 (Form EIA-930
                Hourly Electric Grid Monitor) since each operator&apos;s own real-time API either has no
                free public data (ERCOT, PJM — both need their own registration for deeper access) or was
                confirmed deprecated with no free replacement during this build (MISO). EIA-930 is real
                official same-day data (1-3hr publication lag), not a proxy.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {gridSnapshots.map((g) => (
                  <div key={g.gridKey} className="gfew-panel p-3">
                    <div className="mb-2 text-xs font-semibold text-text">{g.gridLabel}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">Load</div>
                        <div className="gfew-mono text-base font-semibold">{fmt(g.loadMw, "MW", 0)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">Generation</div>
                        <div className="gfew-mono text-base font-semibold">{fmt(g.generationMw, "MW", 0)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">Margin</div>
                        <div className="gfew-mono text-base font-semibold">{fmt(g.marginMw, "MW", 0)}</div>
                      </div>
                    </div>
                    {g.asOf && <p className="mt-2 text-[10px] text-text-dim">As of {g.asOf}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mb-8">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Score Breakdown</h2>
            <p className="mb-3 max-w-3xl text-xs text-text-dim">
              Weights are fixed (Structural 40% / Market 35% / Convergence 25% of composite; Oil 35% /
              Natural Gas 25% / Critical Minerals 20% / Shipping 20% of Structural).
            </p>
            <div className="gfew-panel p-3">
              <ContributionBar
                total={gesri.compositeScore}
                segments={[
                  { label: "Structural", value: contribution(gesri.structuralScore, COMPOSITE_WEIGHTS.structural), color: "#3fa9f5" },
                  { label: "Market", value: contribution(gesri.marketScore, COMPOSITE_WEIGHTS.market), color: "#e0793d" },
                  { label: "Convergence", value: contribution(gesri.convergenceScore, COMPOSITE_WEIGHTS.convergence), color: "#e05a4d" },
                ]}
              />
              <div className="mt-3 pl-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                  Structural ({gesri.structuralScore ?? "—"}) breaks down as
                </div>
                <ContributionBar
                  total={null}
                  segments={[
                    { label: "Oil", value: contribution(gesri.oilScore, STRUCTURAL_WEIGHTS.oil), color: "#34c085" },
                    { label: "Natural Gas", value: contribution(gesri.gasScore, STRUCTURAL_WEIGHTS.gas), color: "#e0b93d" },
                    { label: "Minerals", value: contribution(gesri.mineralsScore, STRUCTURAL_WEIGHTS.minerals), color: "#8b96a8" },
                    { label: "Shipping", value: contribution(gesri.shippingScore, STRUCTURAL_WEIGHTS.shipping), color: "#3fa9f5" },
                  ]}
                />
              </div>
              <div className="mt-2 text-xs text-text-dim">
                Data completeness: {Math.round(gesri.dataCompleteness * 100)}%
              </div>
            </div>
          </section>

          {scenarioResults && (
            <section className="mb-8">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Scenario Library &amp; Policy Simulator</h2>
              <p className="mb-3 max-w-3xl text-xs text-text-dim">
                20 stress scenarios, each applying a fixed shock to today&apos;s live domain scores and
                recomputing the composite through the exact same weighting the engine above uses. Shock
                sizes are illustrative judgment calls loosely calibrated to the named historical
                analogue&apos;s rough direction and scale &mdash; not a statistical fit, not a probability
                estimate, and not a claim that this engine existed during the named event. Click a scenario
                for its full rationale.
              </p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel-raised text-text-dim">
                    <tr>
                      <th className="px-3 py-2 font-medium">Scenario</th>
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium">Composite (baseline &rarr; scenario)</th>
                      <th className="px-3 py-2 font-medium">Regime</th>
                      <th className="px-3 py-2 font-medium">Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioResults
                      .slice()
                      .sort((a, b) => (b.compositeScore ?? -Infinity) - (a.compositeScore ?? -Infinity))
                      .map((r) => (
                        <tr key={r.scenario.id} className={`border-t border-border align-top ${r.scenario.id === selectedScenarioId ? "bg-panel-raised" : ""}`}>
                          <td className="px-3 py-2 font-medium">
                            <a href={`?scenario=${r.scenario.id}#scenario-detail`} className="text-accent hover:underline">
                              {r.scenario.label}
                            </a>
                          </td>
                          <td className="px-3 py-2 text-text-dim">{r.scenario.category}</td>
                          <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(r.compositeScore) }}>
                            {gesri?.compositeScore ?? "—"} &rarr; {r.compositeScore ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <RegimePill regime={r.regime} />
                          </td>
                          <td className="px-3 py-2 text-text-dim">{r.stageLabel}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {selectedScenario && (
                <div id="scenario-detail" className="gfew-panel mt-4 scroll-mt-4 p-4">
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text">{selectedScenario.scenario.label}</h3>
                    <a href="#" className="text-xs text-accent hover:underline">
                      Clear
                    </a>
                  </div>
                  <p className="mb-2 text-xs text-text-dim">{selectedScenario.scenario.description}</p>
                  <p className="mb-3 text-[10px] italic text-text-dim">Historical analogue: {selectedScenario.scenario.historicalAnalogue}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {(
                      [
                        ["Oil", selectedScenario.baseline.oilScore, selectedScenario.shocked.oilScore],
                        ["Natural Gas", selectedScenario.baseline.gasScore, selectedScenario.shocked.gasScore],
                        ["Minerals", selectedScenario.baseline.mineralsScore, selectedScenario.shocked.mineralsScore],
                        ["Shipping", selectedScenario.baseline.shippingScore, selectedScenario.shocked.shippingScore],
                        ["Market", selectedScenario.baseline.marketScore, selectedScenario.shocked.marketScore],
                      ] as const
                    ).map(([label, before, after]) => (
                      <div key={label}>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">{label}</div>
                        <div className="gfew-mono text-sm font-semibold" style={{ color: scoreColor(after) }}>
                          {before ?? "—"} &rarr; {after ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-2 text-[10px] text-text-dim">{ENERGY_SCENARIOS.length} scenarios modeled against today&apos;s live baseline (composite {gesri?.compositeScore ?? "—"}).</p>
            </section>
          )}

          <section className="gfew-panel p-4 text-xs text-text-dim">
            <strong className="text-text">Phased build against the full spec:</strong> a real chokepoint-
            throughput system now runs live on IMF PortWatch AIS data, and country-level oil production/
            consumption plus US natural gas storage now run live on a registered EIA API v2 key (see the
            Country Energy Balance section below), and all seven major US grid operators (ISO-NE, CAISO,
            NYISO, MISO, PJM, ERCOT, SPP) now have live load/generation data — the last four via EIA-930
            since their own real-time APIs are either registration-gated or (MISO) confirmed deprecated.
            Renewable/non-renewable electricity capacity and generation by country now run live on IRENA
            IRENASTAT (see the Renewable Energy Mix section above), a 20-scenario stress-test library with
            a policy simulator now runs against the live composite (see Scenario Library above) —
            deterministic shocks applied through the real engine weighting, not a separate model — and a
            global energy trade network graph now runs on real bilateral UN Comtrade export values, with
            node centrality computed via Brandes&apos; algorithm, not a hand-picked score (see Global Energy
            Trade Network above). Still not built — checked against real free sources, disclosed rather
            than faked: deeper 5-minute-resolution PJM/ERCOT data (pending each operator&apos;s own
            registration approval), ENTSO-E European grid data (pending transparency@entsoe.eu access
            request), producer-level effective spare capacity, OPEC+ quota/compliance tracking, a genuine
            futures-curve/backwardation signal (needs a paid futures-chain feed), nuclear reactor-level
            outage tracking (IAEA PRIS has no public API), critical-mineral mining/refining concentration
            breakdowns, historical backtesting, and a daily report/AI Q&amp;A layer (deferred by request —
            no LLM API key configured). See the{" "}
            <a href="/dashboard/methodology#energy-systemic-risk" className="text-accent hover:underline">
              methodology page
            </a>{" "}
            for current phase status.
          </section>
        </>
      )}
    </div>
  );
}
