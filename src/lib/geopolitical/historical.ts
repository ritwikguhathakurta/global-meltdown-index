/**
 * Historical geopolitical-episode reference table (spec §86-87). This is a FACTUAL REFERENCE,
 * not a scored backtest — spec §139-140 asks for precision/recall/AUC/Brier-score-validated
 * early-warning performance, which needs a labeled point-in-time dataset this project does not
 * have and will not fabricate. Dates and mechanisms are well-documented public history; the
 * "relevant indices" column is qualitative judgment about which of this page's own real
 * indicators are built from data that existed and would plausibly have moved during that
 * period — not a claim that GEWI (which didn't exist yet) actually fired a warning at the time.
 */
export type HistoricalGeoEventEntry = {
  year: string;
  name: string;
  mechanism: string;
  relevantIndices: string[];
};

export const HISTORICAL_GEO_EVENTS: HistoricalGeoEventEntry[] = [
  {
    year: "1973",
    name: "OPEC oil embargo",
    mechanism: "Arab OPEC members embargoed oil exports to the US and allies after the Yom Kippur War, roughly quadrupling oil prices within months.",
    relevantIndices: ["Energy engine (oil price)", "Military Buildup (regional spending)"],
  },
  {
    year: "1990–1991",
    name: "Gulf War",
    mechanism: "Iraq's invasion of Kuwait removed a major oil exporter from the market and triggered a US-led coalition response; oil spiked, then fell sharply once the war concluded quickly.",
    relevantIndices: ["Maritime Chokepoint Stress (Strait of Hormuz)", "Escalation Reading"],
  },
  {
    year: "2011",
    name: "Arab Spring",
    mechanism: "Simultaneous political uprisings across North Africa and the Middle East disrupted oil production (notably Libya) and raised regional political-risk premia broadly.",
    relevantIndices: ["Escalation Reading (GDELT conflict-event share)", "Military Buildup"],
  },
  {
    year: "2014",
    name: "Russia's annexation of Crimea",
    mechanism: "Triggered the first major Western sanctions regime against Russia, and set the precedent structure (sectoral + individual designations) later expanded massively in 2022.",
    relevantIndices: ["Sanctions Intensity (Russia program)", "OFAC SDN count"],
  },
  {
    year: "2019",
    name: "Abqaiq-Khurais attack",
    mechanism: "Drone/missile strikes on Saudi Aramco's largest processing facility knocked out roughly half of Saudi oil output overnight — the single largest sudden oil-supply disruption in decades.",
    relevantIndices: ["Escalation Reading", "Maritime Chokepoint Stress (Strait of Hormuz)"],
  },
  {
    year: "2022–present",
    name: "Russia-Ukraine war",
    mechanism: "Full-scale invasion triggered the largest Western sanctions regime in modern history, disrupted Black Sea grain/energy exports, and reshaped European energy sourcing.",
    relevantIndices: ["Sanctions Intensity (Russia program, this exact program now tracked)", "Escalation Reading", "Military Buildup (Russia, Ukraine, NATO members)"],
  },
  {
    year: "2023–present",
    name: "Israel-Hamas war and Red Sea/Houthi shipping attacks",
    mechanism: "Regional escalation following the October 2023 Hamas attack led to sustained Houthi attacks on Red Sea shipping, forcing many vessels to reroute via the Cape of Good Hope.",
    relevantIndices: ["Maritime Chokepoint Stress (Bab el-Mandeb, Suez Canal — both tracked via IMF PortWatch)", "Escalation Reading"],
  },
];
