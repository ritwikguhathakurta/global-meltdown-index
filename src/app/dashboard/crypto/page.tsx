import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function CryptoPage() {
  const rows = await getLatestEngine("crypto_stablecoins");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Crypto / Stablecoins</h1>
      <EngineDetail title="Crypto / Stablecoins" rows={rows} />
    </div>
  );
}
