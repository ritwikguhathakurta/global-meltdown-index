import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function CreditPage() {
  const rows = await getLatestEngine("credit");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Credit Markets</h1>
      <EngineDetail title="Credit Markets" rows={rows} />
    </div>
  );
}
