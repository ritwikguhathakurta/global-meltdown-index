import { DEFAULT_WATCHLIST, fetchTickerQuote } from "@/lib/sources/yahooLiveQuote";
import { TerminalClient } from "./TerminalClient";

// Real network calls to Yahoo Finance per watchlist ticker — never prerender
// this at build time, only per-request on the deployed server.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export default async function TerminalPage() {
  const quotes = await Promise.all(DEFAULT_WATCHLIST.map(fetchTickerQuote));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-text">Terminal</h1>
        <a
          href="https://stocksharp.com/en/products/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded bg-accent px-4 py-2 text-sm font-medium text-[#061018] hover:opacity-90"
        >
          Download StockSharp Terminal (live trading) ↗
        </a>
      </div>
      <p className="mb-2 max-w-3xl text-sm text-text-dim">
        A read-only watchlist with real daily prices and a candlestick chart per ticker, via Yahoo Finance (delayed
        for most exchanges, typically ~15 minutes). Green candles closed higher than they opened; red closed lower.
      </p>
      <p className="mb-6 max-w-3xl text-xs text-text-dim/80">
        This tab is display-only — no broker connection, no order placement, no account credentials of any kind.
        For actual live order execution across real brokers/exchanges, StockSharp&apos;s own free Windows desktop
        Terminal app (linked above) is a separate, independent application; no code from it is used here.
      </p>
      <TerminalClient initialQuotes={quotes} />
    </div>
  );
}
