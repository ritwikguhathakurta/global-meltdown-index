"use client";

import { useState, type ReactNode } from "react";

export type GeoTabId = "overview" | "military" | "sanctions" | "maritime" | "conflict" | "ask" | "historical" | "sources";

const TABS: { id: GeoTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "military", label: "Military" },
  { id: "sanctions", label: "Sanctions" },
  { id: "maritime", label: "Maritime & Chokepoints" },
  { id: "conflict", label: "Conflict" },
  { id: "ask", label: "Ask Geopolitics" },
  { id: "historical", label: "Historical Reference" },
  { id: "sources", label: "Sources & Limitations" },
];

export function GeopoliticalApp({ panels }: { panels: Record<GeoTabId, ReactNode> }) {
  const [tab, setTab] = useState<GeoTabId>("overview");
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
