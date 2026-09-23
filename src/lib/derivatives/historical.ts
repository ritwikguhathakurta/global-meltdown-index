/**
 * Historical leverage-crisis reference table (spec §85-87). This is a FACTUAL REFERENCE, not a
 * scored backtest — spec §135-137 asks for precision/recall/AUC-validated early-warning
 * performance, which would require a labeled point-in-time dataset this project does not have and
 * cannot honestly fabricate. Dates and mechanisms below are well-documented public history; the
 * "what would plausibly have reacted" column is qualitative judgment about which of this page's own
 * indices are built from data that existed and would have moved during that period, not a claim
 * that the index (which usually didn't exist yet) actually fired a warning at the time.
 */
export type HistoricalCrisisEntry = {
  year: string;
  name: string;
  mechanism: string;
  relevantIndices: string[];
};

export const HISTORICAL_CRISES: HistoricalCrisisEntry[] = [
  {
    year: "1998",
    name: "LTCM",
    mechanism: "A large, highly-levered relative-value hedge fund's positions became forced sellers after Russia's default widened credit and swap spreads simultaneously across uncorrelated books, overwhelming its capital.",
    relevantIndices: ["PCI (crowded relative-value positioning)", "CRI (counterparty concentration among its dealer lenders)"],
  },
  {
    year: "2007–2008",
    name: "Global Financial Crisis",
    mechanism: "Falling mortgage-collateral values triggered rising haircuts and margin calls across the repo and OTC derivatives markets, forcing deleveraging that further depressed asset prices — the canonical collateral-spiral (spec §40) mechanism.",
    relevantIndices: ["CSI (proxy)", "MSI (proxy)", "GLI (bank leverage ratios, repo volume)"],
  },
  {
    year: "2018",
    name: "\"Volmageddon\" (Feb 5)",
    mechanism: "Crowded short-VIX-futures/short-volatility ETN positioning unwound in a single session when a modest equity decline caused a disproportionate VIX spike, forcing rapid covering.",
    relevantIndices: ["PCI (VIX futures net-short extremity — this exact input already tracked by derivativesLeverage.ts)", "MSI (proxy)"],
  },
  {
    year: "2020",
    name: "COVID / Treasury basis-trade unwind",
    mechanism: "Leveraged hedge funds' cash-futures Treasury basis trades were forced to unwind under margin pressure as volatility spiked, contributing to the March 2020 Treasury market dysfunction that prompted Fed intervention.",
    relevantIndices: ["PCI (10Y Treasury leveraged-funds positioning — this exact input now tracked)", "CSI (proxy, repo dispersion)"],
  },
  {
    year: "2021",
    name: "Archegos",
    mechanism: "A family office's concentrated, highly-levered single-stock total-return-swap positions across multiple prime brokers unwound simultaneously once one dealer began selling, exposing the lack of cross-dealer visibility into aggregate leverage on the same names.",
    relevantIndices: ["CRI (proxy, counterparty concentration)", "Dealer/bank derivative notional (bank_sec_filings.ts, where disclosed)"],
  },
  {
    year: "2022",
    name: "UK gilt / LDI crisis",
    mechanism: "Pension funds' leveraged liability-driven-investment strategies faced margin calls as gilt yields spiked after a fiscal announcement, forcing gilt sales that pushed yields higher still — forced the Bank of England into emergency gilt purchases.",
    relevantIndices: ["CSI (proxy)", "MOVE index (rates volatility)", "GLI (repo/collateral inputs)"],
  },
  {
    year: "2022",
    name: "Crypto deleveraging (Terra/Luna, FTX)",
    mechanism: "Over-levered crypto lending and exchange-native leverage unwound in cascading liquidations as collateral values (often the platforms' own tokens) collapsed.",
    relevantIndices: ["Binance perpetual funding rate/open interest (Tier 3, this exact market now tracked)"],
  },
  {
    year: "2023",
    name: "US regional bank stress (SVB, Signature, First Republic)",
    mechanism: "Rapid deposit flight forced sales of held-to-maturity securities at unrealized losses crystallized by the 2022–23 rate-hiking cycle — a funding/duration mismatch rather than a derivatives-leverage event per se, included for completeness since it shares the same collateral-value-shock mechanism.",
    relevantIndices: ["Bank leverage ratios (fdicBankFind.ts, bankSecFilings.ts)", "MOVE index"],
  },
];
