import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * Supply Chains engine (V3 §24 of engine list), anchored on the NY Fed's own
 * purpose-built Global Supply Chain Pressure Index — a Tier-1, official,
 * single authoritative composite of shipping/freight/PMI supply-chain
 * indicators across the major economies feeding global trade. GSCPI itself
 * has no published country/region breakdown (checked its own downloadable
 * workbook directly — only the composite is in there), so a genuine G7+China
 * breakdown means separate national data, not decomposing GSCPI itself.
 *
 * Each country's proxy is the best free, official, verified series found —
 * not all the same *kind* of series, and that's disclosed rather than
 * papered over:
 * - US, Germany, France, Italy: OECD Business Tendency Survey "Order
 *   Books: Current" (a net-balance survey — % reporting above-normal minus
 *   % reporting below-normal), mirrored on FRED. Rising backlogs relative
 *   to normal is a capacity/delivery-strain signal.
 * - Japan: no Order Books series exists in this dataset for Japan, so
 *   "Finished Goods Stocks: Current" is used instead (also FRED/OECD BTS) —
 *   a related but distinct concept (unsold/unshipped goods piling up,
 *   which happened during the 2021-22 chip-shortage period specifically
 *   because production couldn't ship, not just because demand was weak).
 * - Canada: StatCan's own manufacturing inventory-to-sales ratio, direct
 *   from Statistics Canada's API (the FRED/OECD mirror for Canada stopped
 *   updating in 2023; StatCan itself is still current).
 * - China: NBS's own PMI supplier-delivery-time subindex, via the same
 *   English press releases already used for property sales/PMI new orders.
 * - UK: still genuinely uncovered. The UK's own OECD-submitted Order Books
 *   and Finished Goods Stocks series were both discontinued in March 2021,
 *   and the UK's real-world equivalent — the CBI Industrial Trends Survey —
 *   is behind Cloudflare bot-protection on cbi.org.uk, which this project
 *   will not work around. Not silently dropped: this is the one remaining
 *   G7 gap, disclosed here and on the methodology page.
 */
export async function runSupplyChainsEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [gscpi, usOrderBooks, germanyOrderBooks, franceOrderBooks, italyOrderBooks, japanFinishedGoods, canadaInventorySales, chinaDeliveryTime] = await Promise.all([
    buildIndicator(ctx.db, "supplychain.gscpi", "NY Fed Global Supply Chain Pressure Index", "leading", "monthly", "std_dev"),
    buildIndicator(ctx.db, "supplychain.us_order_books", "US Manufacturing Order Books (OECD BTS)", "leading", "monthly", "% balance"),
    buildIndicator(ctx.db, "supplychain.germany_order_books", "Germany Manufacturing Order Books (OECD BTS)", "leading", "monthly", "% balance"),
    buildIndicator(ctx.db, "supplychain.france_order_books", "France Manufacturing Order Books (OECD BTS)", "leading", "monthly", "% balance"),
    buildIndicator(ctx.db, "supplychain.italy_order_books", "Italy Manufacturing Order Books (OECD BTS)", "leading", "monthly", "% balance"),
    buildIndicator(ctx.db, "supplychain.japan_finished_goods_stocks", "Japan Manufacturing Finished Goods Stocks (OECD BTS)", "leading", "quarterly", "% balance"),
    buildIndicator(ctx.db, "supplychain.canada_inventory_sales_ratio", "Canada Manufacturing Inventory/Sales Ratio (StatCan)", "leading", "monthly", "ratio"),
    buildIndicator(ctx.db, "supplychain.china_supplier_delivery_time", "China PMI Supplier Delivery Time (NBS)", "leading", "monthly", "index"),
  ]);

  return composeEngineResult({
    engineKey: "supply_chains",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["BELOW_AVERAGE", "NORMAL", "BUILDING_PRESSURE", "ELEVATED_PRESSURE", "SEVERE_DISRUPTION"],
    inputs: [
      { ref: gscpi.ref, series: gscpi.series, weight: 1.4, zDirection: 1 },
      { ref: usOrderBooks.ref, series: usOrderBooks.series, weight: 0.6, zDirection: 1 },
      { ref: germanyOrderBooks.ref, series: germanyOrderBooks.series, weight: 0.5, zDirection: 1 },
      { ref: franceOrderBooks.ref, series: franceOrderBooks.series, weight: 0.4, zDirection: 1 },
      { ref: italyOrderBooks.ref, series: italyOrderBooks.series, weight: 0.4, zDirection: 1 },
      { ref: japanFinishedGoods.ref, series: japanFinishedGoods.series, weight: 0.4, zDirection: 1 },
      { ref: canadaInventorySales.ref, series: canadaInventorySales.series, weight: 0.4, zDirection: -1 },
      { ref: chinaDeliveryTime.ref, series: chinaDeliveryTime.series, weight: 0.6, zDirection: -1 },
    ],
    triggerDesc:
      "The GSCPI is constructed from shipping costs, delivery times and PMI supply-chain sub-components; a sustained rise (not a single-month blip) has historically led goods-price inflation by one to two quarters. Corroborating this with rising manufacturing order-book backlogs across the US/Germany/France/Italy, a weakening China PMI delivery-time subindex, and inventory buildups in Japan/Canada distinguishes a genuine, broad-based supply-chain event from noise in any single country's data.",
    transmissionMechanism:
      "Supply-chain pressure raises input costs and delivery times for goods-producing firms, which passes through to consumer goods prices and can force central banks into a tighter policy stance to contain the inflationary impulse.",
    amplifiers: ["Simultaneous Energy engine shock (shipping fuel costs)", "Simultaneous Geopolitical engine escalation (chokepoint disruption)", "Simultaneous China engine deterioration (China is a dominant node in most global supply chains)"],
    invalidationConditions: ["GSCPI declines back toward zero (its historical-average level)", "Order-book backlogs and delivery-time pressure normalize across the tracked countries"],
    confirmationConditions: ["Goods-price inflation components confirm the GSCPI move with the typical one-to-two-quarter lag"],
    notYetHappened: ["No confirmed sustained GSCPI breakout beyond its trailing range"],
    contradictoryEvidence: ["The UK has no live free supply-chain-pressure proxy tracked here — its OECD-submitted series were discontinued in 2021 and the CBI's own survey site is bot-protected — so a UK-specific disruption could exist without showing up in this engine's country-level inputs (though it would still likely move the global GSCPI)."],
    methodologyVersion: "v0.2-freedata-g7-china",
  });
}
