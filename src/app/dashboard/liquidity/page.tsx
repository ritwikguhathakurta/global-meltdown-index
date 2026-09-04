import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function LiquidityPage() {
  const rows = await getLatestEngine("global_liquidity");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Global Dollar Liquidity</h1>
      <EngineDetail title="Global Dollar Liquidity" rows={rows} />
    </div>
  );
}
