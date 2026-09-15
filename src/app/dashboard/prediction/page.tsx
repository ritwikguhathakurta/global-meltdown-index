import { COMMODITIES } from "@/lib/commodities/taxonomy";
import { PredictionClient } from "./PredictionClient";

export default async function PredictionPage() {
  const commodities = COMMODITIES.map((c) => ({ slug: c.slug, label: c.label, category: c.category }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-text">Prediction</h1>
      <p className="mb-2 mt-2 max-w-3xl text-sm text-text-dim">
        Pick a commodity below. This joins its real annual price history with whatever real fundamentals this app
        already tracks for it — USDA world production/consumption/stocks, EIA world energy balances, FAOSTAT world
        production, or the Fed&apos;s Broad Dollar Index — and asks OpenAI&apos;s Code Interpreter to fit a real
        regression model in executed Python and validate it with a genuine held-out backtest.
      </p>
      <p className="max-w-3xl text-xs text-text-dim/80">
        The reported accuracy is always the backtested, out-of-sample result — never an in-sample fit, which can
        look impressively high while predicting nothing. A covariate is only used if it has at least 15 real years of
        overlapping history with the commodity&apos;s own price series; otherwise the model falls back to price
        history alone, and says so. This is an illustrative statistical exercise, not a verified forecast or
        investment advice — the exact code executed is shown alongside every result so you can check the math
        yourself.
      </p>
      <PredictionClient commodities={commodities} />
    </div>
  );
}
