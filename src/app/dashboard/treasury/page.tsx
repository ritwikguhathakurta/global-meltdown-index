import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function TreasuryPage() {
  const rows = await getLatestEngine("us_treasury_sovereign");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Treasury & Sovereign Debt (G7 + China)</h1>
      <EngineDetail title="Treasury & Sovereign Debt (G7 + China)" rows={rows} />
    </div>
  );
}
