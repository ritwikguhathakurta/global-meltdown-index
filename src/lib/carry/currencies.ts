import type { Ccy } from "./types";

export interface CurrencyDef {
  code: Ccy;
  name: string;
  benchmark: string;
  /** Market-standard FX quote against USD: "X/USD" = USD per X, "USD/X" = X per USD. */
  usdQuote: "X/USD" | "USD/X" | "self";
  /** default liquidity score used by risk limits (1 high, 0.5 medium, 0.2 low) — a MODEL ASSUMPTION, user-editable */
  liquidity: number;
  fundingCandidate: boolean;
}

/** Data-driven registry: adding a currency here needs no change to the engine. */
export const CURRENCIES: CurrencyDef[] = [
  { code: "USD", name: "US Dollar", benchmark: "SOFR", usdQuote: "self", liquidity: 1, fundingCandidate: true },
  { code: "EUR", name: "Euro", benchmark: "€STR", usdQuote: "X/USD", liquidity: 1, fundingCandidate: true },
  { code: "JPY", name: "Japanese Yen", benchmark: "TONAR", usdQuote: "USD/X", liquidity: 0.8, fundingCandidate: true },
  { code: "CHF", name: "Swiss Franc", benchmark: "SARON", usdQuote: "USD/X", liquidity: 0.7, fundingCandidate: true },
  { code: "GBP", name: "Pound Sterling", benchmark: "SONIA", usdQuote: "X/USD", liquidity: 0.8, fundingCandidate: true },
  { code: "SGD", name: "Singapore Dollar", benchmark: "SORA", usdQuote: "USD/X", liquidity: 0.5, fundingCandidate: true },
  { code: "HKD", name: "Hong Kong Dollar", benchmark: "HONIA", usdQuote: "USD/X", liquidity: 0.5, fundingCandidate: true },
  { code: "AUD", name: "Australian Dollar", benchmark: "AONIA", usdQuote: "X/USD", liquidity: 0.6, fundingCandidate: true },
  { code: "CAD", name: "Canadian Dollar", benchmark: "CORRA", usdQuote: "USD/X", liquidity: 0.6, fundingCandidate: true },
];

export const INR: Ccy = "INR";
export const USD: Ccy = "USD";

export const FUNDING_CCYS = CURRENCIES.filter((c) => c.fundingCandidate).map((c) => c.code);

export function currencyDef(code: Ccy): CurrencyDef | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

export function benchmarkName(code: Ccy): string {
  return currencyDef(code)?.benchmark ?? "benchmark";
}

/** Pair definitions users quote spot for: [base, quote]; quote = units of `quote` per 1 `base`. */
export function spotPairsFor(ccys: Ccy[]): { base: Ccy; quote: Ccy }[] {
  const out: { base: Ccy; quote: Ccy }[] = [];
  for (const c of ccys) out.push({ base: c, quote: INR }); // X/INR = INR per X
  for (const c of ccys) {
    if (c === USD) continue;
    const d = currencyDef(c);
    if (!d) continue;
    if (d.usdQuote === "X/USD") out.push({ base: c, quote: USD });
    else if (d.usdQuote === "USD/X") out.push({ base: USD, quote: c });
  }
  return out;
}

export const pairLabel = (p: { base: Ccy; quote: Ccy }): string => `${p.base}/${p.quote}`;

export function quoteDefinition(p: { base: Ccy; quote: Ccy }): string {
  return `${p.quote} per ${p.base}`;
}
