import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function SupplyChainsPage() {
  const rows = await getLatestEngine("supply_chains");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Supply Chains</h1>
      <EngineDetail title="Supply Chains" rows={rows} />
    </div>
  );
}
