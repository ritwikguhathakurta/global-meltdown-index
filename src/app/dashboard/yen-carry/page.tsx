import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function YenCarryPage() {
  const rows = await getLatestEngine("yen_carry");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Yen Carry Stress</h1>
      <EngineDetail title="Yen Carry Stress" rows={rows} />
    </div>
  );
}
