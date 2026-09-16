/**
 * Chemical Products Master (spec §3 "Chemical Taxonomy" / §4 "Global Chemical
 * Product Hierarchy" / §5-9, extending the Oleochemical taxonomy already
 * built in oleochemValueChain.ts to the rest of the spec's named chemicals).
 *
 * This is a REFERENCE database, not a price feed: CAS numbers (Chemical
 * Abstracts Service registry numbers) and HS codes (World Customs
 * Organization Harmonized System trade-classification codes) are public,
 * internationally standardized identifiers — not proprietary market data —
 * but a wrong one is still a factual error presented as authoritative, so
 * every entry below was either (a) checked live against multiple
 * independent tariff/chemical-database sources before being entered, or
 * (b) left null with an explicit note when no single confident value
 * exists (a polymer family without one universal CAS number, an HS
 * subheading that varies by country/formulation, a genuine multi-component
 * mixture). Nothing here is guessed to fill a gap.
 *
 * `livePriceMetricKey` / `liveTradeHsCode` cross-reference this app's own
 * already-ingested series (fred.ts PPI proxies, unComtrade.ts trade flows)
 * so a product row can honestly say "this one has real live data" instead
 * of implying every row does.
 */

export type ChemicalProductCategory =
  | "Basic Inorganic"
  | "Basic Organic"
  | "Petrochemicals"
  | "Polymers"
  | "Fertilizers"
  | "Agrochemicals"
  | "Oleochemicals"
  | "Specialty Chemicals";

export type ChemicalProduct = {
  slug: string;
  name: string;
  category: ChemicalProductCategory;
  subFamily?: string;
  /** CAS Registry Number, or null when no single confident number exists. */
  casNumber: string | null;
  /** WCO Harmonized System code (6-digit where confidently sourced), or null. */
  hsCode: string | null;
  hsLabel?: string;
  feedstock?: string;
  livePriceMetricKey?: string;
  /** A genuine daily spot-price metric key (see eiaChemicalFeedstockSpot.ts) —
   * distinct from livePriceMetricKey (a PPI index proxy): this is an actual
   * traded spot price, so it outranks both the PPI and the Comtrade
   * unit-value proxy when present. */
  liveSpotMetricKey?: string;
  liveTradeHsCode?: string;
  note?: string;
};

export type ChemicalPriceHsCodes = { primary: string; fallback: string | null };

/**
 * The HS code(s) to query for a real UN Comtrade average unit-value price
 * proxy (see unComtradeChemicalPrices.ts) — null when the product already
 * has a genuine FRED PPI price (livePriceMetricKey), since that's a real
 * price series and a unit-value proxy would be a needless downgrade, not an
 * improvement.
 *
 * Prefers the product's own (more specific, usually 6-digit) `hsCode` over
 * the broader `liveTradeHsCode` — the opposite of an earlier version of this
 * function, which caused a real bug: several Oleochemical HS 3823 rows had
 * `liveTradeHsCode` set to the 4-digit HEADING ("3823"), which covers BOTH
 * industrial fatty acids (subheadings 382311/12/13/19) AND industrial fatty
 * alcohols (382370) — two chemically distinct product families with
 * different real prices. Querying at that heading level blended them into
 * one indistinguishable average, so e.g. Stearic Acid, Oleic Acid, and every
 * fatty alcohol all showed the identical price. Live-verified before this
 * fix: querying UN Comtrade at each real 6-digit subheading (382311/382312/
 * 382319/382370) returns genuinely distinct trade data and unit prices, not
 * an empty or duplicate result — the finer code was always available, just
 * not used. `liveTradeHsCode` is still used as a documented FALLBACK for the
 * rare case a product's own specific code isn't actually reported by the
 * reference country (confirmed live for Sodium Laureth Sulfate: HS 340213
 * returns zero rows for the United States, so it correctly falls back to
 * the broader 3402 heading rather than showing nothing).
 */
export function priceHsCodesFor(product: ChemicalProduct): ChemicalPriceHsCodes | null {
  if (product.livePriceMetricKey || product.liveSpotMetricKey) return null;
  const primary = product.hsCode ?? product.liveTradeHsCode ?? null;
  if (!primary) return null;
  const fallback = product.liveTradeHsCode && product.liveTradeHsCode !== primary ? product.liveTradeHsCode : null;
  return { primary, fallback };
}

/** All six herbicides below share this exact note: the Harmonized System
 * classifies "Herbicides, anti-sprouting products and plant-growth
 * regulators" as ONE subheading (380893) regardless of active ingredient —
 * no 6-digit (or finer) WCO code exists that distinguishes glyphosate from
 * dicamba. Their computed average price is therefore genuinely identical
 * (the same real customs bucket), not a lookup bug. */
const HERBICIDE_HS_NOTE =
  "Shares HS 380893 with every other herbicide here — the Harmonized System doesn't split herbicides by active ingredient, so this row's price is the whole HS 380893 bucket's average, identical to its neighbors' by design, not a lookup error.";

export const CHEMICAL_PRODUCTS: ChemicalProduct[] = [
  // ---- Basic Inorganic Chemicals (spec §4.A) ----
  { slug: "chlorine", name: "Chlorine", category: "Basic Inorganic", casNumber: "7782-50-5", hsCode: "280110", hsLabel: "Chlorine" },
  { slug: "caustic_soda", name: "Caustic Soda (Sodium Hydroxide)", category: "Basic Inorganic", casNumber: "1310-73-2", hsCode: "281511", hsLabel: "Sodium hydroxide, solid", livePriceMetricKey: "chemical.sodium_hydroxide.ppi" },
  { slug: "soda_ash", name: "Soda Ash (Sodium Carbonate)", category: "Basic Inorganic", casNumber: "497-19-8", hsCode: "283620", hsLabel: "Sodium carbonate" },
  { slug: "hydrochloric_acid", name: "Hydrochloric Acid", category: "Basic Inorganic", casNumber: "7647-01-0", hsCode: "280610", hsLabel: "Hydrogen chloride (hydrochloric acid)" },
  { slug: "sulfuric_acid", name: "Sulfuric Acid", category: "Basic Inorganic", casNumber: "7664-93-9", hsCode: "280700", hsLabel: "Sulfuric acid; oleum", livePriceMetricKey: "chemical.sulfuric_acid.ppi" },
  { slug: "nitric_acid", name: "Nitric Acid", category: "Basic Inorganic", casNumber: "7697-37-2", hsCode: "280800", hsLabel: "Nitric acid; sulfonitric acids", livePriceMetricKey: "chemical.ammonia_urea.ppi", note: "Ammonia/nitric-acid/ammonium-compound PPI proxy covers this broadly, not a dedicated nitric-acid series." },
  { slug: "phosphoric_acid", name: "Phosphoric Acid", category: "Basic Inorganic", casNumber: "7664-38-2", hsCode: "280920", hsLabel: "Phosphoric acid; polyphosphoric acids", livePriceMetricKey: "chemical.phosphate_fertilizer.ppi", note: "Phosphate fertilizer materials PPI proxy covers this broadly, not a dedicated phosphoric-acid series." },
  { slug: "ammonia", name: "Ammonia (Anhydrous)", category: "Basic Inorganic", casNumber: "7664-41-7", hsCode: "281410", hsLabel: "Anhydrous ammonia", livePriceMetricKey: "chemical.ammonia_urea.ppi" },
  { slug: "hydrogen", name: "Hydrogen", category: "Basic Inorganic", casNumber: "1333-74-0", hsCode: "280410", hsLabel: "Hydrogen" },
  { slug: "oxygen", name: "Oxygen", category: "Basic Inorganic", casNumber: "7782-44-7", hsCode: "280440", hsLabel: "Oxygen" },
  { slug: "nitrogen", name: "Nitrogen", category: "Basic Inorganic", casNumber: "7727-37-9", hsCode: "280430", hsLabel: "Nitrogen" },
  { slug: "carbon_monoxide", name: "Carbon Monoxide", category: "Basic Inorganic", casNumber: "630-08-0", hsCode: null, note: "Bundled with other inorganic carbon compounds at the HS6 level (heading 2811); no separately confirmed 6-digit code." },
  { slug: "carbon_dioxide", name: "Carbon Dioxide", category: "Basic Inorganic", casNumber: "124-38-9", hsCode: "281120", hsLabel: "Carbon dioxide" },
  { slug: "bromine", name: "Bromine", category: "Basic Inorganic", casNumber: "7726-95-6", hsCode: "280129", hsLabel: "Bromine" },
  { slug: "iodine", name: "Iodine", category: "Basic Inorganic", casNumber: "7553-56-2", hsCode: "280120", hsLabel: "Iodine" },

  // ---- Basic Organic Chemicals / Petrochemicals (spec §4.B, §5) ----
  { slug: "methanol", name: "Methanol", category: "Basic Organic", casNumber: "67-56-1", hsCode: "290511", hsLabel: "Methanol" },
  { slug: "ethanol", name: "Ethanol (industrial)", category: "Basic Organic", casNumber: "64-17-5", hsCode: "220710", hsLabel: "Undenatured ethyl alcohol >= 80% vol.", livePriceMetricKey: "chemical.ethanol.ppi" },
  { slug: "acetone", name: "Acetone", category: "Basic Organic", casNumber: "67-64-1", hsCode: "291411", hsLabel: "Acetone" },
  { slug: "naphtha", name: "Naphtha", category: "Petrochemicals", casNumber: "8030-30-6", hsCode: "271012", hsLabel: "Light oils and preparations (naphtha falls here)", note: "A refinery-cut mixture, not a single compound — CAS 8030-30-6 is the generic petroleum-naphtha registry number." },
  { slug: "ethane", name: "Ethane", category: "Petrochemicals", casNumber: "74-84-0", hsCode: null, note: "Classified under HS 2711 (petroleum gases) or 2901 (acyclic hydrocarbons) depending on declared end-use — not resolved to one confident 6-digit code here." },
  { slug: "propane", name: "Propane", category: "Petrochemicals", casNumber: "74-98-6", hsCode: "271112", hsLabel: "Propane, liquefied", liveSpotMetricKey: "chemical.propane.spot_price", note: "Uses a real daily EIA spot price (Mont Belvieu, TX FOB, $/GAL) instead of a monthly Comtrade unit-value proxy — the one product in this table with a genuine traded spot price, not an index or customs-derived average." },
  { slug: "lpg", name: "LPG (Liquefied Petroleum Gas)", category: "Petrochemicals", casNumber: null, hsCode: "271119", hsLabel: "Other liquefied petroleum gases", note: "A mixture (propane/butane blend), not a single compound." },
  { slug: "ethylene", name: "Ethylene", category: "Petrochemicals", casNumber: "74-85-1", hsCode: "290121", hsLabel: "Ethylene" },
  { slug: "propylene", name: "Propylene", category: "Petrochemicals", casNumber: "115-07-1", hsCode: "290122", hsLabel: "Propene (propylene)" },
  { slug: "butadiene", name: "1,3-Butadiene", category: "Petrochemicals", casNumber: "106-99-0", hsCode: "290124", hsLabel: "Buta-1,3-diene" },
  { slug: "benzene", name: "Benzene", category: "Petrochemicals", casNumber: "71-43-2", hsCode: "290220", hsLabel: "Benzene" },
  { slug: "toluene", name: "Toluene", category: "Petrochemicals", casNumber: "108-88-3", hsCode: "290230", hsLabel: "Toluene" },
  { slug: "xylene", name: "Xylenes (mixed isomers)", category: "Petrochemicals", casNumber: "1330-20-7", hsCode: "290244", hsLabel: "Xylenes, mixed isomers" },
  { slug: "px", name: "Para-Xylene (PX)", category: "Petrochemicals", casNumber: "106-42-3", hsCode: "290243", hsLabel: "p-Xylene", feedstock: "Xylene" },
  { slug: "styrene", name: "Styrene", category: "Petrochemicals", casNumber: "100-42-5", hsCode: "290250", hsLabel: "Styrene" },
  { slug: "phenol", name: "Phenol", category: "Petrochemicals", casNumber: "108-95-2", hsCode: "290711", hsLabel: "Phenol (hydroxybenzene)" },
  { slug: "cumene", name: "Cumene", category: "Petrochemicals", casNumber: "98-82-8", hsCode: "290270", hsLabel: "Cumene", note: "Precursor to phenol/acetone." },
  { slug: "mtbe", name: "MTBE (Methyl Tert-Butyl Ether)", category: "Petrochemicals", casNumber: "1634-04-4", hsCode: "290911", hsLabel: "Diethyl ether and other acyclic ethers (MTBE falls here)" },
  { slug: "etbe", name: "ETBE (Ethyl Tert-Butyl Ether)", category: "Petrochemicals", casNumber: "637-92-3", hsCode: "290919", hsLabel: "Other acyclic ethers" },
  { slug: "meg", name: "MEG (Monoethylene Glycol)", category: "Petrochemicals", casNumber: "107-21-1", hsCode: "290531", hsLabel: "Ethylene glycol (ethanediol)", feedstock: "Ethylene Oxide" },
  { slug: "deg", name: "DEG (Diethylene Glycol)", category: "Petrochemicals", casNumber: "111-46-6", hsCode: null, feedstock: "Ethylene Oxide", note: "No single confidently-sourced 6-digit HS code found separate from ethylene glycol ethers; likely falls under a broader 'other acyclic polyhydric alcohols' heading." },
  { slug: "teg", name: "TEG (Triethylene Glycol)", category: "Petrochemicals", casNumber: "112-27-6", hsCode: null, feedstock: "Ethylene Oxide", note: "Same HS uncertainty as DEG above." },
  { slug: "eo", name: "EO (Ethylene Oxide)", category: "Petrochemicals", casNumber: "75-21-8", hsCode: "291010", hsLabel: "Ethylene oxide", feedstock: "Ethylene" },
  { slug: "po", name: "PO (Propylene Oxide)", category: "Petrochemicals", casNumber: "75-56-9", hsCode: "291020", hsLabel: "Propylene oxide", feedstock: "Propylene" },
  { slug: "pta", name: "PTA (Purified Terephthalic Acid)", category: "Petrochemicals", casNumber: "100-21-0", hsCode: "291736", hsLabel: "Terephthalic acid and its salts", feedstock: "Para-Xylene" },

  // ---- Polymers (spec §6) ----
  { slug: "pe_generic", name: "Polyethylene (generic)", category: "Polymers", casNumber: "9002-88-4", hsCode: "3901", hsLabel: "Polymers of ethylene, in primary forms (heading level)", livePriceMetricKey: "chemical.thermoplastic_resins.ppi", note: "Polymers are not single molecules — 9002-88-4 is the generic CAS commonly cited for the polyethylene family, not a discrete compound." },
  { slug: "hdpe", name: "HDPE (High-Density Polyethylene)", category: "Polymers", subFamily: "Polyethylene", casNumber: "9002-88-4", hsCode: "390120", hsLabel: "Polyethylene, specific gravity >= 0.94", livePriceMetricKey: "chemical.thermoplastic_resins.ppi" },
  { slug: "ldpe", name: "LDPE (Low-Density Polyethylene)", category: "Polymers", subFamily: "Polyethylene", casNumber: "9002-88-4", hsCode: "390110", hsLabel: "Polyethylene, specific gravity < 0.94", livePriceMetricKey: "chemical.thermoplastic_resins.ppi" },
  { slug: "lldpe", name: "LLDPE (Linear Low-Density Polyethylene)", category: "Polymers", subFamily: "Polyethylene", casNumber: "9002-88-4", hsCode: "390110", hsLabel: "Polyethylene, specific gravity < 0.94 (heading shared with LDPE; some jurisdictions split further)", livePriceMetricKey: "chemical.thermoplastic_resins.ppi" },
  { slug: "pp", name: "PP (Polypropylene)", category: "Polymers", casNumber: "9003-07-0", hsCode: "390210", hsLabel: "Polypropylene", livePriceMetricKey: "chemical.thermoplastic_resins.ppi" },
  { slug: "pvc", name: "PVC (Polyvinyl Chloride)", category: "Polymers", casNumber: "9002-86-2", hsCode: "390410", hsLabel: "Polyvinyl chloride, not mixed", livePriceMetricKey: "chemical.thermoplastic_resins.ppi" },
  { slug: "ps", name: "PS (Polystyrene)", category: "Polymers", casNumber: "9003-53-6", hsCode: "390319", hsLabel: "Polystyrene, other", livePriceMetricKey: "chemical.thermoplastic_resins.ppi" },
  { slug: "eps", name: "EPS (Expandable Polystyrene)", category: "Polymers", subFamily: "Polystyrene", casNumber: "9003-53-6", hsCode: "390311", hsLabel: "Polystyrene, expansible", livePriceMetricKey: "chemical.thermoplastic_resins.ppi" },
  { slug: "abs", name: "ABS (Acrylonitrile-Butadiene-Styrene)", category: "Polymers", casNumber: "9003-56-9", hsCode: "390330", hsLabel: "Acrylonitrile-butadiene-styrene (ABS) copolymers" },
  { slug: "pet_resin", name: "PET (Polyethylene Terephthalate)", category: "Polymers", casNumber: "25038-59-9", hsCode: "390761", hsLabel: "PET having a viscosity number >= 78 ml/g", feedstock: "PTA + MEG" },
  { slug: "nylon", name: "Nylon (Polyamide, generic)", category: "Polymers", casNumber: "25038-54-4", hsCode: "3908", hsLabel: "Polyamides, in primary forms (heading level)", note: "9002-88-4-style caveat applies: 25038-54-4 is commonly cited for Nylon 6; Nylon 6,6 is a distinct CAS (32131-17-2)." },
  { slug: "polycarbonate", name: "Polycarbonate", category: "Polymers", casNumber: "25037-45-0", hsCode: "390740", hsLabel: "Polycarbonates" },

  // ---- Fertilizers (spec §7) ----
  { slug: "urea", name: "Urea", category: "Fertilizers", casNumber: "57-13-6", hsCode: "310210", hsLabel: "Urea, whether or not in aqueous solution", livePriceMetricKey: "chemical.ammonia_urea.ppi" },
  { slug: "dap", name: "DAP (Diammonium Phosphate)", category: "Fertilizers", casNumber: "7783-28-0", hsCode: "310530", hsLabel: "Diammonium hydrogenorthophosphate", livePriceMetricKey: "chemical.phosphate_fertilizer.ppi" },
  { slug: "map", name: "MAP (Monoammonium Phosphate)", category: "Fertilizers", casNumber: "7722-76-1", hsCode: "310540", hsLabel: "Ammonium dihydrogenorthophosphate", livePriceMetricKey: "chemical.phosphate_fertilizer.ppi" },
  { slug: "mop", name: "MOP (Muriate of Potash / Potassium Chloride)", category: "Fertilizers", casNumber: "7447-40-7", hsCode: "310420", hsLabel: "Potassium chloride" },
  { slug: "sop", name: "SOP (Sulfate of Potash / Potassium Sulfate)", category: "Fertilizers", casNumber: "7778-80-5", hsCode: "310430", hsLabel: "Potassium sulfate" },
  { slug: "sulfur_fertilizer", name: "Sulfur", category: "Fertilizers", casNumber: "7704-34-9", hsCode: "250300", hsLabel: "Sulfur of all kinds" },
  { slug: "ammonium_nitrate", name: "Ammonium Nitrate", category: "Fertilizers", casNumber: "6484-52-2", hsCode: "310230", hsLabel: "Ammonium nitrate" },
  { slug: "uan", name: "UAN (Urea Ammonium Nitrate solution)", category: "Fertilizers", casNumber: null, hsCode: "310280", hsLabel: "Mixtures of urea and ammonium nitrate in solution", note: "A mixture/solution, not a single compound." },
  { slug: "npk", name: "NPK (Compound Fertilizer)", category: "Fertilizers", casNumber: null, hsCode: "3105", hsLabel: "Fertilizers with N+P+K (heading level; 6-digit varies by ratio)", note: "A formulated blend, not a single compound — exact 6-digit code depends on the specific N-P-K ratio." },

  // ---- Agrochemicals (spec §8) ----
  { slug: "glyphosate", name: "Glyphosate", category: "Agrochemicals", subFamily: "Herbicide", casNumber: "1071-83-6", hsCode: "380893", hsLabel: "Herbicides, anti-sprouting products and plant-growth regulators", note: HERBICIDE_HS_NOTE },
  { slug: "glufosinate", name: "Glufosinate", category: "Agrochemicals", subFamily: "Herbicide", casNumber: "51276-47-2", hsCode: "380893", hsLabel: "Herbicides, anti-sprouting products and plant-growth regulators", note: HERBICIDE_HS_NOTE },
  { slug: "paraquat", name: "Paraquat (dichloride)", category: "Agrochemicals", subFamily: "Herbicide", casNumber: "1910-42-5", hsCode: "380893", hsLabel: "Herbicides, anti-sprouting products and plant-growth regulators", note: HERBICIDE_HS_NOTE },
  { slug: "atrazine", name: "Atrazine", category: "Agrochemicals", subFamily: "Herbicide", casNumber: "1912-24-9", hsCode: "380893", hsLabel: "Herbicides, anti-sprouting products and plant-growth regulators", note: HERBICIDE_HS_NOTE },
  { slug: "24d", name: "2,4-D", category: "Agrochemicals", subFamily: "Herbicide", casNumber: "94-75-7", hsCode: "380893", hsLabel: "Herbicides, anti-sprouting products and plant-growth regulators", note: HERBICIDE_HS_NOTE },
  { slug: "dicamba", name: "Dicamba", category: "Agrochemicals", subFamily: "Herbicide", casNumber: "1918-00-9", hsCode: "380893", hsLabel: "Herbicides, anti-sprouting products and plant-growth regulators", note: HERBICIDE_HS_NOTE },

  // ---- Oleochemicals: individual named products (spec §11-20), extending
  // oleochemValueChain.ts's structural graph with real CAS numbers ----
  //
  // HS 3823 ("Industrial monocarboxylic fatty acids; ... industrial fatty
  // alcohols") splits into real, separately-reported 6-digit subheadings —
  // 382311 Stearic acid, 382312 Oleic acid, 382313 Tall oil fatty acids,
  // 382319 Other, 382370 Industrial fatty alcohols — live-verified to each
  // return distinct UN Comtrade trade data, not an empty or duplicate
  // result. Stearic Acid and Oleic Acid get their own dedicated codes below
  // (382311/382312); every other fatty acid the Harmonized System doesn't
  // name individually (caproic through linolenic, plus PFAD) correctly
  // shares the 382319 "Other" bucket, and every fatty alcohol shares 382370
  // — two real, distinct sub-buckets, not one blended "3823" total.
  { slug: "caproic_acid", name: "Caproic Acid (C6)", category: "Oleochemicals", subFamily: "Fatty Acid", casNumber: "142-62-1", hsCode: "382319", liveTradeHsCode: "3823", note: "Shares HS 382319 (\"other\" industrial fatty acids not individually classified) with every fatty acid here except Stearic/Oleic, which have their own dedicated codes — a real shared customs bucket, not a lookup error." },
  { slug: "caprylic_acid", name: "Caprylic Acid (C8)", category: "Oleochemicals", subFamily: "Fatty Acid", casNumber: "124-07-2", hsCode: "382319", liveTradeHsCode: "3823", note: "Shares HS 382319 (\"other\" industrial fatty acids) with Caproic/Capric/Lauric/Myristic/Linoleic/Linolenic Acid and PFAD." },
  { slug: "capric_acid", name: "Capric Acid (C10)", category: "Oleochemicals", subFamily: "Fatty Acid", casNumber: "334-48-5", hsCode: "382319", liveTradeHsCode: "3823", note: "Shares HS 382319 (\"other\" industrial fatty acids) with Caproic/Caprylic/Lauric/Myristic/Linoleic/Linolenic Acid and PFAD." },
  { slug: "lauric_acid", name: "Lauric Acid (C12)", category: "Oleochemicals", subFamily: "Fatty Acid", casNumber: "143-07-7", hsCode: "382319", liveTradeHsCode: "3823", note: "Shares HS 382319 (\"other\" industrial fatty acids) with Caproic/Caprylic/Capric/Myristic/Linoleic/Linolenic Acid and PFAD." },
  { slug: "myristic_acid", name: "Myristic Acid (C14)", category: "Oleochemicals", subFamily: "Fatty Acid", casNumber: "544-63-8", hsCode: "382319", liveTradeHsCode: "3823", note: "Shares HS 382319 (\"other\" industrial fatty acids) with Caproic/Caprylic/Capric/Lauric/Linoleic/Linolenic Acid and PFAD." },
  { slug: "palmitic_acid", name: "Palmitic Acid (C16)", category: "Oleochemicals", subFamily: "Fatty Acid", casNumber: "57-10-3", hsCode: "382311", liveTradeHsCode: "3823", livePriceMetricKey: "chemical.fatty_acids.ppi", note: "Uses the FRED Fatty Acids PPI, a family-level proxy, not a per-compound price. Its own HS code (382311, shared with Stearic Acid — the WCO doesn't split C16 from C18 saturated acids) is used by Stearic/Oleic Acid below since neither has a PPI." },
  { slug: "stearic_acid", name: "Stearic Acid (C18)", category: "Oleochemicals", subFamily: "Fatty Acid", casNumber: "57-11-4", hsCode: "382311", hsLabel: "Stearic acid", liveTradeHsCode: "3823", livePriceMetricKey: "chemical.fatty_acids.ppi", note: "Uses the FRED Fatty Acids PPI, a family-level proxy, not a per-compound price. Has its own dedicated HS code (382311), shared only with Palmitic Acid." },
  { slug: "oleic_acid", name: "Oleic Acid (C18:1)", category: "Oleochemicals", subFamily: "Fatty Acid", casNumber: "112-80-1", hsCode: "382312", hsLabel: "Oleic acid", liveTradeHsCode: "3823", note: "Has its own dedicated HS code (382312) — not bundled with the other fatty acids here." },
  { slug: "linoleic_acid", name: "Linoleic Acid (C18:2)", category: "Oleochemicals", subFamily: "Fatty Acid", casNumber: "60-33-3", hsCode: "382319", liveTradeHsCode: "3823", note: "Shares HS 382319 (\"other\" industrial fatty acids) with Caproic/Caprylic/Capric/Lauric/Myristic/Linolenic Acid and PFAD." },
  { slug: "linolenic_acid", name: "Linolenic Acid (C18:3, alpha)", category: "Oleochemicals", subFamily: "Fatty Acid", casNumber: "463-40-1", hsCode: "382319", liveTradeHsCode: "3823", note: "Shares HS 382319 (\"other\" industrial fatty acids) with Caproic/Caprylic/Capric/Lauric/Myristic/Linoleic Acid and PFAD." },

  { slug: "lauryl_alcohol", name: "Lauryl Alcohol (Dodecanol)", category: "Oleochemicals", subFamily: "Fatty Alcohol", casNumber: "112-53-8", hsCode: "382370", liveTradeHsCode: "3823", note: "Shares HS 382370 (industrial fatty alcohols) with every fatty alcohol here — a real, separate customs bucket from the fatty acid subheadings above, not the same code." },
  { slug: "cetyl_alcohol", name: "Cetyl Alcohol (Hexadecanol)", category: "Oleochemicals", subFamily: "Fatty Alcohol", casNumber: "36653-82-4", hsCode: "382370", liveTradeHsCode: "3823", note: "Shares HS 382370 (industrial fatty alcohols) with Lauryl/Stearyl/Oleyl/Myristyl Alcohol." },
  { slug: "stearyl_alcohol", name: "Stearyl Alcohol (Octadecanol)", category: "Oleochemicals", subFamily: "Fatty Alcohol", casNumber: "112-92-5", hsCode: "382370", liveTradeHsCode: "3823", note: "Shares HS 382370 (industrial fatty alcohols) with Lauryl/Cetyl/Oleyl/Myristyl Alcohol." },
  { slug: "oleyl_alcohol", name: "Oleyl Alcohol", category: "Oleochemicals", subFamily: "Fatty Alcohol", casNumber: "143-28-2", hsCode: "382370", liveTradeHsCode: "3823", note: "Shares HS 382370 (industrial fatty alcohols) with Lauryl/Cetyl/Stearyl/Myristyl Alcohol." },
  { slug: "myristyl_alcohol", name: "Myristyl Alcohol (Tetradecanol)", category: "Oleochemicals", subFamily: "Fatty Alcohol", casNumber: "112-72-1", hsCode: "382370", liveTradeHsCode: "3823", note: "Shares HS 382370 (industrial fatty alcohols) with Lauryl/Cetyl/Stearyl/Oleyl Alcohol." },

  { slug: "methyl_laurate", name: "Methyl Laurate", category: "Oleochemicals", subFamily: "Methyl Ester", casNumber: "111-82-0", hsCode: "382600", liveTradeHsCode: "3826", note: "Shares HS 382600 (biodiesel/FAME) with every methyl ester here — the Harmonized System doesn't split biodiesel by fatty-acid chain length, so this is genuinely bundled, not separable by customs code." },
  { slug: "methyl_palmitate", name: "Methyl Palmitate", category: "Oleochemicals", subFamily: "Methyl Ester", casNumber: "112-39-0", hsCode: "382600", liveTradeHsCode: "3826", note: "Shares HS 382600 (biodiesel/FAME) with Methyl Laurate/Stearate/Oleate." },
  { slug: "methyl_stearate", name: "Methyl Stearate", category: "Oleochemicals", subFamily: "Methyl Ester", casNumber: "112-61-8", hsCode: "382600", liveTradeHsCode: "3826", note: "Shares HS 382600 (biodiesel/FAME) with Methyl Laurate/Palmitate/Oleate." },
  { slug: "methyl_oleate", name: "Methyl Oleate", category: "Oleochemicals", subFamily: "Methyl Ester", casNumber: "112-62-9", hsCode: "382600", liveTradeHsCode: "3826", note: "Shares HS 382600 (biodiesel/FAME) with Methyl Laurate/Palmitate/Stearate." },

  { slug: "glycerine", name: "Glycerine / Glycerol (crude)", category: "Oleochemicals", casNumber: "56-81-5", hsCode: "290545", hsLabel: "Glycerol, crude", liveTradeHsCode: "290545" },
  { slug: "pfad", name: "PFAD (Palm Fatty Acid Distillate)", category: "Oleochemicals", casNumber: null, hsCode: "382319", liveTradeHsCode: "3823", note: "A refining byproduct blend, not a single compound — no dedicated CAS or HS subheading; bundled inside HS 3823." },

  { slug: "sodium_lauryl_sulfate", name: "Sodium Lauryl Sulfate (SLS)", category: "Oleochemicals", subFamily: "Surfactant (Anionic)", casNumber: "151-21-3", hsCode: "340211", liveTradeHsCode: "3402", livePriceMetricKey: "chemical.surfactants.ppi", note: "US Surfactants PPI is a family-level proxy, not a per-compound price." },
  { slug: "sodium_laureth_sulfate", name: "Sodium Laureth Sulfate (SLES)", category: "Oleochemicals", subFamily: "Surfactant (Anionic)", casNumber: "68585-34-2", hsCode: "340213", liveTradeHsCode: "3402", note: "CAS registered for the ethoxylated reaction product, not a single discrete molecule." },

  { slug: "soap_noodles", name: "Soap Noodles", category: "Oleochemicals", casNumber: null, hsCode: "340120", hsLabel: "Soap in other forms", liveTradeHsCode: "340120", livePriceMetricKey: "chemical.soaps_detergents.ppi", note: "A formulated blend of fatty-acid soaps, not a single compound; PPI proxy is adjacent finished-goods, not soap-noodle-specific." },
];

export const CHEMICAL_PRODUCT_CATEGORIES: ChemicalProductCategory[] = [
  "Basic Inorganic",
  "Basic Organic",
  "Petrochemicals",
  "Polymers",
  "Fertilizers",
  "Agrochemicals",
  "Oleochemicals",
  "Specialty Chemicals",
];

/**
 * Spec §9's Specialty Chemicals list is itself a set of broad end-use
 * categories (additives, solvents, coatings, ...), not named compounds —
 * unlike every other section above, there is no specific product to attach
 * a CAS/HS code to without inventing false specificity. Listed as
 * categories only, exactly as the spec itself presents them.
 */
export const SPECIALTY_CHEMICAL_CATEGORIES: string[] = [
  "Additives",
  "Solvents",
  "Coatings",
  "Adhesives",
  "Electronic Chemicals",
  "Battery Chemicals",
  "Water Treatment Chemicals",
  "Construction Chemicals",
  "Textile Chemicals",
  "Mining Chemicals",
  "Paper Chemicals",
  "Food Chemicals",
  "Personal-Care Ingredients",
  "Cosmetic Ingredients",
  "Pharmaceutical Intermediates",
];
