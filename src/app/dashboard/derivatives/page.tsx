import { getLatestEngine } from "@/lib/api/engineData";
import { getDerivativesPageData } from "@/lib/api/derivativesData";
import { DerivativesApp, type DerivTabId } from "./DerivativesApp";
import { ScenarioPanel } from "./ScenarioPanel";
import { OverviewPanel, OtcPanel, PositioningPanel, IndiaPanel, RepoPanel, BanksPanel, CryptoPanel, VolatilityPanel, HistoricalPanel, SourcesPanel } from "./panels";
import { UnavailableNote, Panel } from "./ui";

export default async function DerivativesPage() {
  const [engineRows, data] = await Promise.all([getLatestEngine("derivatives_leverage"), getDerivativesPageData()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Derivatives / Leverage</h1>
      <p className="mb-6 text-sm text-text-dim">Institutional-grade derivatives, margin, collateral, positioning and systemic leverage intelligence — built entirely from free/official sources, with every proxy clearly labeled.</p>

      {!data ? (
        <Panel>
          <UnavailableNote>No data yet, or the database is not configured. Run the pipeline from /admin or wait for the next scheduled run.</UnavailableNote>
        </Panel>
      ) : (
        <DerivativesApp
          panels={{
            overview: <OverviewPanel data={data} engineRows={engineRows} />,
            otc: <OtcPanel data={data} />,
            positioning: <PositioningPanel data={data} />,
            india: <IndiaPanel data={data} />,
            repo: <RepoPanel data={data} />,
            banks: <BanksPanel data={data} />,
            crypto: <CryptoPanel data={data} />,
            volatility: <VolatilityPanel data={data} />,
            scenario: <ScenarioPanel current={{ msi: data.indices.msi, csi: data.indices.csi, pci: data.indices.pci }} />,
            historical: <HistoricalPanel data={data} />,
            sources: <SourcesPanel />,
          } satisfies Record<DerivTabId, React.ReactNode>}
        />
      )}
    </div>
  );
}
