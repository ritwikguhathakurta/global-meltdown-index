/**
 * Country-level balance sheets for Grains / Soft Commodities / Livestock
 * (via USDA PSD) and country-level mine/smelter PRODUCTION for Base Metals /
 * Precious Metals / Critical Minerals / Fertilizers (via USGS's National
 * Minerals Information Center Mineral Commodity Summaries bulk data
 * release — see usgsMineralCommodities.ts).
 *
 * USDA PSD entries generalize the Oilseeds engine's Soybean Country Balance
 * Sheet (oilseedsTaxonomy.ts/oilseedsCountry.ts): country lists and PSD
 * country codes were derived from a live download+parse of the USDA PSD
 * bulk file, ranking every reporting country by its latest-marketing-year
 * Production figure and keeping the top 8-10.
 *
 * USGS entries were derived the same way — a live download+parse of USGS's
 * MCS2026 bulk CSV (sciencebase.gov item 69837e43b66b01367d7ec7c7),
 * "World Mine [and Refinery/Smelter] Production and Reserves" sections,
 * ranking reporting countries by latest-year value and keeping the top 10
 * (or fewer, where USGS itself reports fewer than 10 individually — e.g.
 * Platinum only breaks out 5 countries, lumping the rest into "Other
 * countries"). Unlike USDA PSD's ~40-60-year annual series, USGS's MCS is a
 * CURRENT-YEAR SUMMARY publication: the bulk file only carries the latest
 * two years (2024/2025 as of this build) per commodity, not a long
 * historical run — and it publishes PRODUCTION ONLY, no
 * imports/exports/consumption/ending-stocks, so apparent
 * consumption/stocks-to-use/classification will read "—" for every USGS-
 * sourced row in the generic country-balance engine (commodityCountryBalance.ts),
 * which degrades gracefully to nulls rather than fabricating an identity
 * USGS doesn't publish the inputs for.
 */

export type CountryBalanceCountryDef = {
  /** USDA PSD entries only — that source's own country code. */
  psdCountryCode?: string;
  /** USGS MCS entries only — the exact "Country" value in the bulk CSV. */
  csvCountryName?: string;
  /** usgs_mcs entries only — verified live against comtradeapi.un.org's own
   * Reporters reference list (M49 numeric code), used to fetch real
   * imports/exports for the metals/fertilizers USGS itself only reports
   * production for. */
  comtradeM49Code?: string;
  slug: string;
  label: string;
};

export type CountryBalanceCommodityDef = {
  source: "usda_psd" | "usgs_mcs";
  /** usda_psd only — USDA's own Commodity_Code. */
  psdCode?: string;
  /** usgs_mcs only — the exact "Commodity" value in the MCS bulk CSV. */
  csvCommodity?: string;
  /** usgs_mcs only — the exact "Statistics_detail" value for country-level (non-rounded) rows. */
  csvDetail?: string;
  /** usgs_mcs entries only — UN Comtrade HS code for this commodity's
   * dominant internationally-traded product form, live-verified against a
   * major producer's real trade data before being chosen (see
   * unComtradeCommodityTrade.ts's own doc comment for the basis caveats:
   * this is trade in a specific product FORM — e.g. unwrought metal, ore
   * concentrate, refined cathode — not a contained-metal-equivalent
   * conversion, and may differ from the USGS mine-production basis for
   * countries that process ore into a different form before export; e.g.
   * Indonesia/Philippines nickel shows small exports because they convert
   * most mine output domestically rather than exporting unwrought metal). */
  comtradeHsCodes?: string[];
  slug: string;
  label: string;
  category: "Grains" | "Soft Commodities" | "Livestock / Dairy" | "Base Metals" | "Precious Metals" | "Critical Minerals" | "Fertilizers";
  unit: string;
  countries: CountryBalanceCountryDef[];
};

export const COUNTRY_BALANCE_COMMODITIES: CountryBalanceCommodityDef[] = [
  {
    source: "usda_psd",
    psdCode: "0410000",
    slug: "wheat",
    label: "Wheat",
    category: "Grains",
    unit: "million MT",
    countries: [
      { psdCountryCode: "CH", slug: "china", label: "China" },
      { psdCountryCode: "E4", slug: "european_union", label: "European Union" },
      { psdCountryCode: "IN", slug: "india", label: "India" },
      { psdCountryCode: "RS", slug: "russia", label: "Russia" },
      { psdCountryCode: "US", slug: "united_states", label: "United States" },
      { psdCountryCode: "CA", slug: "canada", label: "Canada" },
      { psdCountryCode: "AS", slug: "australia", label: "Australia" },
      { psdCountryCode: "PK", slug: "pakistan", label: "Pakistan" },
      { psdCountryCode: "UP", slug: "ukraine", label: "Ukraine" },
      { psdCountryCode: "TU", slug: "turkey", label: "Turkey" },
    ],
  },
  {
    source: "usda_psd",
    psdCode: "0440000",
    slug: "maize",
    label: "Corn (Maize)",
    category: "Grains",
    unit: "million MT",
    countries: [
      { psdCountryCode: "US", slug: "united_states", label: "United States" },
      { psdCountryCode: "CH", slug: "china", label: "China" },
      { psdCountryCode: "BR", slug: "brazil", label: "Brazil" },
      { psdCountryCode: "AR", slug: "argentina", label: "Argentina" },
      { psdCountryCode: "E4", slug: "european_union", label: "European Union" },
      { psdCountryCode: "IN", slug: "india", label: "India" },
      { psdCountryCode: "UP", slug: "ukraine", label: "Ukraine" },
      { psdCountryCode: "MX", slug: "mexico", label: "Mexico" },
      { psdCountryCode: "CA", slug: "canada", label: "Canada" },
      { psdCountryCode: "SF", slug: "south_africa", label: "South Africa" },
    ],
  },
  {
    source: "usda_psd",
    psdCode: "0422110",
    slug: "rice",
    label: "Rice, Milled (world)",
    category: "Grains",
    unit: "million MT",
    countries: [
      { psdCountryCode: "CH", slug: "china", label: "China" },
      { psdCountryCode: "IN", slug: "india", label: "India" },
      { psdCountryCode: "BG", slug: "bangladesh", label: "Bangladesh" },
      { psdCountryCode: "ID", slug: "indonesia", label: "Indonesia" },
      { psdCountryCode: "VM", slug: "vietnam", label: "Vietnam" },
      { psdCountryCode: "TH", slug: "thailand", label: "Thailand" },
      { psdCountryCode: "RP", slug: "philippines", label: "Philippines" },
      { psdCountryCode: "BM", slug: "myanmar", label: "Myanmar (Burma)" },
      { psdCountryCode: "PK", slug: "pakistan", label: "Pakistan" },
      { psdCountryCode: "CB", slug: "cambodia", label: "Cambodia" },
    ],
  },
  {
    source: "usda_psd",
    psdCode: "2631000",
    slug: "cotton",
    label: "Cotton",
    category: "Soft Commodities",
    unit: "million 480-lb bales",
    countries: [
      { psdCountryCode: "CH", slug: "china", label: "China" },
      { psdCountryCode: "IN", slug: "india", label: "India" },
      { psdCountryCode: "BR", slug: "brazil", label: "Brazil" },
      { psdCountryCode: "US", slug: "united_states", label: "United States" },
      { psdCountryCode: "PK", slug: "pakistan", label: "Pakistan" },
      { psdCountryCode: "UZ", slug: "uzbekistan", label: "Uzbekistan" },
      { psdCountryCode: "AS", slug: "australia", label: "Australia" },
      { psdCountryCode: "TU", slug: "turkey", label: "Turkey" },
    ],
  },
  {
    source: "usda_psd",
    psdCode: "0612000",
    slug: "sugar_world",
    label: "Sugar, World",
    category: "Soft Commodities",
    unit: "million MT",
    countries: [
      { psdCountryCode: "BR", slug: "brazil", label: "Brazil" },
      { psdCountryCode: "IN", slug: "india", label: "India" },
      { psdCountryCode: "E4", slug: "european_union", label: "European Union" },
      { psdCountryCode: "CH", slug: "china", label: "China" },
      { psdCountryCode: "TH", slug: "thailand", label: "Thailand" },
      { psdCountryCode: "US", slug: "united_states", label: "United States" },
      { psdCountryCode: "PK", slug: "pakistan", label: "Pakistan" },
      { psdCountryCode: "RS", slug: "russia", label: "Russia" },
      { psdCountryCode: "MX", slug: "mexico", label: "Mexico" },
      { psdCountryCode: "AS", slug: "australia", label: "Australia" },
    ],
  },
  {
    source: "usda_psd",
    psdCode: "0711100",
    slug: "coffee",
    label: "Coffee, Green (world)",
    category: "Soft Commodities",
    unit: "million 60kg bags",
    countries: [
      { psdCountryCode: "BR", slug: "brazil", label: "Brazil" },
      { psdCountryCode: "VM", slug: "vietnam", label: "Vietnam" },
      { psdCountryCode: "CO", slug: "colombia", label: "Colombia" },
      { psdCountryCode: "ET", slug: "ethiopia", label: "Ethiopia" },
      { psdCountryCode: "ID", slug: "indonesia", label: "Indonesia" },
      { psdCountryCode: "UG", slug: "uganda", label: "Uganda" },
      { psdCountryCode: "IN", slug: "india", label: "India" },
      { psdCountryCode: "HO", slug: "honduras", label: "Honduras" },
    ],
  },
  {
    source: "usda_psd",
    psdCode: "0111000",
    slug: "beef",
    label: "Beef",
    category: "Livestock / Dairy",
    unit: "million MT (carcass wt.)",
    countries: [
      { psdCountryCode: "BR", slug: "brazil", label: "Brazil" },
      { psdCountryCode: "US", slug: "united_states", label: "United States" },
      { psdCountryCode: "CH", slug: "china", label: "China" },
      { psdCountryCode: "E4", slug: "european_union", label: "European Union" },
      { psdCountryCode: "IN", slug: "india", label: "India" },
      { psdCountryCode: "AR", slug: "argentina", label: "Argentina" },
      { psdCountryCode: "AS", slug: "australia", label: "Australia" },
      { psdCountryCode: "MX", slug: "mexico", label: "Mexico" },
    ],
  },
  {
    source: "usda_psd",
    psdCode: "0115000",
    slug: "chicken",
    label: "Chicken",
    category: "Livestock / Dairy",
    unit: "million MT",
    countries: [
      { psdCountryCode: "US", slug: "united_states", label: "United States" },
      { psdCountryCode: "CH", slug: "china", label: "China" },
      { psdCountryCode: "BR", slug: "brazil", label: "Brazil" },
      { psdCountryCode: "E4", slug: "european_union", label: "European Union" },
      { psdCountryCode: "RS", slug: "russia", label: "Russia" },
      { psdCountryCode: "MX", slug: "mexico", label: "Mexico" },
      { psdCountryCode: "TH", slug: "thailand", label: "Thailand" },
      { psdCountryCode: "TU", slug: "turkey", label: "Turkey" },
    ],
  },
  {
    source: "usda_psd",
    psdCode: "0113000",
    slug: "pork",
    label: "Pork (Swine)",
    category: "Livestock / Dairy",
    unit: "million MT (carcass wt.)",
    countries: [
      { psdCountryCode: "CH", slug: "china", label: "China" },
      { psdCountryCode: "E4", slug: "european_union", label: "European Union" },
      { psdCountryCode: "US", slug: "united_states", label: "United States" },
      { psdCountryCode: "BR", slug: "brazil", label: "Brazil" },
      { psdCountryCode: "RS", slug: "russia", label: "Russia" },
      { psdCountryCode: "VM", slug: "vietnam", label: "Vietnam" },
      { psdCountryCode: "CA", slug: "canada", label: "Canada" },
      { psdCountryCode: "KS", slug: "south_korea", label: "South Korea" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Gold",
    csvDetail: "Mine production",
    slug: "gold", comtradeHsCodes: ["7108"],
    label: "Gold",
    category: "Precious Metals",
    unit: "metric tons",
    countries: [
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "Australia", comtradeM49Code: "36", slug: "australia", label: "Australia" },
      { csvCountryName: "Canada", comtradeM49Code: "124", slug: "canada", label: "Canada" },
      { csvCountryName: "United States", comtradeM49Code: "842", slug: "united_states", label: "United States" },
      { csvCountryName: "Ghana", comtradeM49Code: "288", slug: "ghana", label: "Ghana" },
      { csvCountryName: "Mexico", comtradeM49Code: "484", slug: "mexico", label: "Mexico" },
      { csvCountryName: "Kazakhstan", comtradeM49Code: "398", slug: "kazakhstan", label: "Kazakhstan" },
      { csvCountryName: "Uzbekistan", comtradeM49Code: "860", slug: "uzbekistan", label: "Uzbekistan" },
      { csvCountryName: "Peru", comtradeM49Code: "604", slug: "peru", label: "Peru" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Silver",
    csvDetail: "Mine production",
    slug: "silver", comtradeHsCodes: ["7106"],
    label: "Silver",
    category: "Precious Metals",
    unit: "metric tons",
    countries: [
      { csvCountryName: "Mexico", comtradeM49Code: "484", slug: "mexico", label: "Mexico" },
      { csvCountryName: "Peru", comtradeM49Code: "604", slug: "peru", label: "Peru" },
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Bolivia", comtradeM49Code: "68", slug: "bolivia", label: "Bolivia" },
      { csvCountryName: "Chile", comtradeM49Code: "152", slug: "chile", label: "Chile" },
      { csvCountryName: "Poland", comtradeM49Code: "616", slug: "poland", label: "Poland" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "United States", comtradeM49Code: "842", slug: "united_states", label: "United States" },
      { csvCountryName: "Australia", comtradeM49Code: "36", slug: "australia", label: "Australia" },
      { csvCountryName: "Argentina", comtradeM49Code: "32", slug: "argentina", label: "Argentina" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Platinum",
    csvDetail: "Mine production: Platinum",
    slug: "platinum", comtradeHsCodes: ["7110"],
    label: "Platinum",
    category: "Precious Metals",
    unit: "kilograms",
    countries: [
      { csvCountryName: "South Africa", comtradeM49Code: "710", slug: "south_africa", label: "South Africa" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "Zimbabwe", comtradeM49Code: "716", slug: "zimbabwe", label: "Zimbabwe" },
      { csvCountryName: "Canada", comtradeM49Code: "124", slug: "canada", label: "Canada" },
      { csvCountryName: "United States", comtradeM49Code: "842", slug: "united_states", label: "United States" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Cobalt",
    csvDetail: "Mine production",
    slug: "cobalt", comtradeHsCodes: ["8105"],
    label: "Cobalt",
    category: "Critical Minerals",
    unit: "metric tons",
    countries: [
      { csvCountryName: "Congo (Kinshasa)", comtradeM49Code: "180", slug: "drc", label: "Congo (Kinshasa)" },
      { csvCountryName: "Indonesia", comtradeM49Code: "360", slug: "indonesia", label: "Indonesia" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "Madagascar", comtradeM49Code: "450", slug: "madagascar", label: "Madagascar" },
      { csvCountryName: "Australia", comtradeM49Code: "36", slug: "australia", label: "Australia" },
      { csvCountryName: "Philippines", comtradeM49Code: "608", slug: "philippines", label: "Philippines" },
      { csvCountryName: "Canada", comtradeM49Code: "124", slug: "canada", label: "Canada" },
      { csvCountryName: "Papua New Guinea", comtradeM49Code: "598", slug: "papua_new_guinea", label: "Papua New Guinea" },
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Cuba", comtradeM49Code: "192", slug: "cuba", label: "Cuba" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Lithium",
    csvDetail: "Mine production",
    slug: "lithium", comtradeHsCodes: ["283691"],
    label: "Lithium",
    category: "Critical Minerals",
    unit: "metric tons",
    countries: [
      { csvCountryName: "Australia", comtradeM49Code: "36", slug: "australia", label: "Australia" },
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Chile", comtradeM49Code: "152", slug: "chile", label: "Chile" },
      { csvCountryName: "Zimbabwe", comtradeM49Code: "716", slug: "zimbabwe", label: "Zimbabwe" },
      { csvCountryName: "Argentina", comtradeM49Code: "32", slug: "argentina", label: "Argentina" },
      { csvCountryName: "Brazil", comtradeM49Code: "76", slug: "brazil", label: "Brazil" },
      { csvCountryName: "Mali", comtradeM49Code: "466", slug: "mali", label: "Mali" },
      { csvCountryName: "Canada", comtradeM49Code: "124", slug: "canada", label: "Canada" },
      { csvCountryName: "Portugal", comtradeM49Code: "620", slug: "portugal", label: "Portugal" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Manganese",
    csvDetail: "Mine production",
    slug: "manganese", comtradeHsCodes: ["2602"],
    label: "Manganese",
    category: "Critical Minerals",
    unit: "thousand metric tons",
    countries: [
      { csvCountryName: "South Africa", comtradeM49Code: "710", slug: "south_africa", label: "South Africa" },
      { csvCountryName: "Gabon", comtradeM49Code: "266", slug: "gabon", label: "Gabon" },
      { csvCountryName: "Ghana", comtradeM49Code: "288", slug: "ghana", label: "Ghana" },
      { csvCountryName: "Australia", comtradeM49Code: "36", slug: "australia", label: "Australia" },
      { csvCountryName: "Brazil", comtradeM49Code: "76", slug: "brazil", label: "Brazil" },
      { csvCountryName: "India", comtradeM49Code: "699", slug: "india", label: "India" },
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Côte d’Ivoire", comtradeM49Code: "384", slug: "cote_divoire", label: "Côte d'Ivoire" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Molybdenum",
    csvDetail: "Mine production",
    slug: "molybdenum", comtradeHsCodes: ["2613"],
    label: "Molybdenum",
    category: "Critical Minerals",
    unit: "metric tons",
    countries: [
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Chile", comtradeM49Code: "152", slug: "chile", label: "Chile" },
      { csvCountryName: "United States", comtradeM49Code: "842", slug: "united_states", label: "United States" },
      { csvCountryName: "Peru", comtradeM49Code: "604", slug: "peru", label: "Peru" },
      { csvCountryName: "Mexico", comtradeM49Code: "484", slug: "mexico", label: "Mexico" },
      { csvCountryName: "Armenia", comtradeM49Code: "51", slug: "armenia", label: "Armenia" },
      { csvCountryName: "Kazakhstan", comtradeM49Code: "398", slug: "kazakhstan", label: "Kazakhstan" },
      { csvCountryName: "Mongolia", comtradeM49Code: "496", slug: "mongolia", label: "Mongolia" },
      { csvCountryName: "Iran", comtradeM49Code: "364", slug: "iran", label: "Iran" },
      { csvCountryName: "Canada", comtradeM49Code: "124", slug: "canada", label: "Canada" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Vanadium",
    csvDetail: "Mine production",
    slug: "vanadium_pentoxide", comtradeHsCodes: ["282530"],
    label: "Vanadium",
    category: "Critical Minerals",
    unit: "metric tons",
    countries: [
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "Brazil", comtradeM49Code: "76", slug: "brazil", label: "Brazil" },
      { csvCountryName: "South Africa", comtradeM49Code: "710", slug: "south_africa", label: "South Africa" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Rare Earths",
    csvDetail: "Mine production",
    slug: "rare_earth_elements", comtradeHsCodes: ["2846"],
    label: "Rare Earth Elements",
    category: "Critical Minerals",
    unit: "metric tons",
    countries: [
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "United States", comtradeM49Code: "842", slug: "united_states", label: "United States" },
      { csvCountryName: "Australia", comtradeM49Code: "36", slug: "australia", label: "Australia" },
      { csvCountryName: "Burma", comtradeM49Code: "104", slug: "myanmar", label: "Myanmar (Burma)" },
      { csvCountryName: "Thailand", comtradeM49Code: "764", slug: "thailand", label: "Thailand" },
      { csvCountryName: "India", comtradeM49Code: "699", slug: "india", label: "India" },
      { csvCountryName: "Madagascar", comtradeM49Code: "450", slug: "madagascar", label: "Madagascar" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "Brazil", comtradeM49Code: "76", slug: "brazil", label: "Brazil" },
      { csvCountryName: "Nigeria", comtradeM49Code: "566", slug: "nigeria", label: "Nigeria" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Nickel",
    csvDetail: "Mine production",
    slug: "nickel", comtradeHsCodes: ["7502"],
    label: "Nickel",
    category: "Base Metals",
    unit: "metric tons",
    countries: [
      { csvCountryName: "Indonesia", comtradeM49Code: "360", slug: "indonesia", label: "Indonesia" },
      { csvCountryName: "Philippines", comtradeM49Code: "608", slug: "philippines", label: "Philippines" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "Canada", comtradeM49Code: "124", slug: "canada", label: "Canada" },
      { csvCountryName: "New Caledonia", comtradeM49Code: "540", slug: "new_caledonia", label: "New Caledonia" },
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Brazil", comtradeM49Code: "76", slug: "brazil", label: "Brazil" },
      { csvCountryName: "Australia", comtradeM49Code: "36", slug: "australia", label: "Australia" },
      { csvCountryName: "United States", comtradeM49Code: "842", slug: "united_states", label: "United States" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Tin",
    csvDetail: "Mine production",
    slug: "tin", comtradeHsCodes: ["8001"],
    label: "Tin",
    category: "Base Metals",
    unit: "metric tons",
    countries: [
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Indonesia", comtradeM49Code: "360", slug: "indonesia", label: "Indonesia" },
      { csvCountryName: "Peru", comtradeM49Code: "604", slug: "peru", label: "Peru" },
      { csvCountryName: "Brazil", comtradeM49Code: "76", slug: "brazil", label: "Brazil" },
      { csvCountryName: "Congo (Kinshasa)", comtradeM49Code: "180", slug: "drc", label: "Congo (Kinshasa)" },
      { csvCountryName: "Bolivia", comtradeM49Code: "68", slug: "bolivia", label: "Bolivia" },
      { csvCountryName: "Australia", comtradeM49Code: "36", slug: "australia", label: "Australia" },
      { csvCountryName: "Burma", comtradeM49Code: "104", slug: "myanmar", label: "Myanmar (Burma)" },
      { csvCountryName: "Vietnam", comtradeM49Code: "704", slug: "vietnam", label: "Vietnam" },
      { csvCountryName: "Malaysia", comtradeM49Code: "458", slug: "malaysia", label: "Malaysia" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Lead",
    csvDetail: "Mine production",
    slug: "lead", comtradeHsCodes: ["7801"],
    label: "Lead",
    category: "Base Metals",
    unit: "thousand metric tons",
    countries: [
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Australia", comtradeM49Code: "36", slug: "australia", label: "Australia" },
      { csvCountryName: "Peru", comtradeM49Code: "604", slug: "peru", label: "Peru" },
      { csvCountryName: "United States", comtradeM49Code: "842", slug: "united_states", label: "United States" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "India", comtradeM49Code: "699", slug: "india", label: "India" },
      { csvCountryName: "Mexico", comtradeM49Code: "484", slug: "mexico", label: "Mexico" },
      { csvCountryName: "Bolivia", comtradeM49Code: "68", slug: "bolivia", label: "Bolivia" },
      { csvCountryName: "Iran", comtradeM49Code: "364", slug: "iran", label: "Iran" },
      { csvCountryName: "Sweden", comtradeM49Code: "752", slug: "sweden", label: "Sweden" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Zinc",
    csvDetail: "Mine production",
    slug: "zinc", comtradeHsCodes: ["7901"],
    label: "Zinc",
    category: "Base Metals",
    unit: "thousand metric tons",
    countries: [
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Peru", comtradeM49Code: "604", slug: "peru", label: "Peru" },
      { csvCountryName: "Australia", comtradeM49Code: "36", slug: "australia", label: "Australia" },
      { csvCountryName: "India", comtradeM49Code: "699", slug: "india", label: "India" },
      { csvCountryName: "Mexico", comtradeM49Code: "484", slug: "mexico", label: "Mexico" },
      { csvCountryName: "United States", comtradeM49Code: "842", slug: "united_states", label: "United States" },
      { csvCountryName: "Bolivia", comtradeM49Code: "68", slug: "bolivia", label: "Bolivia" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "Kazakhstan", comtradeM49Code: "398", slug: "kazakhstan", label: "Kazakhstan" },
      { csvCountryName: "Sweden", comtradeM49Code: "752", slug: "sweden", label: "Sweden" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Aluminum",
    csvDetail: "Smelter production",
    slug: "aluminum", comtradeHsCodes: ["7601"],
    label: "Aluminium",
    category: "Base Metals",
    unit: "thousand metric tons",
    countries: [
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "India", comtradeM49Code: "699", slug: "india", label: "India" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "Canada", comtradeM49Code: "124", slug: "canada", label: "Canada" },
      { csvCountryName: "United Arab Emirates", comtradeM49Code: "784", slug: "uae", label: "United Arab Emirates" },
      { csvCountryName: "Bahrain", comtradeM49Code: "48", slug: "bahrain", label: "Bahrain" },
      { csvCountryName: "Australia", comtradeM49Code: "36", slug: "australia", label: "Australia" },
      { csvCountryName: "Norway", comtradeM49Code: "579", slug: "norway", label: "Norway" },
      { csvCountryName: "Brazil", comtradeM49Code: "76", slug: "brazil", label: "Brazil" },
      { csvCountryName: "Malaysia", comtradeM49Code: "458", slug: "malaysia", label: "Malaysia" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Iron Ore",
    csvDetail: "Mine production: Usable ore",
    slug: "iron_ore", comtradeHsCodes: ["2601"],
    label: "Iron Ore",
    category: "Base Metals",
    unit: "thousand metric tons",
    countries: [
      { csvCountryName: "Australia", comtradeM49Code: "36", slug: "australia", label: "Australia" },
      { csvCountryName: "Brazil", comtradeM49Code: "76", slug: "brazil", label: "Brazil" },
      { csvCountryName: "India", comtradeM49Code: "699", slug: "india", label: "India" },
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Iran", comtradeM49Code: "364", slug: "iran", label: "Iran" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "Canada", comtradeM49Code: "124", slug: "canada", label: "Canada" },
      { csvCountryName: "South Africa", comtradeM49Code: "710", slug: "south_africa", label: "South Africa" },
      { csvCountryName: "Ukraine", comtradeM49Code: "804", slug: "ukraine", label: "Ukraine" },
      { csvCountryName: "United States", comtradeM49Code: "842", slug: "united_states", label: "United States" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Copper",
    csvDetail: "Mine production",
    slug: "copper", comtradeHsCodes: ["7403"],
    label: "Copper",
    category: "Base Metals",
    unit: "thousand metric tons",
    countries: [
      { csvCountryName: "Chile", comtradeM49Code: "152", slug: "chile", label: "Chile" },
      { csvCountryName: "Congo (Kinshasa)", comtradeM49Code: "180", slug: "drc", label: "Congo (Kinshasa)" },
      { csvCountryName: "Peru", comtradeM49Code: "604", slug: "peru", label: "Peru" },
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "United States", comtradeM49Code: "842", slug: "united_states", label: "United States" },
      { csvCountryName: "Zambia", comtradeM49Code: "894", slug: "zambia", label: "Zambia" },
      { csvCountryName: "Australia", comtradeM49Code: "36", slug: "australia", label: "Australia" },
      { csvCountryName: "Indonesia", comtradeM49Code: "360", slug: "indonesia", label: "Indonesia" },
      { csvCountryName: "Kazakhstan", comtradeM49Code: "398", slug: "kazakhstan", label: "Kazakhstan" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Phosphate Rock",
    csvDetail: "Mine production",
    slug: "phosphate_rock", comtradeHsCodes: ["2510"],
    label: "Phosphate Rock",
    category: "Fertilizers",
    unit: "thousand metric tons",
    countries: [
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Morocco", comtradeM49Code: "504", slug: "morocco", label: "Morocco" },
      { csvCountryName: "United States", comtradeM49Code: "842", slug: "united_states", label: "United States" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "Jordan", comtradeM49Code: "400", slug: "jordan", label: "Jordan" },
      { csvCountryName: "Saudi Arabia", comtradeM49Code: "682", slug: "saudi_arabia", label: "Saudi Arabia" },
      { csvCountryName: "Egypt", comtradeM49Code: "818", slug: "egypt", label: "Egypt" },
      { csvCountryName: "Brazil", comtradeM49Code: "76", slug: "brazil", label: "Brazil" },
      { csvCountryName: "Peru", comtradeM49Code: "604", slug: "peru", label: "Peru" },
      { csvCountryName: "Tunisia", comtradeM49Code: "788", slug: "tunisia", label: "Tunisia" },
    ],
  },
  {
    source: "usgs_mcs",
    csvCommodity: "Potash",
    csvDetail: "Mine production",
    slug: "potassium_chloride", comtradeHsCodes: ["310420"],
    label: "Potash (Potassium Chloride)",
    category: "Fertilizers",
    unit: "thousand metric tons",
    countries: [
      { csvCountryName: "Canada", comtradeM49Code: "124", slug: "canada", label: "Canada" },
      { csvCountryName: "Russia", comtradeM49Code: "643", slug: "russia", label: "Russia" },
      { csvCountryName: "China", comtradeM49Code: "156", slug: "china", label: "China" },
      { csvCountryName: "Belarus", comtradeM49Code: "112", slug: "belarus", label: "Belarus" },
      { csvCountryName: "Germany", comtradeM49Code: "276", slug: "germany", label: "Germany" },
      { csvCountryName: "Laos", comtradeM49Code: "418", slug: "laos", label: "Laos" },
      { csvCountryName: "Israel", comtradeM49Code: "376", slug: "israel", label: "Israel" },
      { csvCountryName: "Jordan", comtradeM49Code: "400", slug: "jordan", label: "Jordan" },
      { csvCountryName: "Chile", comtradeM49Code: "152", slug: "chile", label: "Chile" },
      { csvCountryName: "United States", comtradeM49Code: "842", slug: "united_states", label: "United States" },
    ],
  },
];
