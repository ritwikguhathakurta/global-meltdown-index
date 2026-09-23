import { EngineDetail } from "@/components/EngineDetail";
import type { EngineRow } from "@/lib/api/types";
import type { DerivativesPageData } from "@/lib/api/derivativesData";
import { Panel, SectionTitle, IndexCard, Table, Th, Td, fmtNum, fmtUsd, fmtPct, UnavailableNote, QualityBadge } from "./ui";

export function OverviewPanel({ data, engineRows }: { data: DerivativesPageData; engineRows: EngineRow[] }) {
  const { indices, regime } = data;
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>Global Leverage Regime</SectionTitle>
        <p className="gfew-mono text-lg">{regime.replace(/_/g, " ")}</p>
        <p className="mt-1 text-[11px] text-text-dim">
          A single regime label combining GLI&rsquo;s leverage level with how far the Margin/Collateral Stress proxies sit above or below neutral — not a flat average (spec §148/§121). See Sources &amp; Limitations for what each index is and isn&rsquo;t.
        </p>
      </Panel>
      <div className="flex flex-wrap gap-3">
        <IndexCard label="Global Leverage (GLI)" level={indices.gli.level} change4w={indices.gli.change4w} quality={indices.gli.quality} methodology={indices.gli.methodology} />
        <IndexCard label="Cross-Asset Contagion (CALCI)" level={indices.calci.level} change4w={indices.calci.change4w} quality={indices.calci.quality} methodology={indices.calci.methodology} />
        <IndexCard label="Positioning Crowding (PCI)" level={indices.pci.level} change4w={indices.pci.change4w} quality={indices.pci.quality} methodology={indices.pci.methodology} />
        <IndexCard label="Margin Stress (MSI)" level={indices.msi.level} change4w={indices.msi.change4w} quality={indices.msi.quality} methodology={indices.msi.methodology} />
        <IndexCard label="Collateral Stress (CSI)" level={indices.csi.level} change4w={indices.csi.change4w} quality={indices.csi.quality} methodology={indices.csi.methodology} />
        <IndexCard label="Counterparty Risk (CRI)" level={indices.cri.level} change4w={indices.cri.change4w} quality={indices.cri.quality} methodology={indices.cri.methodology} />
        <IndexCard label="Forced Deleveraging (FDR)" level={indices.fdr.level} change4w={indices.fdr.change4w} quality={indices.fdr.quality} methodology={indices.fdr.methodology} />
        <IndexCard label="Derivatives Liquidity Stress (DLS)" level={indices.dls.level} change4w={indices.dls.change4w} quality={indices.dls.quality} methodology={indices.dls.methodology} />
      </div>
      <Panel>
        <SectionTitle>GFMI-Registered Engine: Derivatives / Leverage</SectionTitle>
        <p className="mb-3 text-[11px] text-text-dim">
          This is the one engine that feeds the site-wide GFMI composite score (weight 0.7 of 24 engines) — a real CFTC-COT-based positioning proxy across 6 markets, unrelated to the page-level indices above.
        </p>
        <EngineDetail title="Derivatives / Leverage" rows={engineRows} />
      </Panel>
    </div>
  );
}

export function OtcPanel({ data }: { data: DerivativesPageData }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>BIS OTC Derivatives Notional Outstanding, by Risk Category</SectionTitle>
        <p className="mb-3 text-[11px] text-text-dim">
          Semiannual, worldwide, net-net reporting basis — the same cross-cut BIS itself headlines. <QualityBadge quality="REAL" />
        </p>
        <Table>
          <thead>
            <tr>
              <Th>Risk category</Th>
              <Th right>Notional outstanding</Th>
              <Th>As of</Th>
            </tr>
          </thead>
          <tbody>
            {data.bisOtc.map((r) => (
              <tr key={r.key}>
                <Td>{r.label}</Td>
                <Td right mono>{fmtUsd(r.notionalUsd)}</Td>
                <Td mono className="text-text-dim">{r.asOf ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <Panel>
        <SectionTitle>Exchange-Traded Derivatives</SectionTitle>
        <UnavailableNote>
          BIS’s exchange-traded derivatives dataflow (WS_XTD_DERIV) reports turnover/open interest per-currency and per-exchange with no published worldwide total — a global figure would require summing across ~20 currencies and 7 exchange groups, which was deferred rather than built as an unverified derived aggregate. See Sources &amp; Limitations.
        </UnavailableNote>
      </Panel>
      <Panel>
        <SectionTitle>Gross Market Value</SectionTitle>
        <UnavailableNote>
          BIS’s OTC dataflow does not publish gross positive market value aggregated to &quot;all instruments&quot; the way notional is — confirmed live, checked across full history back to 2015. Only broken down by individual instrument, which was not summed here to avoid a derived aggregate BIS itself doesn’t publish.
        </UnavailableNote>
      </Panel>
    </div>
  );
}

export function PositioningPanel({ data }: { data: DerivativesPageData }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>CFTC Positioning by Market &amp; Participant Category</SectionTitle>
        <p className="mb-3 text-[11px] text-text-dim">
          Real Legacy, Disaggregated and Traders-in-Financial-Futures COT data. &quot;Crowded&quot; = |z-score of net %OI| ≥ 2.0 over the trailing 2 years. <QualityBadge quality="REAL" />
        </p>
        <Table>
          <thead>
            <tr>
              <Th>Market</Th>
              <Th>Participant category</Th>
              <Th right>Net % of OI</Th>
              <Th right>Z-score</Th>
              <Th>Crowded?</Th>
              <Th>As of</Th>
            </tr>
          </thead>
          <tbody>
            {data.positioningRows.map((r) => (
              <tr key={`${r.market}-${r.category}`}>
                <Td>{r.market}</Td>
                <Td>{r.category}</Td>
                <Td right mono>{fmtPct(r.netPctOi)}</Td>
                <Td right mono>{r.extremityZ === null ? "—" : r.extremityZ.toFixed(2)}</Td>
                <Td>{r.crowded ? <span className="text-[#e0b93d]">YES</span> : r.extremityZ === null ? "—" : "no"}</Td>
                <Td mono className="text-text-dim">{r.asOf ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <Panel>
        <SectionTitle>Not tracked</SectionTitle>
        <UnavailableNote>
          Dealer gamma, options open interest by strike, and margin debt (spec §30-32, §67, §98-100) have no free source globally or for India — confirmed live during planning. Only real futures positioning is shown above.
        </UnavailableNote>
      </Panel>
    </div>
  );
}

export function RepoPanel({ data }: { data: DerivativesPageData }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>NY Fed Repo &amp; Reference Rates</SectionTitle>
        <p className="mb-3 text-[11px] text-text-dim">Free, no-key NY Fed Markets Data API. <QualityBadge quality="REAL" /></p>
        <Table>
          <thead>
            <tr>
              <Th>Rate</Th>
              <Th right>Rate</Th>
              <Th right>99th–1st percentile dispersion</Th>
              <Th right>Volume</Th>
              <Th>As of</Th>
            </tr>
          </thead>
          <tbody>
            {data.repo.map((r) => (
              <tr key={r.key}>
                <Td>{r.label}</Td>
                <Td right mono>{fmtPct(r.rate)}</Td>
                <Td right mono>{r.dispersion === null ? "—" : `${r.dispersion.toFixed(2)}pp`}</Td>
                <Td right mono>{r.volumeBn === null ? "—" : `$${fmtNum(r.volumeBn, 0)}bn`}</Td>
                <Td mono className="text-text-dim">{r.asOf ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}

export function BanksPanel({ data }: { data: DerivativesPageData }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>Bank &amp; Dealer Leverage</SectionTitle>
        <p className="mb-3 text-[11px] text-text-dim">
          Leverage ratio from FDIC BankFind (insured-subsidiary level); derivative notional/assets/liabilities from SEC EDGAR XBRL facts (holding-company level, where each bank tags them — not every bank does).
        </p>
        <Table>
          <thead>
            <tr>
              <Th>Bank</Th>
              <Th right>Leverage ratio</Th>
              <Th right>Derivative notional</Th>
              <Th right>Derivative assets</Th>
              <Th right>Derivative liabilities</Th>
            </tr>
          </thead>
          <tbody>
            {data.bankLeverage.map((b) => (
              <tr key={b.key}>
                <Td>{b.name}</Td>
                <Td right mono>{fmtPct(b.leverageRatio)}</Td>
                <Td right mono>{b.derivativeNotional === null ? <QualityBadge quality="UNAVAILABLE" /> : fmtUsd(b.derivativeNotional)}</Td>
                <Td right mono>{b.derivativeAssets === null ? <QualityBadge quality="UNAVAILABLE" /> : fmtUsd(b.derivativeAssets)}</Td>
                <Td right mono>{b.derivativeLiabilities === null ? <QualityBadge quality="UNAVAILABLE" /> : fmtUsd(b.derivativeLiabilities)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}

export function CryptoPanel({ data }: { data: DerivativesPageData }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>Crypto Perpetual Futures</SectionTitle>
        <p className="mb-3 text-[11px] text-text-dim">
          Binance Futures public API — a single commercial exchange, not a regulator or cross-exchange aggregate. <QualityBadge quality="UNAVAILABLE" /> is shown elsewhere for a reason; this data is real but Tier 3.
        </p>
        <Table>
          <thead>
            <tr>
              <Th>Symbol</Th>
              <Th right>Funding rate (8h)</Th>
              <Th right>Open interest</Th>
              <Th>As of</Th>
            </tr>
          </thead>
          <tbody>
            {data.crypto.map((c) => (
              <tr key={c.symbol}>
                <Td>{c.symbol} perpetual</Td>
                <Td right mono>{c.fundingRate === null ? "—" : `${(c.fundingRate * 100).toFixed(4)}%`}</Td>
                <Td right mono>{fmtNum(c.openInterest, 0)} contracts</Td>
                <Td mono className="text-text-dim">{c.asOf ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}

export function VolatilityPanel({ data }: { data: DerivativesPageData }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <IndexCard label="VIX (Equity Vol)" level={data.vix.value} change4w={null} quality={data.vix.value !== null ? "REAL" : "UNAVAILABLE"} methodology={`As of ${data.vix.asOf ?? "—"}`} />
        <IndexCard label="MOVE (Rates Vol)" level={data.move.value} change4w={null} quality={data.move.value !== null ? "REAL" : "UNAVAILABLE"} methodology={`As of ${data.move.asOf ?? "—"}`} />
      </div>
      <Panel>
        <SectionTitle>Not tracked</SectionTitle>
        <UnavailableNote>
          Options-implied volatility term structure, skew, risk reversals, and dealer gamma exposure (spec §20, §30-32) require live options-chain data with no free source. VIX and MOVE are the two implied-volatility indices this project can source for free.
        </UnavailableNote>
      </Panel>
    </div>
  );
}

export function HistoricalPanel({ data }: { data: DerivativesPageData }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>Historical Leverage-Crisis Reference</SectionTitle>
        <p className="mb-3 text-[11px] text-text-dim">
          A factual reference table, not a scored backtest — no labeled point-in-time historical dataset exists to validate precision/recall/AUC against (spec §135-137 asks for this; building it would mean fabricating the validation, not the indicator).
        </p>
        <div className="flex flex-col gap-4">
          {data.historicalCrises.map((c) => (
            <div key={c.name} className="rounded border border-border p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="gfew-mono text-xs text-text-dim">{c.year}</span>
                <span className="text-sm font-semibold">{c.name}</span>
              </div>
              <p className="mb-2 text-xs text-text-dim">{c.mechanism}</p>
              <p className="text-[11px] text-text-dim">
                <b>Indices that would plausibly have reacted:</b> {c.relevantIndices.join("; ")}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function SourcesPanel() {
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>Connected sources</SectionTitle>
        <ul className="list-inside list-disc text-sm text-text-dim">
          <li>BIS OTC derivatives statistics (notional by risk category) — Tier 1</li>
          <li>CFTC Legacy, Disaggregated and Traders-in-Financial-Futures COT reports — Tier 1</li>
          <li>NY Fed Markets Data (SOFR/TGCR/BGCR, percentile dispersion, volume) — Tier 1</li>
          <li>FDIC BankFind (bank leverage ratios) — Tier 1</li>
          <li>SEC EDGAR XBRL (bank derivative notional/assets/liabilities, where tagged) — Tier 1</li>
          <li>Yahoo Finance (VIX, MOVE index) — Tier 3</li>
          <li>Binance Futures public API (crypto perpetual funding/OI) — Tier 3</li>
        </ul>
      </Panel>
      <Panel>
        <SectionTitle>Unavailable / not built, and why</SectionTitle>
        <ul className="list-inside list-disc text-sm text-text-dim">
          <li>DTCC Global Trade Repository / Trade Information Warehouse — granular data requires reporting-party or paid access</li>
          <li>ISDA SwapsInfo / Margin Survey — no verified free public data endpoint found</li>
          <li>WFE, FIA volumes — subscription/member services, no free API</li>
          <li>Live options chains, Greeks, dealer gamma, gamma walls, max pain, vanna/charm — no free source exists anywhere, global or India</li>
          <li>NSE/BSE/MCX/NCDEX/SEBI/CCIL India exchange data — no verified feasible free connector found in this phase</li>
          <li>13F/N-PORT/Form PF position-level detail; CCP-level (CME/ICE/LCH/Eurex) margin/default-fund data — no free granular source</li>
          <li>BIS exchange-traded derivatives global total — published per-currency/per-exchange only, no worldwide aggregate</li>
          <li>BIS OTC gross market value at the &quot;all instruments&quot; cross-cut — confirmed not published by BIS at any period</li>
          <li>OCC Quarterly Report on Bank Derivatives Activities — page reachable but data-table format not yet verified as machine-readable</li>
          <li>ML models and precision/recall/AUC-validated backtesting — no labeled ground-truth dataset exists to validate against honestly</li>
          <li>An LLM-powered &quot;Ask Derivatives&quot; — deliberately not added; this project already discloses exactly two LLM-computed surfaces and a third needs an explicit decision, not a quiet addition</li>
        </ul>
      </Panel>
      <Panel>
        <SectionTitle>MODEL ESTIMATE indices, explained</SectionTitle>
        <p className="text-sm text-text-dim">
          MSI, CSI, FDR, DLS and CALCI carry a <QualityBadge quality="MODEL_ESTIMATE" /> badge because no free source publishes real margin calls, collateral haircuts, or forced-selling flows. Each is built from real proxies only (VIX/MOVE, SOFR percentile dispersion, positioning crowding) with its exact formula shown on hover/under each card — never presented as if it were a measured quantity. GLI, PCI and CRI’s bank/credit-spread inputs are real observations combined into a genuine index, not standing in for something unobservable.
        </p>
      </Panel>
    </div>
  );
}
