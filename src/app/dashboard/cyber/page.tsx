import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function CyberPage() {
  const rows = await getLatestEngine("cyber_infrastructure");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Cyber / Financial Infrastructure</h1>
      <EngineDetail title="Cyber / Financial Infrastructure" rows={rows} />
    </div>
  );
}
