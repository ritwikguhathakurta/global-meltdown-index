import { COMMODITIES } from "@/lib/commodities/taxonomy";
import { PredictionClient } from "./PredictionClient";

export default async function PredictionPage() {
  const commodities = COMMODITIES.map((c) => ({ slug: c.slug, label: c.label, category: c.category }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-text">Prediction</h1>
      <p className="mb-2 mt-2 max-w-3xl text-sm text-text-dim">
        Pick a commodity below. This calls OpenAI&apos;s Code Interpreter tool against that commodity&apos;s real
        price history — fetched live from this app&apos;s own database (ultimately World Bank Pink Sheet / IMF PCPS)
        — to compute trend, volatility, and a linear-regression extrapolation with real executed Python code, not a
        guess.
      </p>
      <p className="max-w-3xl text-xs text-text-dim/80">
        This is an AI-generated statistical projection, not a verified forecast or investment advice. The
        extrapolation is only as good as fitting a trend line through past prices — it does not know about future
        supply shocks, policy changes, or demand shifts. The exact code executed is shown alongside every result so
        you can check the math yourself.
      </p>
      <PredictionClient commodities={commodities} />
    </div>
  );
}
