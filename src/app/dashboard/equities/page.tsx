import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function EquitiesPage() {
  const rows = await getLatestEngine("equity_fragility");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Equity Fragility</h1>
      <EngineDetail title="Equity Fragility" rows={rows} />
    </div>
  );
}
