"use client";

import { useMemo, useState } from "react";
import type { TickerQuote } from "@/lib/sources/yahooLiveQuote";

// Status pair already established across this app (pctColor/DIRECTION_COLORS
// in the Commodities pages) — reused here rather than inventing new colors,
// and checked for WCAG contrast against this app's panel surface (#10151d):
// green 7.9:1, red 5.0:1, both well clear of the 4.5:1 text / 3:1 UI floors.
const UP_COLOR = "#34c085";
const DOWN_COLOR = "#e05a4d";
const MUTED = "#5a6472";

function fmtPrice(v: number | null): string {
  if (v === null) return "—";
  const decimals = v >= 100 ? 2 : v >= 1 ? 4 : 6;
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function Candlesticks({ candles }: { candles: TickerQuote["candles"] }) {
  const width = 720;
  const height = 260;
  const padding = { top: 10, right: 10, bottom: 20, left: 50 };

  if (candles.length === 0) {
    return <p className="text-xs text-text-dim">No chart data available.</p>;
  }

  const lows = candles.map((c) => c.l);
  const highs = candles.map((c) => c.h);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const yRange = max - min || 1;

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const slot = innerWidth / candles.length;
  const bodyWidth = Math.max(2, Math.min(8, slot * 0.6));

  function y(v: number): number {
    return padding.top + innerHeight * (1 - (v - min) / yRange);
  }

  const yTicks = [min, min + yRange / 2, max];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Candlestick price chart">
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={padding.left} x2={width - padding.right} y1={y(v)} y2={y(v)} stroke="#1e2733" strokeWidth={1} />
          <text x={padding.left - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill={MUTED}>
            {fmtPrice(v)}
          </text>
        </g>
      ))}
      {candles.map((c, i) => {
        const cx = padding.left + slot * i + slot / 2;
        const up = c.c >= c.o;
        const color = up ? UP_COLOR : DOWN_COLOR;
        const bodyTop = y(Math.max(c.o, c.c));
        const bodyBottom = y(Math.min(c.o, c.c));
        const bodyHeight = Math.max(1, bodyBottom - bodyTop);
        return (
          <g key={c.t}>
            <title>
              {new Date(c.t).toLocaleDateString()} — O {fmtPrice(c.o)} H {fmtPrice(c.h)} L {fmtPrice(c.l)} C {fmtPrice(c.c)}
            </title>
            <line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth={1.25} />
            <rect x={cx - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} rx={1} />
          </g>
        );
      })}
    </svg>
  );
}

export function TerminalClient({ initialQuotes }: { initialQuotes: TickerQuote[] }) {
  const [quotes, setQuotes] = useState<TickerQuote[]>(initialQuotes);
  const [selected, setSelected] = useState<string>(initialQuotes[0]?.symbol ?? "");
  const [customSymbol, setCustomSymbol] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const selectedQuote = useMemo(() => quotes.find((q) => q.symbol === selected) ?? null, [quotes, selected]);

  async function addCustomSymbol() {
    const symbol = customSymbol.trim().toUpperCase();
    if (!symbol) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/terminal/quote?symbol=${encodeURIComponent(symbol)}`);
      const body = await res.json();
      if (!res.ok) {
        setAddError(body.error || `HTTP ${res.status}`);
        return;
      }
      setQuotes((prev) => [...prev.filter((q) => q.symbol !== body.symbol), body as TickerQuote]);
      setSelected(body.symbol);
      setCustomSymbol("");
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="gfew-panel p-4 lg:col-span-1">
        <div className="mb-3 flex gap-2">
          <input
            value={customSymbol}
            onChange={(e) => setCustomSymbol(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomSymbol()}
            placeholder="Add symbol (e.g. TSLA, SOL-USD)"
            className="w-full rounded border border-border bg-panel-raised px-2 py-1.5 text-xs text-text"
          />
          <button
            onClick={addCustomSymbol}
            disabled={adding || !customSymbol.trim()}
            className="shrink-0 rounded bg-accent px-3 py-1.5 text-xs font-medium text-[#061018] hover:opacity-90 disabled:opacity-50"
          >
            {adding ? "…" : "Add"}
          </button>
        </div>
        {addError && <p className="mb-2 text-[11px] text-[#e05a4d]">{addError}</p>}

        <table className="w-full text-xs">
          <thead className="text-text-dim">
            <tr className="text-left">
              <th className="pb-1.5 font-normal">Symbol</th>
              <th className="pb-1.5 font-normal text-right">Last</th>
              <th className="pb-1.5 font-normal text-right">Chg %</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr
                key={q.symbol}
                onClick={() => setSelected(q.symbol)}
                className={`cursor-pointer border-t border-border align-top ${q.symbol === selected ? "bg-panel-raised" : ""}`}
              >
                <td className="py-1.5">
                  <div className="text-text">{q.symbol}</div>
                  <div className="text-[10px] text-text-dim">
                    {q.label} · {q.assetClass}
                  </div>
                </td>
                <td className="py-1.5 text-right text-text">{q.error ? "—" : fmtPrice(q.lastPrice)}</td>
                <td
                  className="py-1.5 text-right"
                  style={{ color: q.changePct === null ? MUTED : q.changePct >= 0 ? UP_COLOR : DOWN_COLOR }}
                >
                  {q.error ? "n/a" : fmtPct(q.changePct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="gfew-panel p-4 lg:col-span-2">
        {selectedQuote ? (
          <>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-text">
                {selectedQuote.label} ({selectedQuote.symbol})
              </h2>
              {selectedQuote.error ? (
                <span className="text-xs text-text-dim">Temporarily unavailable ({selectedQuote.error})</span>
              ) : (
                <span className="text-xs text-text-dim">
                  {fmtPrice(selectedQuote.lastPrice)}{" "}
                  <span style={{ color: (selectedQuote.changePct ?? 0) >= 0 ? UP_COLOR : DOWN_COLOR }}>
                    {fmtPct(selectedQuote.changePct)}
                  </span>
                </span>
              )}
            </div>
            <Candlesticks candles={selectedQuote.candles} />
          </>
        ) : (
          <p className="text-xs text-text-dim">Select a symbol from the watchlist.</p>
        )}
      </div>
    </div>
  );
}
