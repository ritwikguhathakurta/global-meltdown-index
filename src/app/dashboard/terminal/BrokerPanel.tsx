"use client";

import { useEffect, useState } from "react";

type Balance = { asset: string; free: string; locked: string };
type OrderResult = {
  symbol: string;
  orderId: number;
  status: string;
  side: string;
  type: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
};

type Step = "form" | "review" | "placing" | "done";

/**
 * Real order placement on a real Binance account. Two-step confirm is
 * intentional and non-negotiable here: "Review Order" never calls the
 * network, only "Confirm & Place Order" does. Hidden entirely for any
 * non-admin user (the underlying API routes 401 first regardless — this is
 * belt-and-suspenders, not the actual security boundary).
 */
export function BrokerPanel() {
  const [authorized, setAuthorized] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [balances, setBalances] = useState<Balance[] | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [type, setType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");

  const [step, setStep] = useState<Step>("form");
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/terminal/broker/status")
      .then(async (res) => {
        if (res.status === 401) {
          setAuthorized(false);
          return;
        }
        const body = await res.json();
        setConfigured(Boolean(body.configured));
      })
      .catch(() => setConfigured(false));
  }, []);

  async function loadBalances() {
    setLoadingBalances(true);
    try {
      const res = await fetch("/api/terminal/broker/account");
      const body = await res.json();
      if (res.ok) setBalances(body.balances);
    } finally {
      setLoadingBalances(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount/on-configured-change
    if (configured) loadBalances();
  }, [configured]);

  function goToReview() {
    setError(null);
    if (!symbol.trim() || !quantity.trim() || (type === "LIMIT" && !price.trim())) {
      setError("Fill in all required fields.");
      return;
    }
    setStep("review");
  }

  async function confirmOrder() {
    setStep("placing");
    setError(null);
    try {
      const res = await fetch("/api/terminal/broker/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          side,
          type,
          quantity: Number(quantity),
          price: type === "LIMIT" ? Number(price) : undefined,
          confirm: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || `HTTP ${res.status}`);
        setStep("review");
        return;
      }
      setOrderResult(body.order);
      setStep("done");
      loadBalances();
    } catch (e) {
      setError((e as Error).message);
      setStep("review");
    }
  }

  function resetForm() {
    setStep("form");
    setOrderResult(null);
    setError(null);
    setQuantity("");
    setPrice("");
  }

  if (!authorized) return null;
  if (configured === null) return null;

  if (configured === false) {
    return (
      <div className="gfew-panel mt-4 p-4">
        <h2 className="mb-2 text-sm font-semibold text-text">Live Trading (Binance)</h2>
        <p className="text-xs text-text-dim">
          Not configured. Add <code className="gfew-mono">BINANCE_API_KEY</code> and{" "}
          <code className="gfew-mono">BINANCE_API_SECRET</code> — a key created on Binance with Spot Trading enabled
          and Withdrawals disabled — to enable real order placement.
        </p>
      </div>
    );
  }

  return (
    <div className="gfew-panel mt-4 space-y-4 border-l-4 border-l-[#e0793d] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text">Live Trading (Binance) — real money, real orders</h2>
        <button onClick={loadBalances} className="text-xs text-accent hover:underline" disabled={loadingBalances}>
          {loadingBalances ? "Refreshing…" : "Refresh balances"}
        </button>
      </div>

      {balances && balances.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {balances.map((b) => (
            <span key={b.asset} className="rounded bg-panel-raised px-2 py-1 text-text-dim">
              {b.asset}: {parseFloat(b.free).toLocaleString(undefined, { maximumFractionDigits: 8 })}
            </span>
          ))}
        </div>
      )}
      {balances && balances.length === 0 && <p className="text-xs text-text-dim">No non-zero balances found.</p>}

      {step === "form" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Symbol (BTCUSDT)"
            className="rounded border border-border bg-panel-raised px-2 py-1.5 text-xs text-text"
          />
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as "BUY" | "SELL")}
            className="rounded border border-border bg-panel-raised px-2 py-1.5 text-xs text-text"
          >
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "MARKET" | "LIMIT")}
            className="rounded border border-border bg-panel-raised px-2 py-1.5 text-xs text-text"
          >
            <option value="MARKET">Market</option>
            <option value="LIMIT">Limit</option>
          </select>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Quantity"
            className="rounded border border-border bg-panel-raised px-2 py-1.5 text-xs text-text"
          />
          {type === "LIMIT" ? (
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Limit price"
              className="rounded border border-border bg-panel-raised px-2 py-1.5 text-xs text-text"
            />
          ) : (
            <div />
          )}
        </div>
      )}

      {error && <p className="text-xs text-[#e05a4d]">{error}</p>}

      {step === "form" && (
        <button
          onClick={goToReview}
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-[#061018] hover:opacity-90"
        >
          Review Order
        </button>
      )}

      {(step === "review" || step === "placing") && (
        <div className="rounded border border-l-4 border-l-[#e0793d] border-border bg-panel-raised p-3">
          <p className="mb-2 text-xs font-semibold text-text">This will place a REAL order using real funds:</p>
          <p className="mb-3 text-xs text-text-dim">
            {side} {quantity} {symbol} {type === "LIMIT" ? `@ ${price}` : "at market price"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmOrder}
              disabled={step === "placing"}
              className="rounded bg-[#e05a4d] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {step === "placing" ? "Placing…" : "Confirm & Place Order"}
            </button>
            <button
              onClick={() => setStep("form")}
              disabled={step === "placing"}
              className="rounded border border-border px-3 py-1.5 text-xs text-text-dim hover:text-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "done" && orderResult && (
        <div className="rounded border border-l-4 border-l-[#34c085] border-border bg-panel-raised p-3">
          <p className="mb-1 text-xs font-semibold text-text">Order placed — {orderResult.status}</p>
          <p className="text-xs text-text-dim">
            {orderResult.side} {orderResult.executedQty}/{orderResult.origQty} {orderResult.symbol} · Order ID{" "}
            {orderResult.orderId}
          </p>
          <button onClick={resetForm} className="mt-2 text-xs text-accent hover:underline">
            Place another order
          </button>
        </div>
      )}
    </div>
  );
}
