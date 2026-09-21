/**
 * Funding Carry engine — shared types.
 *
 * Canonical conventions (docs/CARRY_ENGINE.md, "Conventions"):
 *  - Rates are decimals internally (7.10% = 0.0710, 1 bp = 0.0001). UI converts.
 *  - Cash flows use the BORROWER perspective: + = cash received, - = cash paid.
 *  - Economic costs are positive numbers; benefits are positive in the attribution layer.
 *  - Arbitrage = INR alternative cost - candidate cost (positive = candidate cheaper).
 *  - Headroom  = arbitrage - minimum required saving.
 *  - FX pairs carry an explicit quote definition: quote units per 1 base unit.
 */

export type Ccy = string;
export type Source = "USER_INPUT" | "LIVE" | "MODEL" | "EXAMPLE" | "SCENARIO";
/** A executable dealer quote · B institutional data · C official benchmark · D indicative public · E model-derived */
export type DataQuality = "A" | "B" | "C" | "D" | "E";
export type DayCount = "ACT/360" | "ACT/365" | "30/360" | "ACT/ACT";
export type PayFreq = 1 | 2 | 4 | 12;

export interface Meta {
  source: Source;
  quality: DataQuality;
  /** ISO timestamp the quote was obtained (drives age / staleness). */
  asOf: string | null;
}

export interface SpotQuote {
  base: Ccy;
  quote: Ccy;
  bid: number | null;
  ask: number | null;
  meta: Meta;
}

export interface LenderQuote {
  ccy: Ccy;
  /** Term swap rate of the currency's benchmark for the tenor (e.g. 5Y SOFR OIS swap), decimal. */
  benchmarkRate: number | null;
  /** Lender credit spread over benchmark, decimal (must be >= 0). */
  spread: number | null;
  upfrontFeePct: number | null;
  ongoingFeeBp: number | null;
  structure: "fixed" | "floating";
  meta: Meta;
}

export type HedgeInstrument =
  | "CCS"
  | "FX_FORWARD"
  | "FX_SWAP"
  | "NDF"
  | "OPTION"
  | "COLLAR"
  | "HEDGE_COST"
  | "RBI_SWAP";

/**
 * One dealer-quoted conversion edge from -> to.
 *  CCS:                bid/offer = fixed rate in `to` paid against receiving `from` floating flat.
 *  FX_FORWARD/SWAP/NDF: bid/offer = annual forward premium of `from` vs `to` (positive = cost to buy `from` forward).
 *  OPTION/COLLAR/HEDGE_COST: offer = all-in annual cost added to the `from` rate (premium / hedge cost).
 */
export interface EdgeQuote {
  id: string;
  from: Ccy;
  to: Ccy;
  instrument: HedgeInstrument;
  bid: number | null;
  offer: number | null;
  /** One-off dealer margin on the initial exchange, in bp of notional. */
  upfrontBp: number | null;
  /** Ongoing collateral / credit charge, bp p.a. of notional. */
  ongoingBp: number | null;
  meta: Meta;
}

export interface TenorQuotes {
  lenders: Record<Ccy, LenderQuote>;
  edges: EdgeQuote[];
}

export type BorrowerType = "PRIVATE_CORPORATE" | "PSU" | "AD_BANK" | "LLP" | "NBFC_FI" | "OTHER";

export interface InrAlternative {
  label: string;
  rate: number | null;
  /** optional INR comparator per tenor (years as string); falls back to `rate` */
  rateByTenor?: Record<string, number>;
  freq: PayFreq;
  upfrontFeePct: number;
  ongoingFeeBp: number;
  /** Term swap rate of the INR benchmark (for carry attribution only; optional). */
  benchmarkRate: number | null;
}

export interface OtherCosts {
  legalDocsInr: number;
  isdaCsaInr: number;
  registrationInr: number;
  agencyAnnualInr: number;
  custodyAnnualInr: number;
  otherUpfrontInr: number;
  otherAnnualInr: number;
}

export interface TaxConfig {
  mode: "excluded" | "included";
  /** Withholding tax on interest paid to the foreign lender; lender grosses up. Source + date required by user. */
  whtRate: number;
  whtSource: string;
  gstOnFeesRate: number;
  stampDutyPct: number;
  guaranteeFeeBpPa: number;
  /** Share of interest that reduces taxable profit (corporate tax rate x deductible share). 0 = ignore. */
  interestShieldRate: number;
}

export interface DealTerms {
  requirementInr: number;
  tenorYears: number;
  startDate: string;
  paymentFreq: PayFreq;
  dayCount: DayCount;
  amortisation: "bullet" | "equal";
  graceYears: number;
  hedgeRatio: number;
  minSaving: number;
  /** Expected annual drift of FCY/INR spot applied to the UNHEDGED share (0 = spot unchanged). */
  unhedgedDriftPa: number;
}

export interface RbiSwapConfig {
  apply: boolean;
  swapRate: number;
  compoundingPerYear: number;
  maxTenorYears: number;
  fbilRef: number | null;
  windowOpenUntil: string;
  drawdownFrom: string;
  drawdownTo: string;
}

export interface RegulatoryInputs {
  borrowerType: BorrowerType;
  endUse: string;
  lenderNonResident: boolean | null;
  manufacturing: boolean;
  relatedParty: boolean;
  netWorthInr: number | null;
  drawdownDate: string;
  /** rule ids the user has verified against the primary RBI text */
  userConfirmedRules: string[];
}

export interface RiskConfig {
  /** annualised FX vol by currency (decimal) vs INR; null = unknown */
  fxVol: Record<Ccy, number | null>;
  confidence: 0.95 | 0.99;
  horizonDays: number;
  rateVolBp: number;
  basisVolBp: number;
  spreadVolBp: number;
  /** liquidity score by currency: 1 high, 0.5 medium, 0.2 low */
  liquidity: Record<Ccy, number>;
  riskAversion: number;
  maxSingleCurrencyShare: number;
  maxUnhedgedShare: number;
  minLiquidityScore: number;
  maxFxEsPctOfNotional: number;
}

export interface ClassBands {
  veryStrong: number;
  strong: number;
  marginal: number;
}

export interface StaleLimits {
  fxSpotMin: number;
  hedgeMin: number;
  creditMin: number;
}

export interface CarryInputs {
  deal: DealTerms;
  inrAlt: InrAlternative;
  spots: SpotQuote[];
  quotesByTenor: Record<string, TenorQuotes>;
  otherCosts: OtherCosts;
  tax: TaxConfig;
  rbi: RbiSwapConfig;
  reg: RegulatoryInputs;
  risk: RiskConfig;
  bands: ClassBands;
  stale: StaleLimits;
  /** Reference "now" (ISO) used for age/stale checks; injected so results are reproducible. */
  nowIso: string;
}

export type Kind = "principal" | "bench" | "spread" | "hedge" | "fee" | "tax" | "shield" | "fx";
export type Part = "P" | "I" | "U";

export interface Entry {
  ledger: string;
  t: number;
  date: string;
  ccy: Ccy;
  /** borrower perspective: + received, - paid */
  amount: number;
  kind: Kind;
  part: Part;
  tag?: string;
  instrument: string;
  desc: string;
  /** modelled/expected entry (unhedged share) rather than contractual */
  modelled?: boolean;
}

export type Mode = "mid" | "exec";

export interface Shocks {
  spreadBp?: number;
  basisBp?: number;
  /** limit basisBp to one edge id (default: all edges) */
  basisEdgeId?: string;
  benchBp?: number;
  fxShock?: number;
  liquidityWiden?: number;
  inrRateBp?: number;
}
