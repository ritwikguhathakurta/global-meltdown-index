"use client";

import { useMemo, useState } from "react";

type CommodityOption = { slug: string; label: string; category: string };

type AnalyzeResponse = {
  commodity: { slug: string; label: string; unit: string; category: string };
  dataPoints: number;
  dataRange: { from: string; to: string };
  annualYearsUsed: number;
  covariatesUsed: string[];
  covariatesDropped: { label: string; reason: string }[];
  analysisText: string;
  codeExecuted: string[];
};

type AnalyzeError = { error: string; message?: string };

export function PredictionClient({ commodities }: { commodities: CommodityOption[] }) {
  const [slug, setSlug] = useState(commodities[0]?.slug ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<{ title: string; detail: string; isQuota: boolean } | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, CommodityOption[]>();
    for (const c of commodities) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return Array.from(map.entries());
  }, [commodities]);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/prediction/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const body = await res.json();
      if (!res.ok) {
        const b = body as AnalyzeError;
        if (res.status === 402 || b.error === "openai_quota_exceeded") {
          setError({
            title: "OpenAI account has no usable credits",
            detail:
              b.message ||
              "Add a payment method or purchase credits at platform.openai.com/settings/organization/billing, then try again.",
            isQuota: true,
          });
        } else {
          setError({ title: "Analysis failed", detail: b.message || b.error || `HTTP ${res.status}`, isQuota: false });
        }
        return;
      }
      setResult(body as AnalyzeResponse);
    } catch (e) {
      setError({ title: "Request failed", detail: (e as Error).message, isQuota: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="gfew-panel flex flex-wrap items-center gap-3 p-4">
        <label className="text-sm text-text-dim" htmlFor="commodity-select">
          Commodity
        </label>
        <select
          id="commodity-select"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="rounded border border-border bg-panel-raised px-2 py-1.5 text-sm text-text"
        >
          {grouped.map(([category, opts]) => (
            <optgroup key={category} label={category}>
              {opts.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          onClick={runAnalysis}
          disabled={loading || !slug}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-[#061018] hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Running…" : "Run AI Analysis"}
        </button>
      </div>

      {error && (
        <div className="gfew-panel border-l-4 border-l-[#e05a4d] p-4">
          <p className="text-sm font-semibold text-text">{error.title}</p>
          <p className="mt-1 text-sm text-text-dim">{error.detail}</p>
          {error.isQuota && (
            <a
              href="https://platform.openai.com/settings/organization/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-accent hover:underline"
            >
              Open OpenAI billing settings →
            </a>
          )}
        </div>
      )}

      {result && (
        <div className="gfew-panel space-y-4 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-text">{result.commodity.label}</h2>
            <span className="text-xs text-text-dim">
              {result.dataPoints} real observations · {result.dataRange.from.slice(0, 10)} to{" "}
              {result.dataRange.to.slice(0, 10)} · {result.annualYearsUsed} annual data points used in the model
            </span>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {result.covariatesUsed.length > 0 ? (
              result.covariatesUsed.map((c) => (
                <span key={c} className="rounded bg-panel-raised px-2 py-1 text-[#34c085]">
                  ✓ {c}
                </span>
              ))
            ) : (
              <span className="rounded bg-panel-raised px-2 py-1 text-text-dim">
                No real covariate had enough overlapping history — price history only
              </span>
            )}
            {result.covariatesDropped.map((d) => (
              <span key={d.label} className="rounded bg-panel-raised px-2 py-1 text-text-dim" title={d.reason}>
                ✕ {d.label}
              </span>
            ))}
          </div>

          <p className="whitespace-pre-wrap text-sm text-text">{result.analysisText}</p>
          {result.codeExecuted.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-text-dim hover:text-text">
                Show the Python code OpenAI actually executed against this data
              </summary>
              <pre className="gfew-mono mt-2 overflow-x-auto rounded bg-panel-raised p-3 text-[11px] text-text-dim">
                {result.codeExecuted.join("\n\n# ---\n\n")}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
