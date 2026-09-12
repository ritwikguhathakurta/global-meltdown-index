import Link from "next/link";
import { getOilseedsHistory } from "@/lib/api/engineData";

function fmt(v: number): string {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SeriesTable({ label, unit, points }: { label: string; unit: string; points: { t: string; v: number }[] }) {
  const sorted = [...points].sort((a, b) => (a.t < b.t ? 1 : -1)); // newest first
  return (
    <details className="mb-4 rounded border border-border">
      <summary className="cursor-pointer bg-panel-raised px-3 py-2 text-sm font-medium">
        {label} <span className="text-text-dim">({unit}, {sorted.length} points)</span>
      </summary>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-panel-raised text-text-dim">
            <tr>
              <th className="px-3 py-1.5 font-medium">Date</th>
              <th className="px-3 py-1.5 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.t} className="border-t border-border">
                <td className="gfew-mono px-3 py-1 text-text-dim">{p.t.slice(0, 10)}</td>
                <td className="gfew-mono px-3 py-1">{fmt(p.v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default async function OilseedsHistoryPage() {
  const history = await getOilseedsHistory();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/dashboard/commodities/oilseeds" className="mb-4 inline-block text-xs text-accent hover:underline">
        ← Oilseeds
      </Link>
      <h1 className="mb-2 text-2xl font-semibold">Oilseeds — 10-Year History</h1>
      <p className="mb-8 max-w-2xl text-sm text-text-dim">
        Full point-in-time series for the last 10 years, real data only. Prices are monthly (World Bank Pink
        Sheet); balance-sheet figures are annual (USDA PSD). Click a row to expand.
      </p>

      {!history && <p className="text-sm text-text-dim">History is not yet available.</p>}

      {history && (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">Prices (monthly)</h2>
            {history.prices.map((s) => (
              <SeriesTable key={s.slug} label={s.label} unit={s.unit} points={s.points} />
            ))}
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">World Balance (annual)</h2>
            {history.balances.map((s) => (
              <SeriesTable key={`${s.slug}-${s.attribute}`} label={s.label} unit={s.unit} points={s.points} />
            ))}
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">Soybean Country Balances (annual)</h2>
            {history.countryBalances.map((s) => (
              <SeriesTable key={`${s.slug}-${s.attribute}`} label={s.label} unit="million MT" points={s.points} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
