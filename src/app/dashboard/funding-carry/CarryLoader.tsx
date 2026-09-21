"use client";

import dynamic from "next/dynamic";
import type { LiveSnapshot } from "@/lib/carry/marketData";

// Quotes live in the browser (localStorage), so the interactive app is client-only.
const CarryApp = dynamic(() => import("./CarryApp"), {
  ssr: false,
  loading: () => <div className="gfew-panel p-6 text-sm text-text-dim">Loading the funding engine…</div>,
});

export default function CarryLoader({ live }: { live: LiveSnapshot | null }) {
  return <CarryApp live={live} />;
}
