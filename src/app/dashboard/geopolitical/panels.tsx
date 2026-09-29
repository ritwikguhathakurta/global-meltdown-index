import type { EngineRow } from "@/lib/api/types";
import { EngineDetail } from "@/components/EngineDetail";
import type { GeopoliticalPageData } from "@/lib/api/geopoliticalData";
import { Panel, SectionTitle, IndexCard, Table, Th, Td, fmtNum, fmtPct, fmtUsd, UnavailableNote } from "../derivatives/ui";

export function OverviewPanel({ data, engineRows }: { data: GeopoliticalPageData; engineRows: EngineRow[] }) {
  const { gewi, militaryBuildup, sanctionsIntensity, escalation, chokepointStress } = data.indices;
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>Registered GFMI Engine (Geopolitical Risk Index)</SectionTitle>
        <p className="mb-3 text-[11px] text-text-dim">
          The Caldara-Iacoviello Geopolitical Risk Index (GFMI weight 0.6) — automated text-search counts of geopolitical-risk coverage across 10 major newspapers, monthly since 1900. This is the composite contribution; the tabs below are a separate, page-level analytical layer that does not feed GFMI.
        </p>
        <EngineDetail title="Geopolitical" rows={engineRows} />
      </Panel>
      <Panel>
        <SectionTitle>Page-Level Composite Indices</SectionTitle>
        <div className="flex flex-wrap gap-3">
          <IndexCard label="Early Warning (GEWI)" level={gewi.level} change4w={gewi.change4w} quality={gewi.quality} methodology={gewi.methodology} />
          <IndexCard label="Military Buildup" level={militaryBuildup.level} change4w={militaryBuildup.change4w} quality={militaryBuildup.quality} methodology={militaryBuildup.methodology} />
          <IndexCard label="Sanctions Intensity" level={sanctionsIntensity.level} change4w={sanctionsIntensity.change4w} quality={sanctionsIntensity.quality} methodology={sanctionsIntensity.methodology} />
          <IndexCard label="Escalation Reading" level={escalation.level} change4w={escalation.change4w} quality={escalation.quality} methodology={escalation.methodology} />
          <IndexCard label="Maritime Chokepoint Stress" level={chokepointStress.level} change4w={chokepointStress.change4w} quality={chokepointStress.quality} methodology={chokepointStress.methodology} />
        </div>
      </Panel>
    </div>
  );
}

export function MilitaryPanel({ data }: { data: GeopoliticalPageData }) {
  const rows = [...data.militaryRows].sort((a, b) => (b.spendPctGdp ?? -1) - (a.spendPctGdp ?? -1));
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>Military Buildup Index</SectionTitle>
        <IndexCard label="Military Buildup" level={data.indices.militaryBuildup.level} change4w={data.indices.militaryBuildup.change4w} quality={data.indices.militaryBuildup.quality} methodology={data.indices.militaryBuildup.methodology} />
      </Panel>
      <Panel>
        <SectionTitle>Military Spending by Country</SectionTitle>
        <p className="mb-3 text-[11px] text-text-dim">SIPRI Military Expenditure Database (% of GDP, back to 1949) and World Bank (absolute USD). Both official, free, Tier 1.</p>
        <Table>
          <thead>
            <tr>
              <Th>Country</Th>
              <Th right>% of GDP</Th>
              <Th right>Spend (USD)</Th>
              <Th right>YoY Change</Th>
              <Th right>As of</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.countrySlug}>
                <Td>{r.countryLabel}</Td>
                <Td right mono>{fmtPct(r.spendPctGdp, 2)}</Td>
                <Td right mono>{fmtUsd(r.spendUsd)}</Td>
                <Td right mono>{r.spendUsdYoyPct === null ? "—" : `${r.spendUsdYoyPct >= 0 ? "+" : ""}${r.spendUsdYoyPct.toFixed(1)}%`}</Td>
                <Td right mono>{r.asOf ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}

export function SanctionsPanel({ data }: { data: GeopoliticalPageData }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>Sanctions Intensity Index</SectionTitle>
        <IndexCard label="Sanctions Intensity" level={data.indices.sanctionsIntensity.level} change4w={data.indices.sanctionsIntensity.change4w} quality={data.indices.sanctionsIntensity.quality} methodology={data.indices.sanctionsIntensity.methodology} />
      </Panel>
      <Panel>
        <SectionTitle>OFAC Specially Designated Nationals — Entities Listed by Program</SectionTitle>
        <p className="mb-3 text-[11px] text-text-dim">
          US Treasury OFAC SDN list, official, free, Tier 1 — real counts of currently-listed entities/individuals/vessels per sanctions program. A genuine count, not a fabricated severity score. Only OFAC (US) is used in this pass; broader multi-country sanctions coverage (EU/UN/UK via OpenSanctions) would need a paid commercial license for a product like this one — see Sources &amp; Limitations.
        </p>
        {data.indices.sanctionsIntensity.inputs.length === 0 ? (
          <UnavailableNote>No OFAC data available yet.</UnavailableNote>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Program</Th>
                <Th right>Entities Listed</Th>
                <Th>30-Day Change</Th>
                <Th right>As of</Th>
              </tr>
            </thead>
            <tbody>
              {data.indices.sanctionsIntensity.inputs.map((r) => (
                <tr key={r.key}>
                  <Td>{r.label}</Td>
                  <Td right mono>{fmtNum(r.value, 0)}</Td>
                  <Td>{r.methodology ?? "—"}</Td>
                  <Td right mono>{r.asOf ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

export function MaritimePanel({ data }: { data: GeopoliticalPageData }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>Maritime Chokepoint Stress</SectionTitle>
        <IndexCard label="Chokepoint Stress" level={data.indices.chokepointStress.level} change4w={data.indices.chokepointStress.change4w} quality={data.indices.chokepointStress.quality} methodology={data.indices.chokepointStress.methodology} />
      </Panel>
      <Panel>
        <SectionTitle>Daily Vessel Transits by Chokepoint</SectionTitle>
        <p className="mb-3 text-[11px] text-text-dim">IMF PortWatch — real, AIS-derived daily vessel transit counts, Tier 2. Reused from the same data already feeding the Energy engine&rsquo;s shipping/chokepoint domain, not re-ingested.</p>
        <Table>
          <thead>
            <tr>
              <Th>Chokepoint</Th>
              <Th right>Transits/Day</Th>
              <Th right>Z-Score (90d)</Th>
              <Th right>As of</Th>
            </tr>
          </thead>
          <tbody>
            {data.chokepointRows.map((r) => (
              <tr key={r.slug}>
                <Td>{r.label}</Td>
                <Td right mono>{fmtNum(r.transitsPerDay, 0)}</Td>
                <Td right mono>{fmtNum(r.transitsZ, 2)}</Td>
                <Td right mono>{r.asOf ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}

export function HistoricalPanel({ data }: { data: GeopoliticalPageData }) {
  return (
    <Panel>
      <SectionTitle>Historical Geopolitical Reference</SectionTitle>
      <p className="mb-3 text-[11px] text-text-dim">
        A factual reference table, NOT a scored backtest — no labeled ground-truth dataset exists to validate an early-warning model against, so no precision/recall/AUC claim is made anywhere on this page. Dates and mechanisms are well-documented public history.
      </p>
      <div className="flex flex-col gap-4">
        {data.historicalEvents.map((e) => (
          <div key={e.name} className="border-l-2 border-border pl-3">
            <p className="text-sm font-semibold text-text">
              {e.year} — {e.name}
            </p>
            <p className="mt-1 text-xs text-text-dim">{e.mechanism}</p>
            <p className="mt-1 text-[11px] text-text-dim">Relevant indices: {e.relevantIndices.join(", ")}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function SourcesPanel() {
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>Real Data (Tier 1/2, free, official)</SectionTitle>
        <ul className="list-disc space-y-1 pl-5 text-xs text-text-dim">
          <li>Caldara-Iacoviello Geopolitical Risk Index — GFMI-registered engine, Tier 2</li>
          <li>SIPRI Military Expenditure Database — % of GDP, back to 1949, Tier 1</li>
          <li>World Bank military expenditure (current USD) — Tier 1</li>
          <li>US Treasury OFAC Specially Designated Nationals list — Tier 1</li>
          <li>IMF PortWatch — 28 maritime chokepoints, AIS-derived daily transits, Tier 2 (reused from the Energy engine)</li>
          <li>GDELT Events Database — automated event-coding of global news, real but explicitly noisy/automated, Tier 2</li>
        </ul>
      </Panel>
      <Panel>
        <SectionTitle>Not Built (paid, gated, or contradicts this project&rsquo;s no-fabrication discipline)</SectionTitle>
        <ul className="list-disc space-y-1 pl-5 text-xs text-text-dim">
          <li>AIS/satellite vessel-level tracking (Kpler, Vortexa, Windward, MarineTraffic, Spire) — all paid</li>
          <li>Cyber-attribution feeds (Mandiant, CrowdStrike, Recorded Future) — paid</li>
          <li>ML-validated backtesting (precision/recall/AUC/Brier score) — no labeled ground truth exists; a factual Historical Reference table is shown instead</li>
          <li>A full country/actor/event relational graph database — this project uses one metric_series table for every time series; a bespoke graph schema is a materially bigger architectural change, not attempted here</li>
          <li>Alerting/push notifications and an auto-generated daily brief — no alerting infrastructure exists elsewhere in this app</li>
          <li>Sanctions-evasion/shadow-network detection — needs AIS data (paid)</li>
          <li>Scenario Monte Carlo with P5-P95 bands — no calibrated model exists to simulate from honestly</li>
        </ul>
      </Panel>
      <Panel>
        <SectionTitle>Needs a Decision or Registration (flagged, not silently skipped)</SectionTitle>
        <ul className="list-disc space-y-1 pl-5 text-xs text-text-dim">
          <li>UCDP conflict/battle-death data — real free API, needs a self-service access token</li>
          <li>ACLED political-violence data — needs a registered key; full EULA terms not yet confirmed to permit this kind of use</li>
          <li>OpenSanctions consolidated multi-country sanctions list — checked live and found to require a paid commercial license for a product like this one (its own site separates &ldquo;non-commercial use&rdquo; from &ldquo;data licensing / reseller-OEM&rdquo; for commercial products); not used</li>
          <li>WTO Timeseries API (tariffs) — confirmed to require a subscription key; free self-registration not confirmed this pass</li>
          <li>UN General Assembly voting data — no live free API found; the well-known academic dataset is a static historical file, not a live feed</li>
        </ul>
      </Panel>
    </div>
  );
}
