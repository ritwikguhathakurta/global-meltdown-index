/**
 * Real molecular identity data (formula, molecular weight, PubChem CID) for
 * the Chemical Products Master, sourced from PubChem PUG-REST (NIH/NLM —
 * free, keyless, official) via CAS Registry Number cross-reference lookup.
 * Fetched once as a static enrichment pass, not a live per-request call —
 * molecular identity is a permanent fact, not a time-varying series, same
 * treatment as the CAS/HS numbers themselves in chemicalProductsDatabase.ts.
 *
 * Every entry below passed a two-step verification, not a blind first match:
 * PubChem's xref/RN/<CAS> lookup returns MULTIPLE candidate compounds per CAS
 * number (a real cross-reference data-quality issue, live-verified during
 * this build — taking the first candidate alone matched styrene's CAS to
 * glucose, sodium hydroxide's CAS to 1,3-dioxolan-2-one, and chlorine's CAS to
 * hydrochloric acid), so each candidate's OWN synonym list is checked to
 * confirm it actually lists the CAS number being looked up before acceptance.
 *
 * CAS numbers already known to represent a polymer family or a genuine
 * mixture (not one discrete molecule) — Naphtha, mixed Xylenes, every Polymers-
 * category entry, and Sodium Laureth Sulfate's reaction-product CAS — are
 * correctly absent below: none of their PubChem candidates passed the CAS-
 * membership check, confirming there is no single confident molecular weight
 * for a family/mixture registry number, exactly as chemicalProductsDatabase.ts
 * already discloses in each of those entries' own `note` field.
 */

export type ChemicalEnrichment = {
  molecularFormula: string;
  molecularWeightGMol: number;
  pubchemCid: number;
};

export const CHEMICAL_ENRICHMENT_BY_CAS: Record<string, ChemicalEnrichment> = {
  "100-21-0": { molecularFormula: "C8H6O4", molecularWeightGMol: 166.13, pubchemCid: 7489 }, // pta
  "100-42-5": { molecularFormula: "C8H8", molecularWeightGMol: 104.15, pubchemCid: 7501 }, // styrene
  "106-42-3": { molecularFormula: "C8H10", molecularWeightGMol: 106.16, pubchemCid: 7809 }, // px
  "106-99-0": { molecularFormula: "C4H6", molecularWeightGMol: 54.09, pubchemCid: 7845 }, // butadiene
  "107-21-1": { molecularFormula: "C2H6O2", molecularWeightGMol: 62.07, pubchemCid: 174 }, // meg
  "1071-83-6": { molecularFormula: "C3H8NO5P", molecularWeightGMol: 169.07, pubchemCid: 3496 }, // glyphosate
  "108-88-3": { molecularFormula: "C7H8", molecularWeightGMol: 92.14, pubchemCid: 1140 }, // toluene
  "108-95-2": { molecularFormula: "C6H6O", molecularWeightGMol: 94.11, pubchemCid: 996 }, // phenol
  "111-46-6": { molecularFormula: "C4H10O3", molecularWeightGMol: 106.12, pubchemCid: 8117 }, // deg
  "111-82-0": { molecularFormula: "C13H26O2", molecularWeightGMol: 214.34, pubchemCid: 8139 }, // methyl_laurate
  "112-27-6": { molecularFormula: "C6H14O4", molecularWeightGMol: 150.17, pubchemCid: 8172 }, // teg
  "112-39-0": { molecularFormula: "C17H34O2", molecularWeightGMol: 270.5, pubchemCid: 8181 }, // methyl_palmitate
  "112-53-8": { molecularFormula: "C12H26O", molecularWeightGMol: 186.33, pubchemCid: 8193 }, // lauryl_alcohol
  "112-61-8": { molecularFormula: "C19H38O2", molecularWeightGMol: 298.5, pubchemCid: 8201 }, // methyl_stearate
  "112-62-9": { molecularFormula: "C19H36O2", molecularWeightGMol: 296.5, pubchemCid: 5364509 }, // methyl_oleate
  "112-72-1": { molecularFormula: "C14H30O", molecularWeightGMol: 214.39, pubchemCid: 8209 }, // myristyl_alcohol
  "112-80-1": { molecularFormula: "C18H34O2", molecularWeightGMol: 282.5, pubchemCid: 445639 }, // oleic_acid
  "112-92-5": { molecularFormula: "C18H38O", molecularWeightGMol: 270.5, pubchemCid: 8221 }, // stearyl_alcohol
  "115-07-1": { molecularFormula: "C3H6", molecularWeightGMol: 42.08, pubchemCid: 8252 }, // propylene
  "124-07-2": { molecularFormula: "C8H16O2", molecularWeightGMol: 144.21, pubchemCid: 379 }, // caprylic_acid
  "124-38-9": { molecularFormula: "CO2", molecularWeightGMol: 44.009, pubchemCid: 280 }, // carbon_dioxide
  "1310-73-2": { molecularFormula: "HNaO", molecularWeightGMol: 39.997, pubchemCid: 14798 }, // caustic_soda
  "1333-74-0": { molecularFormula: "H2", molecularWeightGMol: 2.016, pubchemCid: 783 }, // hydrogen
  "142-62-1": { molecularFormula: "C6H12O2", molecularWeightGMol: 116.16, pubchemCid: 8892 }, // caproic_acid
  "143-07-7": { molecularFormula: "C12H24O2", molecularWeightGMol: 200.32, pubchemCid: 3893 }, // lauric_acid
  "143-28-2": { molecularFormula: "C18H36O", molecularWeightGMol: 268.5, pubchemCid: 5284499 }, // oleyl_alcohol
  "151-21-3": { molecularFormula: "C12H25NaO4S", molecularWeightGMol: 288.38, pubchemCid: 3423265 }, // sodium_lauryl_sulfate
  "1634-04-4": { molecularFormula: "C5H12O", molecularWeightGMol: 88.15, pubchemCid: 15413 }, // mtbe
  "1910-42-5": { molecularFormula: "C12H14Cl2N2", molecularWeightGMol: 257.16, pubchemCid: 15938 }, // paraquat
  "1912-24-9": { molecularFormula: "C8H14ClN5", molecularWeightGMol: 215.68, pubchemCid: 2256 }, // atrazine
  "1918-00-9": { molecularFormula: "C8H6Cl2O3", molecularWeightGMol: 221.03, pubchemCid: 3030 }, // dicamba
  "334-48-5": { molecularFormula: "C10H20O2", molecularWeightGMol: 172.26, pubchemCid: 2969 }, // capric_acid
  "36653-82-4": { molecularFormula: "C16H34O", molecularWeightGMol: 242.44, pubchemCid: 2682 }, // cetyl_alcohol
  "463-40-1": { molecularFormula: "C18H30O2", molecularWeightGMol: 278.4, pubchemCid: 5280934 }, // linolenic_acid
  "497-19-8": { molecularFormula: "CNa2O3", molecularWeightGMol: 105.988, pubchemCid: 10340 }, // soda_ash
  "51276-47-2": { molecularFormula: "C5H12NO4P", molecularWeightGMol: 181.13, pubchemCid: 4794 }, // glufosinate
  "544-63-8": { molecularFormula: "C14H28O2", molecularWeightGMol: 228.37, pubchemCid: 11005 }, // myristic_acid
  "56-81-5": { molecularFormula: "C3H8O3", molecularWeightGMol: 92.09, pubchemCid: 753 }, // glycerine
  "57-10-3": { molecularFormula: "C16H32O2", molecularWeightGMol: 256.42, pubchemCid: 985 }, // palmitic_acid
  "57-11-4": { molecularFormula: "C18H36O2", molecularWeightGMol: 284.5, pubchemCid: 5281 }, // stearic_acid
  "57-13-6": { molecularFormula: "CH4N2O", molecularWeightGMol: 60.056, pubchemCid: 1176 }, // urea
  "60-33-3": { molecularFormula: "C18H32O2", molecularWeightGMol: 280.4, pubchemCid: 5280450 }, // linoleic_acid
  "630-08-0": { molecularFormula: "CO", molecularWeightGMol: 28.01, pubchemCid: 281 }, // carbon_monoxide
  "637-92-3": { molecularFormula: "C6H14O", molecularWeightGMol: 102.17, pubchemCid: 12512 }, // etbe
  "64-17-5": { molecularFormula: "C2H6O", molecularWeightGMol: 46.07, pubchemCid: 702 }, // ethanol
  "6484-52-2": { molecularFormula: "H4N2O3", molecularWeightGMol: 80.044, pubchemCid: 22985 }, // ammonium_nitrate
  "67-56-1": { molecularFormula: "CH4O", molecularWeightGMol: 32.042, pubchemCid: 887 }, // methanol
  "67-64-1": { molecularFormula: "C3H6O", molecularWeightGMol: 58.08, pubchemCid: 180 }, // acetone
  "71-43-2": { molecularFormula: "C6H6", molecularWeightGMol: 78.11, pubchemCid: 241 }, // benzene
  "74-84-0": { molecularFormula: "C2H6", molecularWeightGMol: 30.07, pubchemCid: 6324 }, // ethane
  "74-85-1": { molecularFormula: "C2H4", molecularWeightGMol: 28.05, pubchemCid: 6325 }, // ethylene
  "74-98-6": { molecularFormula: "C3H8", molecularWeightGMol: 44.1, pubchemCid: 6334 }, // propane
  "7447-40-7": { molecularFormula: "ClK", molecularWeightGMol: 74.55, pubchemCid: 4873 }, // mop
  "75-21-8": { molecularFormula: "C2H4O", molecularWeightGMol: 44.05, pubchemCid: 6354 }, // eo
  "75-56-9": { molecularFormula: "C3H6O", molecularWeightGMol: 58.08, pubchemCid: 6378 }, // po
  "7553-56-2": { molecularFormula: "I2", molecularWeightGMol: 253.8089, pubchemCid: 807 }, // iodine
  "7647-01-0": { molecularFormula: "ClH", molecularWeightGMol: 36.46, pubchemCid: 313 }, // hydrochloric_acid
  "7664-38-2": { molecularFormula: "H3O4P", molecularWeightGMol: 97.995, pubchemCid: 1004 }, // phosphoric_acid
  "7664-41-7": { molecularFormula: "H3N", molecularWeightGMol: 17.031, pubchemCid: 222 }, // ammonia
  "7664-93-9": { molecularFormula: "H2O4S", molecularWeightGMol: 98.08, pubchemCid: 1118 }, // sulfuric_acid
  "7697-37-2": { molecularFormula: "HNO3", molecularWeightGMol: 63.013, pubchemCid: 944 }, // nitric_acid
  "7704-34-9": { molecularFormula: "S", molecularWeightGMol: 32.07, pubchemCid: 5362487 }, // sulfur_fertilizer
  "7722-76-1": { molecularFormula: "H6NO4P", molecularWeightGMol: 115.03, pubchemCid: 24402 }, // map
  "7726-95-6": { molecularFormula: "Br2", molecularWeightGMol: 159.81, pubchemCid: 24408 }, // bromine
  "7727-37-9": { molecularFormula: "N2", molecularWeightGMol: 28.014, pubchemCid: 947 }, // nitrogen
  "7778-80-5": { molecularFormula: "K2O4S", molecularWeightGMol: 174.26, pubchemCid: 24507 }, // sop
  "7782-44-7": { molecularFormula: "O2", molecularWeightGMol: 31.999, pubchemCid: 977 }, // oxygen
  "7782-50-5": { molecularFormula: "Cl2", molecularWeightGMol: 70.9, pubchemCid: 24526 }, // chlorine
  "7783-28-0": { molecularFormula: "H9N2O4P", molecularWeightGMol: 132.06, pubchemCid: 24540 }, // dap
  "94-75-7": { molecularFormula: "C8H6Cl2O3", molecularWeightGMol: 221.03, pubchemCid: 1486 }, // 24d
  "98-82-8": { molecularFormula: "C9H12", molecularWeightGMol: 120.19, pubchemCid: 7406 }, // cumene
};

