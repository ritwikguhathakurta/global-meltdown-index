import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function BankingPage() {
  const rows = await getLatestEngine("banking");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Banking</h1>
      <EngineDetail title="Banking" rows={rows} />
    </div>
  );
}
