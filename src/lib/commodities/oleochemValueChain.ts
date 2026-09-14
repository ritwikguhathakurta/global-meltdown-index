/**
 * Oleochemical Value-Chain Graph (spec §21) — a machine-readable directed
 * graph of the real, well-documented industrial chemistry pathways from
 * feedstock to end-use. This is NOT derived from a live data source: it is
 * structural knowledge (which real conversion steps exist in this industry),
 * the same way a textbook process-flow diagram is "real" without being a
 * time series. No fabricated numbers live here — only which node has real
 * tracked data in this app (and which metric key), and which doesn't and why.
 *
 * Each chain mirrors the spec's own worked examples verbatim (§21).
 */

export type ValueChainNodeKind = "feedstock" | "process" | "intermediate" | "end_use";

export type ValueChainNode = {
  id: string;
  label: string;
  kind: ValueChainNodeKind;
  /** Real, live-verified data this app tracks for this node, or none. */
  dataNote: string;
  hasData: boolean;
};

export type ValueChainDef = {
  id: string;
  label: string;
  nodeIds: string[]; // ordered, upstream -> downstream
};

export const VALUE_CHAIN_NODES: Record<string, ValueChainNode> = {
  cpo: { id: "cpo", label: "CPO (Crude Palm Oil)", kind: "feedstock", hasData: true, dataNote: "Price: commodity.palm_oil.price (World Bank Pink Sheet). Malaysia stock/export volume: MPOB." },
  pko: { id: "pko", label: "PKO (Palm Kernel Oil)", kind: "feedstock", hasData: true, dataNote: "Price: commodity.palm_kernel_oil.price (World Bank Pink Sheet)." },
  refining: { id: "refining", label: "Refining", kind: "process", hasData: false, dataNote: "Process step, not a priced product — no data expected." },
  splitting: { id: "splitting", label: "Splitting", kind: "process", hasData: false, dataNote: "Process step, not a priced product — no data expected." },
  hydrolysis: { id: "hydrolysis", label: "Hydrolysis", kind: "process", hasData: false, dataNote: "Process step, not a priced product — no data expected." },
  pfad: { id: "pfad", label: "PFAD (Palm Fatty Acid Distillate)", kind: "intermediate", hasData: false, dataNote: "No free PFAD-specific price found. Its trade is bundled inside HS 3823 (industrial fatty acids/acid oils), not separable by customs code." },
  fatty_acid: { id: "fatty_acid", label: "Fatty Acid", kind: "intermediate", hasData: true, dataNote: "US PPI proxy: chemical.fatty_acids.ppi. Trade: HS 3823 (bundled with PFAD/fatty alcohols, not separable)." },
  lauric_acid: { id: "lauric_acid", label: "Lauric Acid", kind: "intermediate", hasData: false, dataNote: "No free source publishes this specific compound's price or trade separately." },
  methyl_ester: { id: "methyl_ester", label: "Methyl Ester", kind: "intermediate", hasData: false, dataNote: "No free price. Volume is not separable from FAME/biodiesel at HS 3826." },
  methyl_laurate: { id: "methyl_laurate", label: "Methyl Laurate", kind: "intermediate", hasData: false, dataNote: "No free source publishes this specific compound's price or trade separately." },
  fatty_alcohol: { id: "fatty_alcohol", label: "Fatty Alcohol", kind: "intermediate", hasData: false, dataNote: "No free price. Its trade is bundled inside HS 3823, not separable from fatty acids/PFAD." },
  glycerine: { id: "glycerine", label: "Glycerine / Glycerol", kind: "intermediate", hasData: true, dataNote: "Trade: HS 2905.45 (Malaysia/Indonesia exports, UN Comtrade). No free price found." },
  fame: { id: "fame", label: "FAME", kind: "intermediate", hasData: true, dataNote: "Trade: HS 3826 (bundled with biodiesel, not separable). No free price found." },
  biodiesel: { id: "biodiesel", label: "Biodiesel", kind: "end_use", hasData: true, dataNote: "Real volume: Malaysia MPOB monthly biodiesel export tonnage (commodity.palm_oil.malaysia.export.biodiesel). Trade value: HS 3826. No free price found." },
  surfactants: { id: "surfactants", label: "Surfactants", kind: "intermediate", hasData: true, dataNote: "US PPI proxy: chemical.surfactants.ppi. Trade: HS 3402." },
  detergents: { id: "detergents", label: "Detergents / Personal Care", kind: "end_use", hasData: true, dataNote: "Adjacent US PPI proxy: chemical.soaps_detergents.ppi (WPU0671). Not oleochemical-specific." },
  epichlorohydrin: { id: "epichlorohydrin", label: "Epichlorohydrin", kind: "intermediate", hasData: false, dataNote: "No free price or trade source found for this specific compound." },
  epoxy_resins: { id: "epoxy_resins", label: "Epoxy Resins", kind: "end_use", hasData: false, dataNote: "No free price or trade source found for this specific compound." },
};

export const VALUE_CHAINS: ValueChainDef[] = [
  { id: "biodiesel_chain", label: "CPO → Biodiesel", nodeIds: ["cpo", "refining", "pfad", "fatty_acid", "methyl_ester", "fame", "biodiesel"] },
  { id: "surfactant_chain_pko", label: "PKO → Surfactants (lauric route)", nodeIds: ["pko", "splitting", "lauric_acid", "methyl_laurate", "surfactants", "detergents"] },
  { id: "surfactant_chain_palm", label: "Palm Oil → Surfactants (fatty-alcohol route)", nodeIds: ["cpo", "hydrolysis", "fatty_acid", "glycerine", "fatty_alcohol", "surfactants", "detergents"] },
  { id: "glycerine_chain", label: "Glycerine → Epoxy Resins", nodeIds: ["glycerine", "epichlorohydrin", "epoxy_resins"] },
];
