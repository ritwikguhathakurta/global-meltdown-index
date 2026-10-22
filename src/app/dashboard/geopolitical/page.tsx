import { getLatestEngine } from "@/lib/api/engineData";
import { getGeopoliticalPageData } from "@/lib/api/geopoliticalData";
import { GeopoliticalApp, type GeoTabId } from "./GeopoliticalApp";
import { OverviewPanel, MilitaryPanel, SanctionsPanel, MaritimePanel, ConflictPanel, HistoricalPanel, SourcesPanel } from "./panels";
import { AskGeopoliticsPanel } from "./AskGeopoliticsPanel";
import { UnavailableNote, Panel } from "../derivatives/ui";

export default async function GeopoliticalPage() {
  const [engineRows, data] = await Promise.all([getLatestEngine("geopolitical"), getGeopoliticalPageData()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Geopolitical</h1>
      <p className="mb-6 text-sm text-text-dim">
        Conflict, military, sanctions and maritime-chokepoint intelligence — built entirely from free/official sources, with every proxy clearly labeled REAL, MODEL ESTIMATE, or UNAVAILABLE.
      </p>

      {!data ? (
        <Panel>
          <UnavailableNote>No data yet, or the database is not configured. Run the pipeline from /admin or wait for the next scheduled run.</UnavailableNote>
        </Panel>
      ) : (
        <GeopoliticalApp
          panels={{
            overview: <OverviewPanel data={data} engineRows={engineRows} />,
            military: <MilitaryPanel data={data} />,
            sanctions: <SanctionsPanel data={data} />,
            maritime: <MaritimePanel data={data} />,
            conflict: <ConflictPanel data={data} />,
            ask: <AskGeopoliticsPanel />,
            historical: <HistoricalPanel data={data} />,
            sources: <SourcesPanel />,
          } satisfies Record<GeoTabId, React.ReactNode>}
        />
      )}
    </div>
  );
}
