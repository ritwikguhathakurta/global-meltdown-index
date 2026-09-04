import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function ChinaPage() {
  const rows = await getLatestEngine("china");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">China</h1>
      <EngineDetail title="China" rows={rows} />
    </div>
  );
}
