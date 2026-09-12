import { composeEnergyComposite, type EnergyDomainScores, type EnergyComposite } from "./energySystemicRisk";

/**
 * Energy Scenario Library & Policy Simulator (spec's §85-86 20-scenario
 * stress library). This is a deterministic "what-if" layer, not a forecast:
 * each scenario applies a fixed point-delta to today's live oil/gas/
 * minerals/shipping/market domain scores, then recomputes the composite
 * through the exact same `composeEnergyComposite` weighting the live
 * energySystemicRisk.ts engine uses — so a scenario result is never a
 * separate, parallel calculation, only the real methodology applied to a
 * hypothetical input.
 *
 * Shock magnitudes are illustrative judgment calls, loosely calibrated to
 * the direction and rough scale of the named historical analogue (e.g. "a
 * Hormuz closure would be a larger oil-price/shipping shock than a single
 * tanker attack") — they are NOT statistically fitted, NOT a probability
 * estimate of the scenario occurring, and NOT a claim that the named
 * historical event produced exactly this score move (this engine did not
 * exist during most of them). Treat this as a stress-test sensitivity tool,
 * not a predictive model.
 */

export type EnergyScenarioCategory = "Chokepoint / Shipping" | "Producer Supply Shock" | "Natural Gas" | "Critical Minerals" | "Demand / Macro" | "De-escalation";

export type EnergyScenarioShock = {
  oilDelta?: number;
  gasDelta?: number;
  mineralsDelta?: number;
  shippingDelta?: number;
  marketDelta?: number;
};

export type EnergyScenario = {
  id: string;
  label: string;
  category: EnergyScenarioCategory;
  description: string;
  historicalAnalogue: string;
  shock: EnergyScenarioShock;
};

export const ENERGY_SCENARIOS: EnergyScenario[] = [
  {
    id: "hormuz_full_closure",
    label: "Full closure of the Strait of Hormuz",
    category: "Chokepoint / Shipping",
    description: "Iran (or a regional conflict) closes Hormuz to tanker traffic entirely, halting roughly a fifth of global seaborne oil and a large share of global LNG.",
    historicalAnalogue: "No full closure has ever occurred; repeated Iran-US tension episodes (1980s Tanker War, 2019-2020 seizures) each produced sharp but partial disruptions.",
    shock: { oilDelta: 45, shippingDelta: 50, gasDelta: 20, marketDelta: 15 },
  },
  {
    id: "hormuz_partial_disruption",
    label: "Partial Hormuz disruption / tanker seizures",
    category: "Chokepoint / Shipping",
    description: "Sporadic tanker seizures, mining, or attacks in the Strait raise insurance costs and slow transits without a full blockade.",
    historicalAnalogue: "2019 Gulf of Oman tanker attacks and vessel seizures; transits slowed and war-risk insurance premiums spiked without stopping flow.",
    shock: { oilDelta: 18, shippingDelta: 22, marketDelta: 6 },
  },
  {
    id: "red_sea_escalation",
    label: "Bab el-Mandeb / Red Sea shipping attacks escalate",
    category: "Chokepoint / Shipping",
    description: "Houthi or other attacks on merchant shipping force a sustained mass diversion of tankers around the Cape of Good Hope.",
    historicalAnalogue: "2023-2024 Red Sea shipping crisis: major carriers rerouted around Africa, adding ~10-14 days of transit time on Asia-Europe routes.",
    shock: { shippingDelta: 30, oilDelta: 8, gasDelta: 8 },
  },
  {
    id: "suez_canal_blockage",
    label: "Suez Canal blocked",
    category: "Chokepoint / Shipping",
    description: "A grounding, sabotage, or infrastructure failure blocks the canal for an extended period, backing up global container and tanker traffic.",
    historicalAnalogue: "2021 Ever Given grounding blocked the canal for six days, delaying an estimated $9bn/day of trade.",
    shock: { shippingDelta: 25, oilDelta: 6 },
  },
  {
    id: "panama_canal_drought",
    label: "Panama Canal drought-driven transit restrictions",
    category: "Chokepoint / Shipping",
    description: "Severe drought forces the canal authority to cut daily transit slots, backing up LNG/LPG and container shipping through the Americas.",
    historicalAnalogue: "2023 Panama Canal drought cut daily transits from ~36 to ~24, with LNG carriers particularly affected.",
    shock: { shippingDelta: 14, gasDelta: 6 },
  },
  {
    id: "russia_gas_cutoff",
    label: "Russia cuts remaining gas flows to Europe",
    category: "Natural Gas",
    description: "Russia halts its remaining pipeline gas exports to Europe (e.g. via TurkStream), forcing a scramble for LNG and storage drawdown.",
    historicalAnalogue: "2022 Nord Stream shutoff and Ukraine transit halt: European gas prices spiked over 10x their pre-crisis level at the peak.",
    shock: { gasDelta: 40, marketDelta: 12 },
  },
  {
    id: "opec_surprise_cut",
    label: "OPEC+ surprise coordinated production cut",
    category: "Producer Supply Shock",
    description: "OPEC+ announces a large, unexpected coordinated cut (on the order of 2 million barrels/day) to defend prices.",
    historicalAnalogue: "October 2022 OPEC+ 2mbpd cut announcement; April 2023 surprise voluntary cuts by Saudi Arabia and others.",
    shock: { oilDelta: 22, marketDelta: 5 },
  },
  {
    id: "opec_market_share_war",
    label: "OPEC+ abandons cuts, launches market-share war",
    category: "Producer Supply Shock",
    description: "OPEC+ cohesion breaks down; members open the taps to defend market share, crashing prices and squeezing higher-cost producers.",
    historicalAnalogue: "2014-2016 Saudi-led price war and the March 2020 Saudi-Russia price war (Brent fell below $20 briefly).",
    shock: { oilDelta: -15, marketDelta: 25, mineralsDelta: 10 },
  },
  {
    id: "us_spr_release",
    label: "Large coordinated US/IEA strategic reserve release",
    category: "De-escalation",
    description: "The US and IEA member states coordinate a large strategic petroleum reserve release to cool prices during a supply scare.",
    historicalAnalogue: "2022 US SPR releases of roughly 180 million barrels over six months, the largest drawdown in SPR history.",
    shock: { oilDelta: -12, marketDelta: -5 },
  },
  {
    id: "saudi_infrastructure_attack",
    label: "Attack on Saudi oil processing infrastructure",
    category: "Producer Supply Shock",
    description: "A drone or missile strike takes a major Saudi processing facility offline, removing a large share of Saudi output for weeks.",
    historicalAnalogue: "September 2019 Abqaiq-Khurais attacks knocked out roughly half of Saudi output overnight; Brent jumped nearly 15% in a single session.",
    shock: { oilDelta: 30, shippingDelta: 8, marketDelta: 10 },
  },
  {
    id: "iran_export_halt",
    label: "Iran sanctions snapback halts oil exports",
    category: "Producer Supply Shock",
    description: "A sanctions snapback or enforcement crackdown removes most Iranian crude exports from the market with little spare capacity to replace them.",
    historicalAnalogue: "2018-2019 US sanctions re-imposition cut Iranian exports by roughly 2 million barrels/day.",
    shock: { oilDelta: 16, shippingDelta: 6 },
  },
  {
    id: "libya_civil_war",
    label: "Libya civil conflict shuts in oil fields",
    category: "Producer Supply Shock",
    description: "Renewed factional conflict forces a blockade or shutdown of Libya's main oil fields and export terminals.",
    historicalAnalogue: "2020 Libyan blockade cut national output from over 1.2mbpd to under 100kbpd for months.",
    shock: { oilDelta: 10, marketDelta: 3 },
  },
  {
    id: "global_lng_crunch",
    label: "Global LNG supply crunch",
    category: "Natural Gas",
    description: "A major LNG exporter outage (technical failure or force majeure) collides with a demand surge in Asia, tightening the global LNG market.",
    historicalAnalogue: "2021-2022 global LNG crunch, worsened by Freeport LNG's 2022 outage, drove Asian and European spot LNG prices to record highs.",
    shock: { gasDelta: 28, marketDelta: 6 },
  },
  {
    id: "extreme_winter_demand",
    label: "Extreme winter cold snap spikes gas demand",
    category: "Natural Gas",
    description: "An unusually severe, prolonged cold snap across the US or Europe drives heating demand well beyond normal seasonal storage drawdown.",
    historicalAnalogue: "February 2021 Winter Storm Uri drove US natural gas spot prices up more than 100x in the worst-hit regional markets for several days.",
    shock: { gasDelta: 24, marketDelta: 5 },
  },
  {
    id: "critical_minerals_export_ban",
    label: "China restricts critical-mineral/rare-earth exports",
    category: "Critical Minerals",
    description: "China tightens export licensing or imposes an outright ban on rare earths, graphite, or refined battery-mineral exports as a geopolitical lever.",
    historicalAnalogue: "China's 2023-2024 export-control tightening on gallium, germanium, graphite, and antimony in response to Western chip/trade restrictions.",
    shock: { mineralsDelta: 32, marketDelta: 4 },
  },
  {
    id: "copper_mine_disruption",
    label: "Major copper-producer mine disruption",
    category: "Critical Minerals",
    description: "A major Chilean or Peruvian mine faces a prolonged strike, landslide, or regulatory shutdown, removing meaningful global copper supply.",
    historicalAnalogue: "2022-2023 Peru social unrest and Panama's Cobre Panama mine closure each removed meaningful global copper supply for extended periods.",
    shock: { mineralsDelta: 20 },
  },
  {
    id: "uranium_supply_shock",
    label: "Uranium/enrichment supply shock",
    category: "Critical Minerals",
    description: "A major uranium producer or enrichment supplier is disrupted by conflict, sanctions, or nationalization, tightening the nuclear fuel cycle.",
    historicalAnalogue: "2023 Niger coup threatened a meaningful share of EU uranium supply; Russia's dominant enrichment/conversion role has been a recurring 2022-2024 sanctions flashpoint.",
    shock: { mineralsDelta: 18 },
  },
  {
    id: "global_demand_collapse",
    label: "Global recession / demand collapse",
    category: "Demand / Macro",
    description: "A sharp global recession crushes energy demand: prices fall but implied volatility, equity stress, and industrial-metal demand destruction all spike hard.",
    historicalAnalogue: "March-April 2020 COVID demand collapse: oil prices (briefly negative for WTI futures) fell even as options-implied volatility and equity stress spiked to record levels.",
    shock: { oilDelta: -10, mineralsDelta: 22, marketDelta: 35, shippingDelta: 15 },
  },
  {
    id: "taiwan_strait_crisis",
    label: "Taiwan Strait crisis",
    category: "Producer Supply Shock",
    description: "A blockade or conflict scenario around Taiwan disrupts a critical East Asian shipping corridor and the semiconductor supply chain that critical-mineral refining feeds.",
    historicalAnalogue: "August 2022 Pelosi-visit military exercises briefly closed parts of the Strait to civilian traffic; a sustained blockade scenario has no direct historical precedent.",
    shock: { shippingDelta: 28, mineralsDelta: 15, marketDelta: 12 },
  },
  {
    id: "coordinated_deescalation",
    label: "Coordinated diplomatic de-escalation",
    category: "De-escalation",
    description: "A major diplomatic breakthrough (ceasefire, sanctions relief, or restored producer cooperation) broadly relieves energy-market tension at once.",
    historicalAnalogue: "Directional analogue only — e.g. the market relief seen after the 2015 Iran nuclear deal or past OPEC+ cooperation restorations.",
    shock: { oilDelta: -12, gasDelta: -10, shippingDelta: -10, mineralsDelta: -8, marketDelta: -10 },
  },
];

export type EnergyScenarioResult = EnergyComposite & {
  scenario: EnergyScenario;
  baseline: EnergyDomainScores;
  shocked: EnergyDomainScores;
};

function clampScore(v: number | null): number | null {
  if (v === null) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function applyDelta(base: number | null, delta: number | undefined): number | null {
  if (base === null) return null;
  return clampScore(base + (delta ?? 0));
}

export function applyEnergyScenario(baseline: EnergyDomainScores, scenario: EnergyScenario): EnergyScenarioResult {
  const shocked: EnergyDomainScores = {
    oilScore: applyDelta(baseline.oilScore, scenario.shock.oilDelta),
    gasScore: applyDelta(baseline.gasScore, scenario.shock.gasDelta),
    mineralsScore: applyDelta(baseline.mineralsScore, scenario.shock.mineralsDelta),
    shippingScore: applyDelta(baseline.shippingScore, scenario.shock.shippingDelta),
    marketScore: applyDelta(baseline.marketScore, scenario.shock.marketDelta),
  };
  const composite = composeEnergyComposite(shocked);
  return { ...composite, scenario, baseline, shocked };
}

export function runAllEnergyScenarios(baseline: EnergyDomainScores): EnergyScenarioResult[] {
  return ENERGY_SCENARIOS.map((s) => applyEnergyScenario(baseline, s));
}
