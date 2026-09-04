import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function TradePolicyPage() {
  const rows = await getLatestEngine("trade_economic_policy");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Trade / Economic Policy</h1>
      <EngineDetail title="Trade / Economic Policy" rows={rows} />
    </div>
  );
}
