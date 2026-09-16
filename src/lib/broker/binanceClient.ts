import crypto from "crypto";

/**
 * Binance Spot REST API client — places REAL orders with REAL money. Every
 * endpoint here is a SIGNED endpoint (HMAC-SHA256 over the request's query
 * string, using the account's own secret key as the signing key, hex
 * encoded and appended as `signature`); this exact mechanism, the endpoint
 * paths, and every parameter name below were verified against Binance's own
 * current API documentation (developers.binance.com) before writing this,
 * given that a wrong parameter here means a malformed real order, not a
 * cosmetic bug.
 *
 * BINANCE_API_KEY / BINANCE_API_SECRET are server-only env vars — never
 * sent to the client, never logged. The key should be created on Binance
 * (Account -> API Management) with Spot Trading enabled and Withdrawals
 * explicitly DISABLED: this app never calls a withdrawal endpoint, and a
 * leaked trade-only key can only cause bad trades (recoverable, bounded by
 * account balance) whereas a leaked withdrawal-capable key can drain the
 * account entirely (unbounded, irreversible). This is the single most
 * important safeguard on the user's side of this integration.
 */

const BASE_URL = "https://api.binance.com";
const RECV_WINDOW = 5000;

const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;

export function isBrokerConfigured(): boolean {
  return Boolean(API_KEY && API_SECRET);
}

export class BinanceApiError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.code = code;
  }
}

function sign(query: string): string {
  if (!API_SECRET) throw new Error("BINANCE_API_SECRET not configured");
  return crypto.createHmac("sha256", API_SECRET).update(query).digest("hex");
}

async function signedRequest<T>(path: string, method: "GET" | "POST", params: Record<string, string | number>): Promise<T> {
  if (!API_KEY || !API_SECRET) throw new Error("Binance API not configured");

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) query.set(k, String(v));
  query.set("recvWindow", String(RECV_WINDOW));
  query.set("timestamp", String(Date.now()));
  query.set("signature", sign(query.toString()));

  const res = await fetch(`${BASE_URL}${path}?${query.toString()}`, {
    method,
    headers: { "X-MBX-APIKEY": API_KEY },
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new BinanceApiError((body?.msg as string) || `Binance request failed (HTTP ${res.status})`, body?.code);
  }
  return body as T;
}

export type BinanceBalance = { asset: string; free: string; locked: string };
type BinanceAccountResponse = { canTrade: boolean; balances: BinanceBalance[] };

export async function getAccountBalances(): Promise<BinanceBalance[]> {
  const account = await signedRequest<BinanceAccountResponse>("/api/v3/account", "GET", {});
  return account.balances.filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
}

export type BinanceOpenOrder = {
  orderId: number;
  symbol: string;
  side: string;
  type: string;
  status: string;
  price: string;
  origQty: string;
  executedQty: string;
  time: number;
};

export async function getOpenOrders(symbol?: string): Promise<BinanceOpenOrder[]> {
  return signedRequest<BinanceOpenOrder[]>("/api/v3/openOrders", "GET", symbol ? { symbol } : {});
}

export type PlaceOrderParams = {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: number;
  price?: number; // required for LIMIT, ignored for MARKET
};

export type BinanceOrderResult = {
  symbol: string;
  orderId: number;
  status: string;
  side: string;
  type: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  fills?: { price: string; qty: string; commission: string; commissionAsset: string }[];
};

export async function placeOrder(order: PlaceOrderParams): Promise<BinanceOrderResult> {
  const params: Record<string, string | number> = {
    symbol: order.symbol,
    side: order.side,
    type: order.type,
    quantity: order.quantity,
  };
  if (order.type === "LIMIT") {
    if (!order.price) throw new Error("price is required for LIMIT orders");
    params.price = order.price;
    params.timeInForce = "GTC";
  }
  return signedRequest<BinanceOrderResult>("/api/v3/order", "POST", params);
}
