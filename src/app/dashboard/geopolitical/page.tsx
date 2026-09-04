import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function GeopoliticalPage() {
  const rows = await getLatestEngine("geopolitical");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Geopolitical</h1>
      <EngineDetail title="Geopolitical" rows={rows} />
    </div>
  );
}
