/**
 * Chemicals engine — Phase 1. Unlike Metals/Grains/etc. (World Bank Pink
 * Sheet / IMF PCPS / USGS — all genuine per-unit spot or mine-production
 * data), there is NO free global chemical spot-price source: ICIS, Platts,
 * and ChemAnalyst are all paywalled industry data, checked and confirmed
 * absent as free/live options.
 *
 * FRED's own Producer Price Index by Commodity series is the genuine free
 * alternative (see sources/fred.ts) — every series below verified live
 * before use. This is explicitly a US PRODUCER PRICE INDEX (base 1982=100),
 * not a global per-unit spot price: it measures how much US producers
 * receive for these chemicals over time, not what they cost delivered
 * somewhere else in the world. Momentum/direction reads on these series are
 * genuine (the index still moves with real supply-demand conditions), but
 * the absolute "price" shown is an index value, not $/MT — labeled as such
 * everywhere it appears, never presented the way a Pink Sheet price is.
 */

export type ChemicalCategory = "Basic Organic" | "Basic Inorganic" | "Plastics & Resins" | "Fertilizer Materials (PPI)" | "Oleochemicals";

export type ChemicalDef = {
  slug: string;
  label: string;
  category: ChemicalCategory;
  metricKey: string; // matches a metricKey in fred.ts's FRED_SERIES
  historyStart: string; // observation_start confirmed live against FRED's own series metadata
};

export const CHEMICALS: ChemicalDef[] = [
  { slug: "basic_organic", label: "Basic Organic Chemicals", category: "Basic Organic", metricKey: "chemical.basic_organic.ppi", historyStart: "1973-12-01" },
  { slug: "ethanol", label: "Ethanol (Ethyl Alcohol)", category: "Basic Organic", metricKey: "chemical.ethanol.ppi", historyStart: "1973-12-01" },
  { slug: "basic_inorganic", label: "Basic Inorganic Chemicals", category: "Basic Inorganic", metricKey: "chemical.basic_inorganic.ppi", historyStart: "1973-12-01" },
  { slug: "industrial_chemicals", label: "Industrial Chemicals (all)", category: "Basic Inorganic", metricKey: "chemical.industrial_chemicals.ppi", historyStart: "1933-01-01" },
  { slug: "sodium_hydroxide", label: "Sodium Hydroxide (Caustic Soda)", category: "Basic Inorganic", metricKey: "chemical.sodium_hydroxide.ppi", historyStart: "2007-12-01" },
  { slug: "sulfuric_acid", label: "Sulfuric Acid", category: "Basic Inorganic", metricKey: "chemical.sulfuric_acid.ppi", historyStart: "1987-06-01" },
  { slug: "plastic_resins", label: "Plastic Resins and Materials (all)", category: "Plastics & Resins", metricKey: "chemical.plastic_resins.ppi", historyStart: "1947-01-01" },
  { slug: "thermoplastic_resins", label: "Thermoplastic Resins (PE/PP/PVC/PS family)", category: "Plastics & Resins", metricKey: "chemical.thermoplastic_resins.ppi", historyStart: "1980-12-01" },
  { slug: "fertilizer_materials", label: "Fertilizer Materials (all)", category: "Fertilizer Materials (PPI)", metricKey: "chemical.fertilizer_materials.ppi", historyStart: "1933-01-01" },
  { slug: "ammonia_urea", label: "Synthetic Ammonia, Nitric Acid, Ammonium Compounds & Urea", category: "Fertilizer Materials (PPI)", metricKey: "chemical.ammonia_urea.ppi", historyStart: "2014-12-01" },
  { slug: "phosphate_fertilizer", label: "Phosphoric Acid, Superphosphates & Other Phosphate Fertilizer Materials", category: "Fertilizer Materials (PPI)", metricKey: "chemical.phosphate_fertilizer.ppi", historyStart: "2014-12-01" },
  { slug: "fatty_acids", label: "Fatty Acids", category: "Oleochemicals", metricKey: "chemical.fatty_acids.ppi", historyStart: "2007-12-01" },
  { slug: "surfactants", label: "Surfactants (Bulk Surface Active Agents)", category: "Oleochemicals", metricKey: "chemical.surfactants.ppi", historyStart: "1983-12-01" },
  { slug: "soaps_detergents", label: "Soaps & Detergents (soap-noodle-adjacent finished goods)", category: "Oleochemicals", metricKey: "chemical.soaps_detergents.ppi", historyStart: "1933-01-01" },
];

export const CHEMICAL_CATEGORIES: ChemicalCategory[] = ["Basic Organic", "Basic Inorganic", "Plastics & Resins", "Fertilizer Materials (PPI)", "Oleochemicals"];
