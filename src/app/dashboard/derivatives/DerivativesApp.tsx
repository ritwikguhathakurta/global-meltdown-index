"use client";

import { useState, type ReactNode } from "react";

export type DerivTabId = "overview" | "otc" | "positioning" | "india" | "repo" | "banks" | "crypto" | "volatility" | "scenario" | "historical" | "sources";

const TABS: { id: DerivTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "otc", label: "OTC & Exchange" },
  { id: "positioning", label: "Positioning" },
  { id: "india", label: "India F&O" },
  { id: "repo", label: "Repo & Funding" },
  { id: "banks", label: "Bank & Dealer Leverage" },
  { id: "crypto", label: "Crypto Derivatives" },
  { id: "volatility", label: "Volatility & Basis" },
  { id: "scenario", label: "Scenario / Stress Test" },
  { id: "historical", label: "Historical Reference" },
  { id: "sources", label: "Sources & Limitations" },
];

export function DerivativesApp({ panels }: { panels: Record<DerivTabId, ReactNode> }) {
  const [tab, setTab] = useState<DerivTabId>("overview");
  return (
    <div>
      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${tab === t.id ? "bg-accent text-[#061018]" : "text-text-dim hover:bg-panel-raised hover:text-text"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {panels[tab]}
    </div>
  );
}
