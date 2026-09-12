export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-sm leading-relaxed text-text-dim">
      <h1 className="mb-6 text-2xl font-semibold text-text">Methodology</h1>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-text">What this is (and isn&apos;t)</h2>
        <p>
          Global Meltdown Index is a leading-indicator systemic-risk terminal. Its core question is: what is changing now
          that could matter later? It is not a lagging market dashboard, and no score, regime label or
          scenario on this site is a forecast, prediction, or investment recommendation.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-text">Coverage in this phase</h2>
        <p>
          The full target specification defines 24 risk engines. This deployment currently implements 22
          as standalone engines, chosen because they can be fed entirely by free, official/public data:
          Global Dollar Liquidity, Credit Markets (fulfilling Corporate Credit), Equity Fragility (folding
          in Equity Valuation), Treasury &amp; Sovereign Debt covering the US plus the rest of the G7 and a
          China proxy (fulfilling Global Sovereign Debt — see{" "}
          <a href="#country-coverage" className="text-accent hover:underline">Country coverage</a>{" "}
          below), Carry Trade Stress, Banking, Property/CRE, Emerging-Market Debt, Energy, Geopolitical,
          Derivatives/Leverage, Crypto/Stablecoins, Cyber/Infrastructure, Trade/Economic Policy, Supply
          Chains, Market Concentration, Private Credit, AI Financial Sustainability, AI Valuation, AI
          Credit/Financing and AI Debt Maturity Wall — plus partial China and India Market Regime engines
          (both are explicitly missing indicators the full spec calls for; each engine page lists exactly
          which ones under &ldquo;UNAVAILABLE&rdquo;). Market Concentration and Private Credit are both
          market-price proxies (equal-weight-vs-cap-weight ETF ratios, and publicly-traded BDC share
          prices, respectively) rather than the structural weights/AUM/covenant data the spec envisions,
          since no free source publishes that data at all. The four AI engines run on real SEC EDGAR XBRL
          quarterly filings for 8 large-cap companies central to AI capex (Microsoft, Alphabet, Amazon,
          Meta, Oracle, Nvidia, AMD, Broadcom) — see{" "}
          <a href="#ai-engines-methodology" className="text-accent hover:underline">AI engines methodology</a>{" "}
          below for exactly how those figures are extracted and what each ratio does and doesn&apos;t
          measure. The one engine deliberately NOT built is AI Circular Financing — V3&apos;s own
          instruction for that engine is &ldquo;never infer undisclosed relationships as fact&rdquo;, and
          no free source publishes the equity-investment/purchase-commitment/SPV web it asks for, so
          building it would mean guessing at exactly the kind of relationship the spec warns against.
          Also not yet implemented: a standalone Central-Bank Policy composite (needs the
          hawkish/dovish NLP classifier, deferred — see README). A separate G7 Sovereign Debt deep-dive
          page (three scores per country, a 7-stage crisis model) sits alongside the Treasury engine rather
          than replacing or double-counting it — see{" "}
          <a href="#g7-sovereign-debt" className="text-accent hover:underline">G7 Sovereign Debt</a>{" "}
          below. Likewise, a broader Global Carry Trade Risk page (4 funding currencies x 17 target
          currencies, a fragility score and 7-stage crisis model per pair) sits alongside the
          GFMI-weighted &ldquo;yen_carry&rdquo; engine, which was itself broadened to the same 4
          funding currencies rather than being replaced or double-counted — see{" "}
          <a href="#global-carry-trade" className="text-accent hover:underline">Global Carry Trade</a>{" "}
          below. A country-level Global Banking Systemic Risk page (capital/credit/funding/liquidity/
          market tracking across nine banking systems) similarly sits alongside the GFMI-weighted
          &ldquo;banking&rdquo; engine, which is unchanged — see{" "}
          <a href="#global-banking-systemic-risk" className="text-accent hover:underline">Global Banking Systemic Risk</a>{" "}
          below. A country-level Global Liquidity Systemic Risk layer (central-bank reserves/repo-spread/
          bond-and-FX-volatility tracking across the same nine countries), a separate BIS-sourced Global
          Dollar/Euro/Yen Liquidity Index, an FSB-sourced NBFI monitoring panel, and a cross-engine
          Liquidity Transmission panel similarly sit alongside the GFMI-weighted &ldquo;global_liquidity&rdquo;
          engine and its per-bank Ample/Adequate/Deficit classifier, both unchanged — see{" "}
          <a href="#global-liquidity-systemic-risk" className="text-accent hover:underline">Global Liquidity Systemic Risk</a>{" "}
          below.
          None of these are faked with placeholder scores; they simply don&apos;t appear until real data backs them.
          Two further engines beyond the original 24-engine spec were added on request — India Liquidity and
          India Yield Curve, both India-specific reads distinct from India Market Regime — see{" "}
          <a href="#india-yield-curve-ccil" className="text-accent hover:underline">India Yield Curve, and why CCIL is not used</a>{" "}
          below.
        </p>
      </section>

      <section className="mb-8" id="ai-engines-methodology">
        <h2 className="mb-2 text-base font-semibold text-text">AI engines methodology</h2>
        <p className="mb-2">
          All four AI engines share one data pipeline (<code className="gfew-mono">src/lib/sources/secEdgar.ts</code>,{" "}
          <code className="gfew-mono">src/lib/engines/aiCompanyMetrics.ts</code>) pulling quarterly XBRL
          filings for Microsoft, Alphabet, Amazon, Meta, Oracle, Nvidia, AMD and Broadcom directly from
          SEC EDGAR&apos;s free company-facts API — no scraping, no paid data provider. Two real
          correctness problems were found and fixed before this shipped, not left as silent bugs:
        </p>
        <p className="mb-2">
          <strong className="text-text">Tag drift.</strong> Companies change which XBRL tag they use for
          the same concept over time — Microsoft stopped tagging <code className="gfew-mono">CostOfRevenue</code> in
          2018, and Alphabet&apos;s <code className="gfew-mono">RevenueFromContractWithCustomerExcludingAssessedTax</code> tag
          went stale in 2025 while it kept reporting the plain <code className="gfew-mono">Revenues</code> tag.
          A naive &ldquo;first tag that returns any data&rdquo; approach would have silently locked onto a
          value years out of date. Every concept is instead resolved by comparing all candidate tags and
          taking whichever has the most recent reporting period.
        </p>
        <p>
          <strong className="text-text">YTD vs. discrete quarters.</strong> Cash-flow-statement items
          (operating cash flow, capex, depreciation) are reported as year-to-date cumulative figures in
          most companies&apos; 10-Qs, not standalone quarters — income-statement items usually are
          discrete. Figures are de-cumulated by grouping filings that share the same fiscal-year start
          date and taking successive differences, which also recovers the fourth quarter (never
          separately filed) as full-year total minus the nine-month figure. EBITDA is a proxy (operating
          income + depreciation from the cash-flow statement), not each company&apos;s own
          &ldquo;Adjusted EBITDA&rdquo; definition, and AI Valuation uses trailing (not forward) P/E since
          forward-earnings estimates are analyst-consensus data behind paid terminals. Nvidia does not
          tag a debt-maturity schedule at all, so it is marked <code className="gfew-mono">UNAVAILABLE</code> on
          the AI Debt Maturity Wall page rather than assumed to have no near-term maturities.
        </p>
      </section>

      <section className="mb-8" id="country-coverage">
        <h2 className="mb-2 text-base font-semibold text-text">Country coverage: G7 + China, not just the US</h2>
        <p>
          Every engine that can be extended across the G7 (US, Canada, UK, Germany, France, Italy, Japan)
          plus China with a single free, methodologically-consistent source is: Equity Fragility tracks
          the S&amp;P 500, Nasdaq, Russell 2000, Nikkei 225, DAX, FTSE 100, CAC 40, FTSE MIB, the
          S&amp;P/TSX Composite and the Shanghai Composite together; Property/CRE is built on the BIS
          real house-price index computed the same way for all eight economies; Treasury &amp; Sovereign
          Debt covers US 2Y/10Y/30Y yields and debt/GDP alongside UK/Germany/France/Italy/Japan/Canada/China
          10Y yields and debt/GDP, the Italy-Germany spread, and China&apos;s 3-month interbank rate as an
          additional funding-stress proxy. UK, Germany, Canada, Japan and China&apos;s 10Y yields all come
          directly from their own central bank, finance ministry or central depository (Bank of England,
          Bundesbank, Bank of Canada, Japan&apos;s Ministry of Finance, and — for China — ChinaBond/CCDC,
          the PBOC-designated central bond depository, whose government bond yield curve is the standard
          benchmark cited internationally as China&apos;s sovereign yield) rather than a FRED/OECD monthly
          proxy, each publishing daily with only a few days&apos; lag — a real freshness upgrade. Japan&apos;s
          own Ministry of Finance publishes a free daily JGB yield curve (1Y-40Y, back to 1974) as two plain
          CSV files — a historical archive plus a rolling current-month file — found directly on its own
          site, closing what had been a 2-4-month-stale proxy. China&apos;s case closes what had been treated
          as a genuine data gap entirely (no FRED, OECD or BIS series covers it at all; finding it required
          looking directly at CCDC&apos;s own site, not the usual multilateral aggregators). Italy and
          France still use the FRED/OECD monthly proxy: no equally clean free daily alternative was found
          for Italy, and France&apos;s own daily rate (the TEC 10 / CNO-TEC® index published by Agence
          France Trésor) is explicitly Euronext-licensed — its own publisher page states the values &ldquo;may
          not be redistributed, sub-licensed or used for commercial purposes... without the prior written
          authorisation of Euronext Paris&rdquo;, the same category of restriction this project already
          declines to route around for CCIL&apos;s India debt-market data (see below) — so it is not used.
          Credit adds Euro-area
          high-yield spreads and an Asia-Pacific EM
          corporate spread (which includes but isn&apos;t exclusively China) alongside US HY/IG/EM; and
          Global Liquidity now covers all of G7 + China — the ECB (Germany/France/Italy), BOJ, BoE and BoC
          balance-sheet/reserve measures alongside the Fed, plus China&apos;s 3-month interbank rate as a
          rate-side proxy (see &ldquo;Liquidity: G7 + China, and a separate India Liquidity engine&rdquo;
          below, which also covers the new standalone India Liquidity tab, and &ldquo;India Yield Curve,
          and why CCIL is not used&rdquo; for the new India-specific sovereign-curve tab). The
          standalone China engine itself adds the 10Y yield, debt/GDP ratio, 3-month interbank rate, real
          house-price index and Shanghai Composite on top of its existing exports/imports/CNY/CPI tracking —
          plus, as of this update, property sales, a credit-impulse proxy, PMI new orders, LGFV-inclusive
          augmented debt and a developer-financing proxy (see &ldquo;China: closing the
          property/credit/PMI/LGFV/financing gap&rdquo; below) — every indicator the V3 spec calls for
          except individual developer default events, which no free source tracks in structured form.
          Supply Chains was, until this update, a single global NY Fed GSCPI number with no country
          breakdown (GSCPI itself publishes no such breakdown — checked its own workbook directly); it now
          adds country-level proxies for six of the eight G7+China economies (see &ldquo;Supply Chains:
          from one global number to G7+China&rdquo; below) — the UK is the one economy still genuinely
          uncovered, disclosed there rather than silently dropped.
          Carry Trade Stress (formerly &ldquo;Yen Carry Stress&rdquo;) was JPY-specific by definition
          until broadened to also track CHF, EUR and USD as funding currencies — see{" "}
          <a href="#global-carry-trade" className="text-accent hover:underline">Global Carry Trade</a>{" "}
          below. The GFMI-weighted Banking engine itself remains single-country-anchored (US
          delinquency/charge-off/CRE data plus Euro-area/UK funding-cost context) because no free source
          publishes bank-level NPL/delinquency data for the UK, Eurozone, Canada or Japan — it adds
          whatever real G7 context does exist (policy rates) rather than fabricating data that
          doesn&apos;t exist for free. A separate Global Banking Systemic Risk page now covers
          capital/credit/funding/liquidity/market conditions across nine countries using cross-country
          proxies instead (World Bank ratios, bank-sector equity indices) — see{" "}
          <a href="#global-banking-systemic-risk" className="text-accent hover:underline">Global Banking Systemic Risk</a>{" "}
          below. Private Credit remains single-country-anchored: no free source publishes a
          non-US publicly-traded direct-lending vehicle comparable to US BDCs.
        </p>
      </section>

      <section className="mb-8" id="treasury-freshness">
        <h2 className="mb-2 text-base font-semibold text-text">
          Treasury &amp; Sovereign Debt: why a few indicators still show STALE
        </h2>
        <p className="mb-2">
          After the Japan yield upgrade above, five of the seven non-US G7+China 10Y yields (UK, Germany,
          Canada, Japan, China) are now genuinely daily, direct-from-source figures. Two categories of
          indicator on this tab will still legitimately show STALE some of the time, and this is the real
          world, not a fixable pipeline gap, verified directly against each source&apos;s own metadata
          rather than assumed.
        </p>
        <p className="mb-2">
          Italy and France 10Y yields (and the derived Italy-Germany &ldquo;BTP-Bund&rdquo; spread) still
          come from a FRED/OECD proxy that itself only updates monthly and typically lags a further 2-3
          months in publication, so at any given time the freshest value available is genuinely 2-4 months
          old. France&apos;s own daily rate exists but is Euronext-licensed and not used (see above); no
          equally clean, unrestricted daily source was found for Italy.
        </p>
        <p className="mb-2">
          Government debt/GDP ratios for every economy here (Germany, Italy, Japan, Canada, UK, China
          annual; the US&apos;s own quarterly figure) are official national-accounts statistics that take
          governments and the IMF/OECD 1-2+ years to finalize, checked directly against FRED&apos;s own
          latest-observation metadata for all seven series, confirming each one already holds the newest
          figure that source has ever published. There is nothing fresher being missed. (An earlier version
          of this note said IMF&apos;s own World Economic Outlook database sat behind an Akamai
          bot-mitigation block — that was true of the old <code>data.imf.org</code> web front end, but
          IMF&apos;s separate SDMX API at <code>api.imf.org</code> is genuinely free and unblocked, and is
          now used directly for the France/G7 fiscal data below and the EM Debt engine&apos;s own gap
          fillers — see the next section and imfFiscalGaps.ts.)
        </p>
        <p>
          Making every Treasury indicator show LIVE or RECENT at all times is not achievable without either
          fabricating data between real publication dates or silently loosening the freshness thresholds
          until a genuinely 2-year-old debt/GDP figure reads as fresh, both would misrepresent what the data
          actually is. STALE on this tab is the system telling the truth about a real-world reporting lag,
          not a broken feed.
        </p>
      </section>

      <section className="mb-8" id="g7-sovereign-debt">
        <h2 className="mb-2 text-base font-semibold text-text">
          G7 Sovereign Debt — a deeper per-country breakdown, built against a 106-section spec
        </h2>
        <p className="mb-2">
          A separate, much more detailed institutional spec (&ldquo;G7 Sovereign Debt Systemic Risk
          Engine&rdquo;) asked for a full early-warning system across the US, Japan, Germany, France,
          Italy, the UK and Canada: three independent 0-100 scores per country (Structural Vulnerability,
          Market Stress, Funding/Contagion), a 7-stage crisis model, an interactive contagion network,
          PCA/factor decomposition, historical backtesting to 1992, a daily AI report and a 10-scenario
          stress-test library. Checked component by component the same way the second EM Debt spec was:
          what free, verified data genuinely supports is built at{" "}
          <a href="/dashboard/g7-debt" className="text-accent hover:underline">/dashboard/g7-debt</a>;
          everything else is disclosed below as deferred, not faked.
        </p>
        <p className="mb-2">
          This deliberately does <strong>not</strong> register as a second GFMI-weighted engine. The
          existing Treasury &amp; Sovereign engine above already covers this exact seven-country universe
          with 10Y/30Y yields and debt/GDP, and this project&apos;s engine registry already made the
          explicit choice to fold &ldquo;Global Sovereign Debt&rdquo; into that one engine specifically to
          avoid counting the same underlying yield/debt signal twice in the composite — which the new
          spec&apos;s own section 97 separately warns against doing. The G7 Debt page instead reuses that
          engine&apos;s existing yield and debt/GDP series as inputs to the deeper three-score breakdown,
          shown alongside (not instead of) the Treasury engine&apos;s own composite score.
        </p>
        <p className="mb-2">
          <strong>Structural Vulnerability</strong> is government debt/GDP, fiscal balance/GDP, real GDP
          growth and current account/GDP, cross-sectionally z-scored against the other six G7 economies
          (the same peer-group principle used for EM Debt). Six of seven countries&apos; debt/GDP reuses
          the Treasury engine&apos;s existing FRED-sourced series; France has none (checked directly —
          FRED carries no French general-government-debt/GDP series at all), so France&apos;s debt/GDP
          comes from IMF&apos;s Global Debt Database instead. Fiscal balance/GDP is from IMF&apos;s World
          Economic Outlook database, via the free, unblocked <code>api.imf.org</code> SDMX endpoint (see
          above), capped to observations at least one calendar year old so a multi-year-ahead WEO forecast
          is never ingested as an observed fact. Real GDP growth and current account/GDP are new for all
          seven — from World Bank Open Data, the same two indicators (and weights) already used in EM
          Debt&apos;s own structural score: growth affects debt-dynamics sustainability via r-g, and a
          current-account deficit signals external financing need.
        </p>
        <p className="mb-2">
          <strong>Market Stress</strong> is each country&apos;s own 10Y-yield time-series z-score (the same
          series already on the Treasury tab — Bundesbank/BoE/BoC/MOF daily, FRED/OECD monthly proxy for
          Italy and France), blended for France and Italy with their own spread-to-Bund time-series
          z-score — the standard eurozone-fragmentation gauge (Germany has no &ldquo;vs-Bund&rdquo; spread
          since it IS the Bund) — plus a sovereign CDS reading (Damodaran/NYU Stern&apos;s free annual
          snapshot, the same source and single-point-in-time caveat as EM Debt&apos;s own CDS input,
          cross-sectionally z-scored across the seven since it is one annual value rather than a time
          series) and, for the six non-US countries, their own currency-vs-USD time-series z-score (ECB
          reference rates via Frankfurter — Japan&apos;s already tracked for the yen-carry engine;
          EUR/GBP/CAD newly added here). The US has no own-currency pair since the dollar is the numeraire.
          Reserve-currency FX is a far weaker stress signal than an EM currency move, but it is a genuine,
          free, live one, disclosed as such rather than omitted or faked.
        </p>
        <p className="mb-2">
          <strong>Funding/Contagion</strong> is a single G7-wide breadth reading — the share of the OTHER
          six G7 economies whose structural+market blend is already elevated (≥60) — applied identically to
          all seven countries. This is real and computed, not fabricated, but is disclosed as a
          simplification: it is not yet the bespoke bilateral bond-correlation/financial-exposure network
          the spec envisions, since no free source publishes G7 cross-holdings data. The composite score is
          a GDP-weighted blend of the seven countries&apos; vulnerability scores (World Bank GDP, the
          spec&apos;s own requirement that the US and Japan carry more weight than smaller G7 economies),
          not a flat seven-way average.
        </p>
        <p className="mb-2">
          <strong>US Treasury Live Detail</strong> (a separate panel on the G7 Debt page, US-only): debt
          held by the public / intragovernmental / total, straight from Treasury&apos;s own
          &ldquo;Debt to the Penny&rdquo; dataset, updated daily; the New York Fed&apos;s own SOMA
          holdings of Treasury notes/bonds/bills/TIPS/FRNs (deliberately excluding MBS/agency debt),
          divided by total public debt for a genuine Fed-holdings-share reading; and the most recently
          completed 10-Year Note and 30-Year Bond auction results (bid-to-cover ratio, indirect-bidder
          share, high yield) from Treasury&apos;s own auctions_query dataset. All three verified live,
          all free, no key. This is shown as context, not yet folded into the structural/market scores —
          it exists for only one of the seven countries, and the auction series specifically needs
          roughly 20 real auctions&apos; worth of history (each tenor auctions monthly, so ~20 months)
          before a proper time-series z-score baseline exists; it will start contributing an actual
          signal as that history accumulates rather than being backfilled or estimated.
        </p>
        <p>
          <strong>Explicitly not built</strong>, checked and disclosed rather than faked: the same
          interest-burden-acceleration, gross-financing-requirement and maturity-wall calculations for
          any country; auction-level stress and investor-base/central-bank-holdings tracking for the
          other six G7 economies (Japan&apos;s MOF publishes auction results, but not at a stable,
          guessable endpoint the way its yield curve is — checked directly, the obvious calendar/results
          URLs 404; the UK DMO&apos;s XML report API exists but its report-code scheme wasn&apos;t
          identified within reasonable effort; Germany, France, Italy and Canada have no equivalently
          open auction-result API verified live); a PCA/factor-model decomposition; an interactive
          sovereign-contagion network graph; historical backtesting against 1992-2024 crisis episodes
          with lead-time analysis; and a daily G7 debt report with an AI Q&amp;A layer. None of these
          show fabricated values — every score and figure that is built is real, and the rest simply
          isn&apos;t on the page yet.
        </p>
      </section>

      <section className="mb-8" id="global-carry-trade">
        <h2 className="mb-2 text-base font-semibold text-text">
          Global Carry Trade Risk — broadening yen carry, built against a 97-section spec
        </h2>
        <p className="mb-2">
          A separate institutional spec (&ldquo;Global Carry Trade Systemic Risk Engine&rdquo;) asked
          for FX/bond/EM/credit/volatility/commodity/crypto carry tracking across a configurable
          funding/target-currency universe, forward-implied and covered-vs-uncovered carry, options
          positioning and skew, cross-currency basis, a leverage/margin-call engine, a
          funding-to-liquidation network simulation, historical backtesting to 1997, a daily report
          and an AI Q&amp;A layer, and a user-facing P&amp;L simulator. Checked component by component
          the same way the EM Debt and G7 Debt specs were: what free, verified data genuinely
          supports across a broad currency set is built at{" "}
          <a href="/dashboard/yen-carry" className="text-accent hover:underline">/dashboard/yen-carry</a>
          , now titled &ldquo;Global Carry Trade Risk&rdquo;; everything else is disclosed below as
          deferred, not faked.
        </p>
        <p className="mb-2">
          The existing GFMI-weighted engine (still the same &ldquo;yen_carry&rdquo; key and weight, to
          avoid breaking the continuity of its own score history) was itself broadened alongside this
          page: its inputs now include CHF, EUR and USD &ldquo;stretched-ness&rdquo; (how much each
          funding currency has already weakened, the same concept previously tracked for JPY alone)
          and CFTC CHF/EUR positioning, on top of the original JPY crosses, US-Japan yield spread and
          CFTC JPY positioning — using data already flowing into the pipeline for this page, no new
          sources needed. It deliberately does <strong>not</strong> adopt this page&apos;s own
          cross-sectional Carry Fragility scoring method (that score has no per-horizon windowing,
          unlike every GFMI engine&apos;s own short/medium/long differentiation) — same broader
          inputs, same composition method as every other engine. The fuller 4x17 pair-level breakdown
          below is a separate analytical layer and does not add a second vote to GFMI.
        </p>
        <p className="mb-2">
          <strong>Universe</strong>: 4 funding currencies (JPY, CHF, EUR, USD — the spec&apos;s own
          explicit list) crossed with 17 target currencies (AUD, NZD, CAD, GBP, MXN, BRL, ZAR, INR,
          IDR, TRY, PLN, HUF, CZK, KRW, CNY, THB, MYR, PHP). The spec&apos;s CLP/COP are not covered —
          no free daily FX source publishes either (checked: the ECB does not quote a reference rate
          for Chilean or Colombian pesos). Funding currencies are never treated as targets of each
          other (e.g. a JPY-funded EUR trade) — a disclosed scoping simplification, not a data gap.
        </p>
        <p className="mb-2">
          <strong>Carry Return</strong> (uncovered/unhedged only — the spec&apos;s own covered-interest-
          parity split needs live forward FX pricing, which has no free source) is the rate
          differential (each currency&apos;s own short-term interbank/policy rate — OECD MEI
          &ldquo;Immediate Rates&rdquo;/&ldquo;3-Month Interbank Rate&rdquo; family via FRED, or the
          closest live equivalent; Thailand, Malaysia and the Philippines have no current free
          short-term rate series at all — checked directly, only stale annual bank-margin indicators
          exist for these three — and Brazil&apos;s is a discount-rate proxy rather than the primary
          Selic policy rate, disclosed per-row) plus the realized FX return from ECB/Frankfurter daily
          reference rates, both annualized over a trailing ~1 year. Roll/forward effects, hedging cost
          and transaction costs are not modeled — a real but incomplete uncovered-carry proxy,
          disclosed as such. The Carry Heatmap shows FX return alone (marked &ldquo;≈&rdquo;) for
          Thailand, Malaysia and the Philippines, since the rate leg genuinely doesn&apos;t exist for
          them — never a blank cell where real data is actually available.
        </p>
        <p className="mb-2">
          <strong>Volatility</strong> is 20-day annualized realized volatility of the funding/target
          cross rate, converted to a historical percentile (never a fixed threshold shared across
          currencies, per the spec&apos;s own instruction) and bucketed into the spec&apos;s six
          vol-regime labels. <strong>Positioning</strong> is CFTC Commitments of Traders net
          non-commercial position (% of open interest) — JPY, CHF, EUR, GBP, CAD, AUD, NZD, MXN, BRL
          and ZAR have an actively-reporting CME futures contract (several historical/renamed CFTC
          series per currency were checked and rejected as stale); USD and the remaining ten target
          currencies have no CFTC-reportable contract at all and are genuinely marked unavailable, not
          estimated.
        </p>
        <p className="mb-2">
          <strong>Carry Fragility</strong> (0-100, the spec&apos;s own &ldquo;carry trap&rdquo;
          concept — carry stays attractive while volatility is unusually low and positioning is
          crowded) blends positioning crowding, inverted volatility percentile (low current vol
          relative to its own history raises the score) and the funding currency&apos;s own recent
          trend, renormalized across whichever are available. <strong>Crisis Stage</strong> (the
          spec&apos;s own 7-stage &ldquo;Normal → Carry Building → Crowding → Fragility → Unwind
          Beginning → Forced Deleveraging → Systemic Contagion&rdquo; model) uses Fragility&apos;s own
          score bands for Stages 1-4; Stage 5 additionally requires a genuinely detected funding-
          currency reversal combined with already-elevated volatility at the same time (the spec&apos;s
          own §29 combination), and Stage 6 additionally requires the realized carry to have actually
          gone negative by more than the pair&apos;s own annual carry. Stage 7 is reserved for the
          cross-pair composite only, when a large share of ALL tracked pairs are simultaneously at
          Stage 5+ (the spec&apos;s own &ldquo;carry unwind breadth&rdquo; concept) — never assigned to
          a single pair in isolation.
        </p>
        <p>
          <strong>Explicitly not built</strong>, checked and disclosed rather than faked:
          forward-implied/covered carry (needs live forward FX pricing), cross-currency basis, FX
          options positioning/skew/risk-reversals, real (inflation-adjusted) carry for every target
          country (would need a live CPI series per target, not attempted this pass), leveraged-fund/
          dealer/hedge-fund positioning beyond the CFTC non-commercial proxy, bond/credit/volatility-
          selling/commodity/crypto carry as separately-modeled engines, a funding-to-margin-to-
          liquidation network simulation across banks/NBFIs/hedge funds, historical backtesting
          against 1997-2026 carry episodes with lead-time analysis, a daily report and AI Q&amp;A
          layer, and a user-facing P&amp;L scenario simulator. None of these show fabricated values —
          every score and figure that is built is real, and the rest simply isn&apos;t on the page yet.
        </p>
      </section>

      <section className="mb-8" id="global-banking-systemic-risk">
        <h2 className="mb-2 text-base font-semibold text-text">
          Global Banking Systemic Risk — a country-level layer, built against a 200-section spec
        </h2>
        <p className="mb-2">
          A separate institutional spec (&ldquo;Global Banking Systemic Risk Engine&rdquo;) asked for a
          bank_master universe of individual G-SIBs/D-SIBs with CET1/LCR/NSFR/Stage-2/CRE/derivatives
          tracking, an interbank contagion network, a 10-scenario stress-test library with deposit-
          outflow and wholesale-funding ladders, historical backtesting to the 1990s Japanese banking
          crisis, a daily report and an AI Q&amp;A layer. Checked component by component the same way
          as Carry Trade and G7/EM Debt: no free source publishes structured, machine-readable
          bank-by-bank regulatory filings across countries, so the entire bank-level layer is disclosed
          below as deferred. What free, verified data genuinely supports at the country level across
          nine banking systems is built at{" "}
          <a href="/dashboard/banking" className="text-accent hover:underline">/dashboard/banking</a>.
          This is a new analytical layer alongside the existing GFMI-weighted &ldquo;banking&rdquo;
          engine (unchanged — still its own six US/Euro-area/UK inputs) rather than a replacement or a
          second vote in the composite.
        </p>
        <p className="mb-2">
          <strong>Universe</strong>: the seven G7 economies plus China and India — nine of the
          spec&apos;s 21-country minimum. Eurozone as its own standalone aggregate, Australia, South
          Korea, Singapore, Hong Kong, Brazil, Mexico, Indonesia, South Africa, Turkiye, Saudi Arabia
          and UAE are not covered — checked, no equally free/current bank-soundness source verified
          this pass, disclosed as deferred rather than estimated.
        </p>
        <p className="mb-2">
          <strong>Capital</strong> is the World Bank&apos;s &ldquo;Bank capital to assets ratio&rdquo; —
          a leverage ratio (equity/total assets), not a risk-weighted CET1 ratio (no free source
          publishes cross-country risk-weighted regulatory capital — checked), cross-sectionally
          z-scored against the other eight countries. Verified live: fresh 2024-2025 values for six of
          the nine; Japan (2022) and China (2021) are genuinely several years stale and shown with their
          true as-of year rather than relabeled current. <strong>Credit</strong> is the World Bank&apos;s
          bank NPL-to-gross-loans ratio (fresh for eight of nine; Japan again stale at 2022),
          cross-sectionally z-scored, blended for the US with the existing Banking engine&apos;s own
          delinquency/charge-off/CRE-delinquency series and for the UK/Canada/Japan with the BIS
          credit-to-GDP gap already tracked on the Credit tab.
        </p>
        <p className="mb-2">
          <strong>Funding</strong> reuses each country&apos;s own short-term policy/interbank rate — the
          exact same series already wired in for Carry Trade — rather than fetching anything new.
          <strong> Liquidity</strong> reuses each country&apos;s own central-bank balance-sheet/reserves
          series already flowing from the Liquidity engine (Fed reserve balances, BoE reserves, ECB
          balance sheet, BoJ balance sheet, BoC assets, China reserves-ex-gold, India&apos;s RBI net
          liquidity injection). A dedicated cross-country &ldquo;bank liquid reserves to assets&rdquo;
          ratio (World Bank FD.RES.LIQU.AS.ZS) was checked and rejected as the primary liquidity input:
          verified live to have zero observations at all for six of the nine countries (UK, Germany,
          France, Italy, Canada, China), leaving only US/Japan/India covered — too sparse to build a
          domain on. <strong>Market</strong> uses a bank-sector equity index or ETF per country/region
          (US KBW Bank Index, a European bank-sector ETF for Germany/France/Italy, a TOPIX Banks ETF for
          Japan, a Canadian bank ETF, the Nifty Bank Index for India) — and, where no broad index was
          found to still be live on Yahoo Finance despite initially resolving (the FTSE 350 Banks index
          and the EURO STOXX Banks index both returned zero recent daily bars when actually checked), a
          single large representative bank instead: Barclays for the UK, ICBC for China — disclosed as
          single-bank proxies, not broad indices.
        </p>
        <p className="mb-2">
          <strong>Structural Vulnerability</strong> = Capital 35% + Credit 30% + Funding 15% + Liquidity
          20% — a free-data-scoped mapping of the spec&apos;s own Capital 40/Credit 25/Funding 20/
          Balance-Sheet 15 framing (IRRBB/duration-gap data needs bank-level disclosures this pass
          doesn&apos;t have, so it isn&apos;t a separate domain here). <strong>Contagion</strong> is a
          breadth reading — the fraction of the OTHER eight countries whose preliminary
          Structural+Market blend is already elevated — the same simplification already used for G7
          Debt&apos;s own funding/contagion score, not yet a bilateral cross-border-exposure-weighted
          network (needs BIS International Banking Statistics bilateral claims data, a real future
          addition). <strong>Composite</strong> = Structural 40% + Market 35% + Contagion 25%, the
          spec&apos;s own §90 base weighting applied verbatim.
        </p>
        <p className="mb-2">
          <strong>Crisis Stage</strong> compresses the spec&apos;s eight named stages (§92) into this
          app&apos;s standard 7-stage convention — the spec&apos;s separate &ldquo;Capital Stress&rdquo;
          stage is folded into &ldquo;Banking Crisis&rdquo; since there is no bank-level
          capital-depletion waterfall to distinguish the two meaningfully. Hidden Banking Risk
          (structural elevated, market still calm) and Market Warning (market deteriorating well ahead
          of structural) are genuinely computed flags that promote a country&apos;s stage floor, the
          same pattern already used for G7 Debt. Stage 7 (Systemic Contagion) is reserved for the
          cross-country composite only, when a large share of ALL nine countries are simultaneously at
          Stage 6+ — never assigned to a single country in isolation.
        </p>
        <p className="mb-2">
          The dashboard also renders two transparency views the spec asks for directly from these same
          computed numbers, with no new data fetched: a <strong>Liquidity–Solvency Matrix</strong> (spec
          §109/165) placing each country by Capital score (solvency risk) against Liquidity score
          (liquidity risk) into the four buckets the spec names — illiquid-but-solvent and
          insolvent-but-liquid are genuinely different problems from a system that is both, and collapsing
          everything into one composite number would hide that distinction; and a{" "}
          <strong>score breakdown</strong> (spec §110/135, &ldquo;why is this score X&rdquo;) for the
          highest-composite countries, showing the actual weighted point contribution of Structural/
          Market/Contagion to the composite and of Capital/Credit/Funding/Liquidity to Structural, using
          the exact same fixed weights the engine computes with rather than a second hard-coded copy.
        </p>
        <p className="mb-2">
          <strong>Bank-level layer</strong>: the spec&apos;s own recommended source for individual-bank
          CET1/LCR/NSFR is FFIEC&apos;s CDR bulk data download — checked live before building anything,
          and found genuinely blocked: the actual file-serving endpoint
          (<span className="gfew-mono">ffiec.gov/npw/FinancialReport/ReturnBHCFZipFiles</span>) returns
          Cloudflare&apos;s bot-challenge response to a plain automated request (verified directly — the
          response carries a <span className="gfew-mono">Cf-Mitigated: challenge</span> header), and
          Chicago Fed&apos;s own historical mirror of the same files stops at 2021-Q1 (verified: the
          2021-Q1 file downloads, every 2022+ quarter 404s) — five years stale, not a current feed.
          FFIEC&apos;s SOAP webservice does expose the real thing (CET1 ratio, Tier 1 leverage ratio,
          risk-weighted assets from FR Y-9C) — a registered CDR account&apos;s WS-Security credentials
          were obtained and tested directly against the live service, and authentication genuinely
          succeeds. But every operation tried (TestUserAccess, RetrieveReportingPeriods,
          RetrievePanelOfReporters) returns the identical fault{" "}
          <span className="gfew-mono">Server.MethodUnavailable: This service is no longer available</span>,
          not an authentication error — FFIEC has retired the entire legacy webservice, and no
          documented v2/REST replacement was found. This is a confirmed dead end, not a gap pending
          credentials. The bank-level table on{" "}
          <a href="/dashboard/banking" className="text-accent hover:underline">/dashboard/banking</a>{" "}
          instead reuses the SEC EDGAR XBRL machinery already built for the AI engines to pull real Total
          Assets/Equity/Deposits/Loans/Net Income for all eight US G-SIBs plus four large super-regionals
          (standard GAAP concepts, verified live and consistently tagged across every bank checked,
          including trading-heavy Goldman Sachs and Morgan Stanley) at the HOLDING COMPANY level.
        </p>
        <p className="mb-2">
          The actual CET1 ratio, however, is now genuinely covered — not through FFIEC or the EU sources
          below, but through the <strong>FDIC BankFind Suite API</strong> (banks.data.fdic.gov /
          api.fdic.gov), found and verified live this pass: unauthenticated, real JSON, field codes
          cross-checked against FDIC&apos;s own published data dictionary
          (<span className="gfew-mono">risview_properties.yaml</span>) rather than guessed, and every
          value spot-checked against JPMorgan Chase Bank NA&apos;s real quarterly history (170 quarters
          back to the 1980s) before use. Its own Call Report/UBPR-derived RISVIEW database exposes the
          regulatory ratios GAAP-only XBRL never carries as plain numeric fields:{" "}
          <span className="gfew-mono">IDT1CER</span> (Common Equity Tier 1 ratio),{" "}
          <span className="gfew-mono">RBC1AAJ</span> (Tier 1 leverage ratio),{" "}
          <span className="gfew-mono">RBCRWAJ</span> (total risk-based capital ratio),{" "}
          <span className="gfew-mono">NCLNLSR</span> (the real noncurrent-loans/NPL ratio, not a
          delinquency proxy) and <span className="gfew-mono">LNCOMRE</span> (commercial real estate loan
          exposure). This pulls the FDIC-insured lead BANK SUBSIDIARY for each of the same twelve banking
          groups (e.g. &ldquo;JPMorgan Chase Bank, National Association&rdquo;, CERT 628) — a different
          legal entity than the SEC-filing holding company, with CERT numbers looked up directly against
          FDIC&apos;s own institutions endpoint rather than typed from memory, and shown as a separate,
          explicitly labeled entity on the dashboard rather than blended into the holding-company row.
          Bank Risk Score now blends CET1 (30%), NPL (20%), CRE/Assets (15%), Deposit Growth (15%), Tier 1
          Leverage (10%) and ROA (10%) — a real, if still partial, five/six-domain screen. LCR and NSFR
          remain genuinely unavailable: they are separate, SEC-mandated disclosures for only the largest
          banks, not a Call Report/RISVIEW field, and no free structured feed of them was found.
        </p>
        <p className="mb-2">
          Every other route checked this pass, in the order investigated: the EBA&apos;s brand-new{" "}
          <strong>Pillar 3 Data Hub</strong> (launched January 2026) does carry exactly the IRRBB
          duration/repricing and CR6 PD/LGD templates the spec asks for, but a direct, unauthenticated
          request to its public endpoint (<span className="gfew-mono">edap-public.eba.europa.eu</span>)
          was verified to redirect into an infinite <span className="gfew-mono">/Account/Login</span> →{" "}
          <span className="gfew-mono">/account/tenant</span> loop — &ldquo;public&rdquo; means reachable
          through a browser session, not a script. The EBA&apos;s older{" "}
          <strong>EU-wide Transparency Exercise</strong> genuinely does have real, free, unauthenticated
          bulk CSVs (verified: <span className="gfew-mono">tr_cre.csv</span>,{" "}
          <span className="gfew-mono">tr_sov.csv</span> etc. download as real HTTP 200 files, 119 banks
          across 25 EU/EEA countries) — but EBA discontinued it as of June 2025, so it is a frozen,
          one-time-forever snapshot rather than a live feed, and doesn&apos;t cover IRRBB or CR6 at all;
          not built this pass given that tradeoff. India&apos;s RBI DBIE is a macro/monetary statistics
          warehouse, not a repository of individual banks&apos; Pillar 3 disclosures — checked, not there.
          Brazil&apos;s Banco Central (a genuine OData/Swagger API at{" "}
          <span className="gfew-mono">olinda.bcb.gov.br</span>) and Türkiye&apos;s BDDK (a real open-data
          service with Python/R client libraries) are both real APIs, just for countries not currently in
          this engine&apos;s universe. Mexico&apos;s CNBV, China&apos;s CNINFO, and South
          Africa/Türkiye/Saudi Arabia/UAE bank investor-relations and exchange filing portals are all
          manual document-search interfaces for individual banks&apos; own PDF disclosures, not bulk APIs
          — no free structured feed found for any of them.
        </p>
        <p className="mb-2">
          A follow-up round specifically claimed &ldquo;live LCR/NSFR programmatic feeds&rdquo; for every
          tracked country. Every claim relevant to this engine&apos;s nine-country universe was checked
          directly and none held up: Canada&apos;s OSFI LAR pages are regulatory guidance documents, not a
          data feed; the Bank of England&apos;s IADB is real but carries macro/monetary aggregates
          (Bank Rate, money supply), not individual-bank PRA regulatory returns, which aren&apos;t public
          anywhere; Japan&apos;s BOJ/JFSA has no bulk LCR feed — Japanese banks disclose LCR individually
          in their own annual-report PDFs; and the FFIEC/EBA P3DH/RBI DBIE claims repeated verbatim the
          same specific technical details (method names, endpoint behavior) already disproven above. Zero
          of seven checks confirmed. <strong>CET1, leverage, NPL and CRE concentration are genuinely
          available (via FDIC, above) — LCR and NSFR specifically are not, for any tracked country, from
          any source checked so far.</strong>
        </p>
        <p className="mb-2" id="leading-banking-stress-score">
          <strong>Leading Banking Stress Score</strong>: rather than wait on LCR/NSFR, the dashboard
          computes a score from data already shown elsewhere on the page, restricted to the subset the
          spec&apos;s own §186 classifies as LEADING rather than LAGGING (&ldquo;LEADING: credit growth,
          deposit outflows, funding spreads, CRE refinancing, bank equity, yield curve&rdquo; vs.
          &ldquo;LAGGING: NPL, CET1 after losses, defaults&rdquo;). At country level: Funding 40% + Market
          (bank-equity price/vol) 35% + the BIS credit-to-GDP Gap 25% where it exists (UK/Canada/Japan
          only — renormalized to Funding+Market for the other six countries), explicitly excluding the
          Capital and NPL-based Credit inputs shown in the country table since those are the spec&apos;s
          own lagging examples. At bank level (US only): CRE/Assets 50% + Deposit Growth 50%, from the
          same real FDIC/SEC EDGAR data already used for Risk Score, again excluding CET1/NPL. Both are
          shown on{" "}
          <a href="/dashboard/banking#leading-banking-stress-score" className="text-accent hover:underline">
            /dashboard/banking
          </a>
          .
        </p>
        <p className="mb-2">
          <strong>Extrapolation disclaimer</strong>: the LEADING/LAGGING split above is a classification
          from the spec&apos;s own text, reflecting conventional financial-theory priors about which
          indicators typically move first — it is <em>not</em> an empirically measured lead time in this
          dataset. This app runs no historical backtesting or lead-time analysis (spec §145-148/188:
          &ldquo;calculate median lead time, 25th/75th percentile, false-positive rate&rdquo; against past
          crises — not built, would require validated point-in-time historical data this deployment
          doesn&apos;t have). A high Leading Score means the specific leading-classified inputs are
          currently elevated, not that stress is forecast within any timeframe, and it is mechanically
          correlated with the Composite/Structural scores shown elsewhere on the page since it re-uses
          their component inputs rather than independent data — a different lens on the same evidence, not
          a separate confirmation.
        </p>
        <p className="mb-2" id="central-bank-fsr-verification">
          <strong>Central Bank Financial Stability Report Verification</strong>: rather than build our own
          leading indicator in isolation, the banking dashboard&apos;s{" "}
          <a href="/dashboard/banking#central-bank-fsr-verification" className="text-accent hover:underline">
            /dashboard/banking
          </a>{" "}
          page links directly to each of the nine tracked countries&apos; own central bank Financial
          Stability Report (or equivalent — the Fed&apos;s and BoE&apos;s &ldquo;Financial Stability
          Report&rdquo;, BOJ&apos;s &ldquo;Financial System Report&rdquo;, Bundesbank&apos;s &ldquo;Financial
          Stability Review&rdquo;, Banca d&apos;Italia&apos;s &ldquo;Financial Stability Report&rdquo;,
          Banque de France&apos;s &ldquo;Assessment of Risks to the French Financial System&rdquo;, the Bank
          of Canada&apos;s &ldquo;Financial Stability Report&rdquo;, the PBOC&apos;s &ldquo;China Financial
          Stability Report&rdquo; and the RBI&apos;s &ldquo;Financial Stability Report&rdquo;). Every
          report&apos;s URL and publication date was checked directly against the institution&apos;s own
          site before being added. This is a curated verification registry (see
          centralBankFsrRegistry.ts), not a live feed — it changes only when this file is updated after a
          central bank publishes its next edition, exactly as requested (&ldquo;It need not to be live. It
          will change whenever central bank publish its report&rdquo;).
        </p>
        <p className="mb-2">
          <strong>Coverage — G7 + G20/major EM + ASEAN + CEE + Latin America + Middle East + Africa</strong>:
          extended from the original 9 to 34 countries in one pass, each independently verified the same
          way — a real URL and a real publication date checked directly against the institution&apos;s own
          site (or, where noted in a code comment, a specific news report stating the fact directly), never
          guessed. Added: Argentina, Australia, Brazil, Indonesia, Mexico, Russia, Saudi Arabia, South
          Africa, South Korea, Turkey (G20/major EM); Malaysia, Philippines, Singapore, Thailand (ASEAN);
          Poland, Czech Republic, Hungary, Romania (CEE); Chile, Colombia, Peru (Latin America); UAE, Israel
          (Middle East); Kenya, Egypt (Africa). Checked and deliberately <strong>not</strong> added: Vietnam
          (the State Bank of Vietnam publishes no standalone public FSR-type report), Qatar (Qatar Central
          Bank&apos;s legacy publications page is broken/bot-gated and no working primary-source URL could
          be found), and Nigeria (the CBN&apos;s FSR PDF is real and publicly hosted, but every recent
          edition is itself headed &ldquo;Classified as Confidential&rdquo; — an inconsistent, anomalous
          case not treated as equivalent to the other clean entries). Note this app&apos;s own banking
          engine (the &ldquo;Our Composite&rdquo;/&ldquo;Δ vs Central Bank&rdquo; columns) only has
          free-data-backed country coverage for the original 9 — the 25 newly added countries show a fully
          real report, hyperlink and stance classification, but no composite-score comparison, since this
          app has no banking engine built for them.
        </p>
        <p className="mb-2">
          <strong>Auto-Check</strong>: the qualitative fields above stay manually curated, but their
          freshness is genuinely automated (centralBankFsrCheck.ts, migration 0019&apos;s
          central_bank_fsr_checks table). On every pipeline run: for the three institutions with an
          already-integrated press-release RSS feed (Fed, BoE, RBI — see centralBankRss.ts/
          central_bank_events), the check queries that table for a &ldquo;Financial Stability
          Report&rdquo;-titled item dated after the registry&apos;s publishedDate. For the other six (BOJ,
          Bundesbank, Banca d&apos;Italia, Banque de France, Bank of Canada, PBOC), it re-fetches that
          institution&apos;s own publications listing page and runs a regex anchored to that specific
          institution&apos;s real list-row wording (not a generic date scan, which would also match
          nav/breadcrumb text or older archived rows that never disappear from these pages), comparing the
          first match against what the registry expects. A mismatch — or a newer RSS item — sets that row
          to &ldquo;Needs review&rdquo; on the dashboard; it does NOT auto-edit the registry&apos;s
          publishedDate or stance, since reading and classifying a new edition&apos;s actual content is a
          human judgment this app doesn&apos;t automate. This is not a hypothetical safeguard: building and
          testing this check is what caught the France and Bank of Canada rows already being one edition
          behind (December 2025 → June 2026, and 2025 → 2026 respectively) the same day this feature was
          built. France&apos;s own auto-check currently shows &ldquo;Check failed&rdquo; rather than
          &ldquo;Verified&rdquo;: Banque de France&apos;s site returns HTTP 403 to Vercel&apos;s serverless
          IPs specifically (verified working from a residential IP with the same headers) — a datacenter-IP
          block, the same class of issue as the FFIEC CDR webservice elsewhere in this app. Disclosed rather
          than hidden; it does not affect the other eight countries.
        </p>
        <p className="mb-2">
          <strong>Auto-Check coverage for the 25-country expansion</strong>: six more got a genuinely
          tested regex check the same way (Russia, Indonesia, Turkey, Malaysia, Hungary, Kenya — Kenya&apos;s
          listing page presents its editions oldest-first, so its check reads the LAST matching row on the
          page rather than the first, via checkMatchPosition). Every other newly added country is marked
          &ldquo;Not automated&rdquo; on purpose: its listing page was actually fetched and found to be
          JavaScript-rendered (returns an empty template to a plain HTTP request — e.g. Bank of Korea,
          MAS Singapore, Banco Central do Brasil) or bot-walled (returns a challenge page instead of content
          — e.g. SAMA, NBP Poland, CBE Egypt), so no regex could be reliably anchored to real text.
          Shipping an untested or unreliable check would be worse than no check at all — it would either
          silently never fire or produce false &ldquo;needs review&rdquo; flags — so those entries show an
          honest &ldquo;Not automated&rdquo; badge instead of a fabricated &ldquo;Verified&rdquo; one.
        </p>
        <p className="mb-2">
          <strong>&ldquo;Report&apos;s Own Stance&rdquo; and &ldquo;Δ vs Central Bank&rdquo;</strong>: each
          report is tagged calm/moderate/elevated from its own stated language (transcribed, not inferred —
          e.g. the Bundesbank&apos;s 2025 review says risks &ldquo;have increased&rdquo;, so it is tagged
          elevated; the RBI&apos;s June 2026 report says resilience is &ldquo;continuously improving&rdquo;,
          so it is tagged calm). This is bucketed onto the same three-level scale as this app&apos;s own
          composite score (below 40 = calm, 40-64 = moderate, 65+ = elevated) purely so the two can be
          compared, and the dashboard flags when they disagree.
        </p>
        <p>
          <strong>Extrapolation disclaimer (Central Bank FSR comparison)</strong>: this is <em>not</em> a
          point-in-time backtest. The comparison is always between the central bank&apos;s report and
          this app&apos;s CURRENT composite score — not a reconstruction of what this app&apos;s composite
          score would have read on the report&apos;s own publication date, because this deployment does not
          store historical composite-score snapshots (each country&apos;s composite is computed live from
          the latest available metric series every time the page renders, not saved to a time series). A
          &ldquo;more stress&rdquo;/&ldquo;less stress&rdquo; flag therefore means &ldquo;our model reads
          differently right now than the central bank&apos;s own most recent published stance&rdquo;, which
          can reflect either a genuine change in conditions since that report&apos;s publication date or a
          methodological difference between this model&apos;s free-data proxies and the central bank&apos;s
          own supervisory data — the table does not distinguish between those two causes, and neither
          should be assumed without reading the linked report itself.
        </p>
        <p>
          <strong>Still explicitly not built</strong>, checked and disclosed rather than faked: LCR/NSFR
          at any bank; IRRBB duration/repricing and CR6 PD/LGD (gated behind the EBA Pillar 3 Data
          Hub&apos;s login flow); Stage-2 migration, deposit concentration, derivatives notional and other
          Pillar-3-only bank-level disclosures; deposit/uninsured-deposit/deposit-velocity tracking (no
          free per-country source);
          CRE-refinancing-wall and mortgage-payment-shock simulators (need loan-maturity-schedule data
          no free source publishes); sovereign-bank/property-bank/corporate-bank feedback-loop
          SIMULATION (the underlying series exist and are noted conceptually, but no forward simulation
          runs); an interactive bank contagion network graph (a bilateral-exposure-inferring
          maximum-entropy reconstruction was considered and deliberately not built, since true
          interbank exposures are confidential everywhere and an inferred matrix would be a MODELED
          ESTIMATE presented alongside genuinely observed data — a different category of thing this
          site is careful not to blur); a full stress-scenario library with deposit-outflow/
          wholesale-funding/collateral-haircut ladders; historical backtesting with lead-time analysis;
          and a daily report/AI Q&amp;A layer. None of these show fabricated values — every score and
          figure that is built is real.
        </p>
      </section>

      <section className="mb-8" id="global-property-systemic-risk">
        <h2 className="mb-2 text-base font-semibold text-text">
          Global Property Systemic Risk — a country-level layer, built against a 256-section spec
        </h2>
        <p className="mb-2">
          A separate institutional spec (&ldquo;Global Property Systemic Risk Engine&rdquo;) asked for a
          property_country_master universe spanning G20/major EM/ASEAN/CEE/Latin America/Middle East/
          Africa, residential + commercial (office/retail/industrial/hotel/multifamily) + construction +
          mortgage + developer + REIT + MBS tracking, a bank/NBFI/developer contagion network, a
          12-scenario stress-test library, historical backtesting to the 1990s Japan property collapse,
          a daily report and an AI Q&amp;A layer. Checked component by component the same way as Banking
          Systemic Risk: what free, verified data genuinely supports at the country level across nine
          markets is built at{" "}
          <a href="/dashboard/property" className="text-accent hover:underline">/dashboard/property</a>.
          This is a new analytical layer alongside the existing GFMI-weighted &ldquo;property&rdquo;
          engine (unchanged — still its own BIS real-HPI-for-8-countries plus US mortgage-rate/starts/
          permits inputs) rather than a replacement or a second vote in the composite.
        </p>
        <p className="mb-2">
          <strong>Universe</strong>: the same nine countries as Banking Systemic Risk (the G7 plus China
          and India), reusing the identical country keys on purpose — it makes a genuine
          Property-Bank Convergence view (spec §141) possible by joining the two engines&apos; tables
          directly, no fuzzy country-name matching needed. Australia, South Korea, Singapore, Hong Kong,
          Brazil, Mexico, Indonesia, Türkiye, South Africa, Saudi Arabia and UAE are not covered — not
          checked this pass, disclosed as deferred rather than estimated.
        </p>
        <p className="mb-2">
          <strong>Valuation</strong> is the BIS &ldquo;Selected residential property prices&rdquo; real
          house-price index — the same series the existing GFMI-weighted property engine already uses
          for eight countries via FRED mirrors, extended to India via a direct BIS SDMX API call (FRED
          doesn&apos;t mirror India&apos;s series; verified live and fresh through 2026-Q1 before use —
          the exact dimension structure of BIS&apos;s dataflow, FREQ.REF_AREA.VALUE.UNIT_MEASURE, was
          checked against BIS&apos;s own published data structure rather than guessed). Rather than
          comparing raw index levels across countries (which would be meaningless — a &ldquo;higher
          number&rdquo; only reflects each series&apos; own base, not relative overvaluation), each
          country&apos;s Valuation score is its OWN deviation from a 15-year (60-quarter) trend — a
          longer window than this app&apos;s usual 3-year default, matching the spec&apos;s own emphasis
          on 5/10/20-year trend comparisons (§13). A genuine price-to-income ratio (the OECD&apos;s own
          preferred affordability measure, spec §17) was checked and not found via any free, no-key,
          machine-readable API this pass — not fabricated as a substitute.
        </p>
        <p className="mb-2">
          <strong>Credit</strong> is each country&apos;s own BIS credit-to-GDP gap — the same
          dataflow (and genuine Basel III countercyclical-buffer signal) already used for three countries
          on the Credit tab, verified live this pass to also cover the US, Germany, France, Italy and
          India (all fresh through 2025-Q4), giving this domain full nine-country coverage. This is total
          private credit, not mortgage credit specifically — no free source breaks mortgage credit out
          separately across all nine countries — but it is still a genuine leading credit-boom-excess
          signal, and spec §34 itself explicitly asks for valuation to be connected to the credit-to-GDP
          gap rather than judged on price alone. <strong>Affordability</strong> reuses each country&apos;s
          own short-term policy/interbank rate — the same series already wired in for Carry Trade and
          Banking&apos;s Funding domain — as a financing-cost proxy, since no free source publishes a
          cross-country 30-year-fixed-equivalent mortgage rate (the US mortgage rate the legacy property
          engine tracks has no free G7-wide equivalent). <strong>Market</strong> uses a REIT or
          property-sector equity ETF per country/region (Vanguard Real Estate ETF for the US, national
          REIT ETFs for the UK/Canada/Japan, a European property-yield ETF for Germany/France/Italy, a
          China real-estate-sector ETF) and, where no live broad index was found on Yahoo Finance despite
          initially resolving (India&apos;s Nifty Realty index returned a single stale bar when actually
          checked), a single large representative developer instead: DLF Ltd, India&apos;s largest listed
          developer — disclosed as a single-company proxy, not a broad index.
        </p>
        <p className="mb-2">
          <strong>Structural Vulnerability</strong> = Valuation 40% + Credit 30% + Affordability 30% — a
          free-data-scoped mapping of the spec&apos;s own Valuation 40/Leverage 25/Affordability 15/
          Supply 10/Financing 10 framing (§133) — Supply and Financing are folded into Affordability since
          no free source publishes cross-country housing starts/permits or property-specific financing
          conditions outside the US. <strong>Contagion</strong> is a breadth reading — the fraction of the
          OTHER eight countries whose preliminary Structural+Market blend is already elevated — the same
          simplification already used for Banking/G7 Debt, not yet a genuine bank/NBFI/developer
          exposure-weighted network (spec §116, needs bilateral exposure data no free source publishes).
          <strong> Composite</strong> = Structural 40% + Market 35% + Contagion 25%, the spec&apos;s own
          §5 base weighting applied verbatim.
        </p>
        <p className="mb-2">
          <strong>Crisis Stage</strong> compresses the spec&apos;s nine named stages (§123, STAGE 0-8)
          into this app&apos;s standard 7-stage convention — spec&apos;s separate Credit/Developer Stress
          and Banking/NBFI Transmission stages are folded into one since no developer-level or
          bank-exposure data distinguishes them meaningfully here. Hidden Property Risk (§124: structural
          elevated, market still calm) and Market Already Warning (§202: market deteriorating well ahead
          of structural) are genuinely computed flags that promote a country&apos;s stage floor, the same
          pattern already used for Banking/G7 Debt. Stage 7 (Systemic Contagion) is reserved for the
          cross-country composite only, when a large share of ALL nine countries are simultaneously at
          Stage 6+ — never assigned to a single country in isolation.
        </p>
        <p className="mb-2" id="leading-property-stress-score">
          <strong>Leading Property Stress Score</strong>: the spec&apos;s own §137 leading/lagging
          classification explicitly lists &ldquo;valuation&rdquo; and &ldquo;credit growth&rdquo; as
          LEADING and &ldquo;foreclosures/NPL/developer defaults&rdquo; as LAGGING, so this score is
          Valuation 50% + Credit 50% — deliberately excluding Affordability (not spec-classified either
          way) and Market (spec&apos;s own list puts property &ldquo;prices&rdquo; under COINCIDENT, not
          leading, unlike the Banking spec which explicitly called bank equity leading). The same
          extrapolation disclaimer as Banking&apos;s Leading Score applies: this is a re-derivation of
          numbers already shown above using spec&apos;s classification, not an empirically measured lead
          time — this app runs no historical backtesting (spec §178-181, not built), so a high reading
          means the leading-classified inputs are currently elevated, not that a correction is forecast
          within any particular timeframe.
        </p>
        <p className="mb-2">
          <strong>Property-Bank Systemic Convergence</strong> (spec §141) is built directly on the
          dashboard by joining this table with the Banking Systemic Risk table on the shared country key
          — flagging countries where BOTH are simultaneously elevated (composite ≥ 55), rather than
          assuming property stress automatically implies bank systemic risk or vice versa (spec&apos;s own
          acceptance tests §243/244 require exactly this distinction: a country with property stress but
          low bank property exposure and strong capital should NOT automatically show elevated bank
          systemic risk).
        </p>
        <p>
          <strong>Still explicitly not built</strong>, checked and disclosed rather than faked: the entire
          property_country_master granularity (residential segments, CRE by office/retail/industrial/
          hotel/multifamily, developer balance sheets, REIT NAV/P-NAV, MBS spreads — spec §7-8, 62-91);
          price-to-income/price-to-rent/rental-yield ratios (§16-19, no free cross-country API found);
          mortgage quality/LTV/DSR/mortgage-reset-wall tracking (§36-43, needs bank-level mortgage-book
          disclosures no free source publishes); transaction/inventory/vacancy tracking (§44-58, US-only
          free sources, not extended cross-country); CRE cap-rate/DSCR/refinancing-wall engines (§20-22,
          70-75, needs property-level NOI/debt data no free source publishes); developer-specific engines
          (§76-82, needs individual developer financials); a genuine bank/NBFI/developer contagion network
          graph (§116); the full 12-scenario stress-test library with interactive UI controls (§205-207);
          historical backtesting with lead-time analysis (§178-181); and a daily 8am report/AI Q&amp;A
          layer (§208-212). None of these show fabricated values — every score and figure that is built
          is real.
        </p>
      </section>

      <section className="mb-8" id="china-property-credit-pmi-lgfv">
        <h2 className="mb-2 text-base font-semibold text-text">
          China: closing the property/credit/PMI/LGFV/financing gap
        </h2>
        <p className="mb-2">
          Property sales, credit impulse, PMI new orders, LGFV debt and developer financing were previously
          all marked UNAVAILABLE for China — genuinely no free source was found at the time. All five have
          real, verified, non-fabricated sources now, though not all five update the same way, and one is
          honestly a proxy rather than the literal thing its name suggests:
        </p>
        <p className="mb-2">
          <strong>Property sales</strong> (floor space of newly-built commercial buildings sold, million
          m²), <strong>PMI new orders</strong>, and <strong>developer financing</strong> all come from
          NBS&apos;s (National Bureau of Statistics of China) own monthly English-language press releases —
          but reached via <span className="gfew-mono">english.www.gov.cn</span>, the State Council&apos;s
          English news portal that syndicates NBS content, rather than{" "}
          <span className="gfew-mono">stats.gov.cn</span> directly. NBS&apos;s own domain actively blocks
          non-browser HTTP clients — a WAF 403 with an explicit &ldquo;UrlACL&rdquo; rule on its data-query
          API, and a deterministic TLS-level connection reset on its press-release pages for any Node-based
          HTTP client (reproduced with two different Node HTTP clients, while a plain{" "}
          <span className="gfew-mono">curl</span> from the same network succeeds) — which this project will
          not work around with TLS-fingerprint spoofing or similar anti-bot evasion. Since the same NBS
          releases are openly republished on a State Council domain that isn&apos;t behind that block, that
          is used instead: using an open, reachable government publication, not circumventing a control.
          These releases are highly templated (same NBS press office, same phrasing every month), which is
          what makes prose parsing viable here — the same approach already used for SEC EDGAR tag selection
          and YTD de-cumulation elsewhere in this project, applied to English prose instead of XBRL facts. A
          month whose exact phrasing doesn&apos;t match the parser simply contributes no point for that
          month rather than a guessed one, so these series currently have real but incomplete history that
          fills in further with each future release.
        </p>
        <p className="mb-2">
          <strong>Developer financing</strong> is honestly a proxy, and labeled as one: NBS&apos;s literal
          &ldquo;funds in place&rdquo; breakdown for real estate developers (domestic loans, self-raised
          funds, deposits/advances, mortgages) is published in a separate release that only exists on the
          blocked <span className="gfew-mono">stats.gov.cn</span> domain, not syndicated to
          english.www.gov.cn. What the syndicated release does carry is the year-on-year change in real
          estate development investment itself (&ldquo;...and that in real estate development declined by
          19.2 percent&rdquo;) — a real, official, closely related aggregate: a slump in developer capital
          deployment is exactly what financing stress produces, even though it isn&apos;t the financing-source
          breakdown by name. Individual developer bond <em>default</em> events remain genuinely unavailable
          free — no free source tracks those in structured form — so this indicator covers the financing
          trend, not defaults.
        </p>
        <p className="mb-2">
          <strong>Credit impulse</strong> is, honestly, a proxy: the BIS (Bank for International
          Settlements) Credit-to-GDP Gap for China&apos;s private non-financial sector — the official
          Basel III countercyclical-capital-buffer signal, i.e. the standard central-bank early-warning
          measure for a credit boom. A literal credit impulse (the second derivative of PBOC Total Social
          Financing flow, scaled by GDP) would mean deriving a growth-of-growth-rate metric ourselves from
          raw flow data; consuming BIS&apos;s own already-computed, officially-published series is less
          fabrication-adjacent, and BIS&apos;s free SDMX API (no key, no auth) made it directly reachable.
          It is labeled as a proxy on the dashboard, not as a literal replica of any bank&apos;s proprietary
          credit-impulse calculation.
        </p>
        <p>
          <strong>LGFV (Local Government Financing Vehicle) debt</strong> has no standing, machine-readable
          data series anywhere — checked FRED, OECD, World Bank, BIS and the IMF&apos;s own DataMapper API
          (which covers China&apos;s narrow General Government Debt but nothing LGFV-specific). The one real
          number that exists comes from the IMF&apos;s own annual China Article IV Consultation staff
          report, which publishes a staff-estimated &ldquo;Augmented Debt&rdquo; figure (general government
          debt plus LGFVs and other off-budget government funds) once a year, in a PDF table, with no API.
          The values tracked here — 97.5% of GDP (2020) through 126.6% (2025) — were extracted directly from
          that report&apos;s own historical table (IMF Country Report No. 26/044, February 2026), excluding
          the same table&apos;s 2026-2030 columns, which are explicitly staff <em>projections</em>, not
          observations. This is not an auto-refreshing feed: it is a manually-verified figure that needs a
          human to append one new point after each new Article IV report is published (usually annually) —
          the same honest treatment already given to other genuinely-annual indicators like debt/GDP ratios,
          just with a manual rather than automated refresh step. Until the next report, it will correctly
          show RECENT or STALE under the annual freshness window, which reflects how often this data
          actually changes, not a pipeline bug.
        </p>
      </section>

      <section className="mb-8" id="supply-chains-g7-china">
        <h2 className="mb-2 text-base font-semibold text-text">
          Supply Chains: from one global number to G7+China
        </h2>
        <p className="mb-2">
          The NY Fed&apos;s Global Supply Chain Pressure Index (GSCPI) is a genuine Tier-1, single
          authoritative composite already built from shipping/freight/PMI data across the major economies
          driving global trade — but it publishes no country or region breakdown (checked its own
          downloadable workbook directly: only the composite value is in there). Extending &ldquo;Supply
          Chains&rdquo; to G7+China therefore meant finding separate, genuinely free, national data — and
          unlike most of the other country extensions on this page, the same *kind* of series wasn&apos;t
          available everywhere, so each country&apos;s proxy is disclosed for exactly what it is:
        </p>
        <p className="mb-2">
          <strong>US, Germany, France, Italy</strong> use the OECD Business Tendency Survey&apos;s
          &ldquo;Order Books: Current&rdquo; series (mirrored on FRED) — a net-balance survey of
          manufacturers reporting order books above vs. below normal. Rising backlogs relative to normal is
          a real capacity/delivery-strain signal, conceptually close to what GSCPI&apos;s own PMI
          sub-components measure.
        </p>
        <p className="mb-2">
          <strong>Japan</strong> has no Order Books series in this dataset, so &ldquo;Finished Goods
          Stocks: Current&rdquo; (also OECD BTS, quarterly) is used instead — a related but distinct
          concept. It is included because unsold/unshipped goods piling up is exactly what happened during
          the 2021-22 chip-shortage period, when automakers couldn&apos;t ship finished vehicles because
          production itself was blocked, not because demand had fallen — but it can also simply reflect
          demand weakness, which is a real interpretive caveat this indicator carries that the Order Books
          series doesn&apos;t.
        </p>
        <p className="mb-2">
          <strong>Canada</strong> comes directly from Statistics Canada&apos;s own Web Data Service API — a
          manufacturing inventory-to-sales ratio, free, no key, updated monthly. This is a direct-from-source
          connector rather than the FRED/OECD mirror because that mirror&apos;s Canadian submission for this
          concept stopped updating in 2023, while StatCan itself is still current (the aggregator lagged,
          not the underlying source — the same pattern already seen with UK/Germany/Canada bond yields
          earlier in this document).
        </p>
        <p className="mb-2">
          <strong>China</strong> uses NBS&apos;s own PMI supplier-delivery-time subindex, parsed from the
          same English press releases already used for property sales and PMI new orders (see the China
          section above). NBS alternates between a short wire brief and a longer release that includes this
          subindex, so this series is real but genuinely sparser than PMI new orders — not a parsing gap,
          just a less consistently-reported figure at the source.
        </p>
        <p>
          <strong>The UK</strong> is the one G7 economy still genuinely uncovered here. Its own
          OECD-submitted Order Books and Finished Goods Stocks series were both discontinued in March 2021
          (confirmed directly against FRED&apos;s series metadata), and the UK&apos;s real-world equivalent
          — the CBI Industrial Trends Survey — sits behind Cloudflare bot-protection on cbi.org.uk, which
          this project will not work around. Rather than force a stale or fabricated UK figure into the
          engine, this gap is disclosed in the engine&apos;s contradictory-evidence field and here, not
          silently dropped.
        </p>
      </section>

      <section className="mb-8" id="global-liquidity-systemic-risk">
        <h2 className="mb-2 text-base font-semibold text-text">
          Global Liquidity Systemic Risk — a country-level layer, built against a 256-section spec
        </h2>
        <p className="mb-2">
          Checked component-by-component against a full institutional Global Liquidity Systemic Risk Engine
          spec (funding/market/central-bank/collateral/FX/dollar/repo/margin/NBFI/capital-flows/contagion
          liquidity, 16 sub-indices, a shock simulator, historical backtests, a daily 8am report) for what
          free, verified data genuinely supports across a multi-country universe at once — the same
          discipline already applied to Carry Trade, G7 Debt, EM Debt, Banking and Property. This
          deliberately does NOT touch the existing GFMI-weighted &ldquo;Global Liquidity&rdquo; engine
          (below) or its per-bank Ample/Adequate/Deficit classifier — a new analytical layer, not a second
          GFMI vote (the spec&apos;s own &ldquo;Double-Counting Control&rdquo; instruction).
        </p>
        <p className="mb-2">
          <strong>Country universe:</strong> starts from the same nine countries as Banking and Property
          (BANKING_COUNTRIES, so the Transmission panel below can join across five engines on one country
          key) and was expanded to 22 on request, covering the spec&apos;s own G20/ASEAN/CEE ask: Brazil,
          Mexico, Indonesia, South Korea, South Africa, Türkiye, Australia (G20/Major EM region bucket, the
          same grouping used on the Banking/Credit pages&apos; verification tables), Poland, Czech Republic,
          Hungary (CEE), and Malaysia, Thailand, Philippines (ASEAN). Every addition reuses interbank-rate
          and FX-cross series already flowing in this app for the Carry Trade/EM Debt engines — verified
          present before wiring in, no new connectors needed. <strong>Checked and excluded</strong> — no
          free interbank-rate or FX-cross series exists in this app (a pegged currency or an untracked
          market, not merely unattempted): Saudi Arabia and the UAE (SAR/AED are hard-pegged to USD),
          Singapore (SGD untracked), Argentina and Russia (ARS/RUB untracked, Russia&apos;s data additionally
          disrupted since 2022), plus Chile, Colombia, Israel, Romania, Peru, Egypt, Kenya, Nigeria,
          Vietnam, Qatar and the major offshore financial centres the spec separately calls out.
        </p>
        <p className="mb-2">
          Two of the four domains below (Central Bank Liquidity, Bond Market Liquidity) remain genuinely
          nine-country-only — no free FX-reserves connector exists beyond China, and no free 10-year
          government-bond-yield series was found for any of the 13 additions. The other two (Repo/
          Money-Market, FX Liquidity) extend to most of the 13: ten have a tracked interbank/discount rate
          used as a LEVEL series (same disclosed limitation Japan/China/India already have — no free
          daily policy-rate series to pair it against for a true spread), and all thirteen have a tracked
          USD cross rate. Malaysia, Thailand and the Philippines have a real FX Liquidity reading but no
          Repo reading (checked FRED&apos;s OECD-mirrored short-rate families directly — none exist for
          these three). The engine&apos;s existing weighted-renormalization logic (already built for the
          original nine, unchanged for this expansion) means a country with only 1-2 of 4 domains still
          gets an honest score built from what it actually has, reweighting the denominator rather than
          treating a missing domain as zero or forcing a fabricated stand-in.
        </p>
        <p className="mb-2">
          <strong>Four domains</strong> (the spec&apos;s own multi-dimensional liquidity taxonomy trimmed to
          what has genuine free daily/weekly data):
        </p>
        <ul className="mb-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Central Bank Liquidity</strong> — reuses the exact same reserves/balance-sheet series
            already wired into the Banking engine&apos;s own Liquidity domain (Fed reserve balances, BoE
            reserves, ECB balance sheet, BoJ balance sheet, BoC assets, China reserves-ex-gold, India&apos;s
            RBI net liquidity injection), own-history z-scored.
          </li>
          <li>
            <strong>Repo / Money-Market Stress</strong> — the same money-market-rate-vs-policy-rate SPREAD
            used for the Ample/Adequate/Deficit classification below (SOFR−IORB, SONIA−Bank Rate,
            €STR−Deposit Facility Rate for Germany/France/Italy, CORRA−Target) — the actual mechanism
            behind the September 2019 US repo spike. Japan, China and India have no free daily policy-rate
            series to pair against (same disclosed limitation the classifier below already has for the
            first two; India&apos;s own WACR has no paired repo-rate series in this app yet), so those
            three are scored on their own money-market rate&apos;s LEVEL trend instead — a real but weaker
            signal, labeled per-row, never silently blended in as equivalent to a true spread.
          </li>
          <li>
            <strong>Bond Market Liquidity</strong> — realized volatility of each country&apos;s own 10-year
            government bond yield (elevated vol = worse). A genuine proxy, not the bid/ask-depth-turnover
            the spec itself asks for — no free source publishes dealer-level bond-market microstructure
            data across all nine countries.
          </li>
          <li>
            <strong>FX Liquidity</strong> — realized volatility of each country&apos;s own currency vs USD
            (the broad trade-weighted dollar index stands in for the US itself, since USD has no bilateral
            pair against itself), reusing FX series already flowing from the FX connector.
          </li>
        </ul>
        <p className="mb-2">
          Structural = Central Bank Liquidity 50% + Repo 50%. Market = Bond Vol 50% + FX Vol 50%.
          Contagion = the fraction of the other eight countries whose preliminary Structural+Market blend
          is already elevated (≥60) — the same breadth-based reading every sibling engine uses, not yet a
          true bilateral cross-border-exposure network (would need BIS Locational Banking Statistics
          bilateral claims data — a real future addition). Composite = Structural 40% + Market 35% +
          Contagion 25% — this app&apos;s own house convention, applied verbatim rather than the spec&apos;s
          own regime-dependent 40/35/25→35/40/25→25/40/35 weight-shifting (no other engine in this app
          implements that regime-switch either, kept consistent rather than making Liquidity a one-off).
        </p>
        <p className="mb-2">
          <strong>Stage model:</strong> the spec&apos;s own 8-stage list (Abundant/Normalization/
          Tightening/Funding Stress/Market Liquidity Stress/Collateral-Margin Stress/Forced
          Deleveraging/Systemic Crisis) is compressed to this app&apos;s standard 7-stage convention —
          deliberately RELABELED, not copied verbatim: this engine has no collateral-haircut or margin-call
          data, so a stage literally named &ldquo;Collateral/Margin Stress&rdquo; would overclaim what is
          actually measured. Stage 7 (Systemic Liquidity Contagion) is reserved for the cross-country
          composite only, promoted by breadth, never assigned to a single country in isolation.
        </p>
        <p className="mb-2" id="global-dollar-liquidity-index">
          <strong>Global Dollar / Euro / Yen Liquidity Index</strong> is a deliberately SEPARATE layer from
          the country table — the spec&apos;s own &ldquo;BIS Global Liquidity Engine&rdquo; section calls
          out the BIS&apos;s Global Liquidity Indicators (GLI) by name as a major input, and GLI is compiled
          by BIS at the CURRENCY/BORROWER-REGION level, not per-country, so folding it into a per-country
          z-score would misrepresent what the underlying data measures. Verified live directly against BIS&apos;s
          free, no-key SDMX API (dataflow WS_GLI) before wiring in: BORROWERS_CTY = &ldquo;3P&rdquo;
          (&ldquo;All countries excluding residents&rdquo;, BIS&apos;s own headline &ldquo;credit to non-bank
          borrowers outside the issuing jurisdiction&rdquo; aggregate) for USD/EUR/JPY, and
          &ldquo;4T&rdquo; (&ldquo;Emerging market and developing economies&rdquo;) for the EM-specific USD
          slice — all four confirmed fresh through 2026-Q1 at the time this was built. The connector fetches
          the year-on-year GROWTH RATE flavor of this series (UNIT_MEASURE=771), not the level, since a
          growth rate is already correctly detrended and is exactly what the spec&apos;s own &ldquo;Dollar
          Credit Growth: YoY&rdquo; and &ldquo;Dollar Liquidity Acceleration&rdquo; (rapid contraction in
          cross-border credit = early warning) sections ask for directly. EXPANDING/MODERATING/
          DECELERATING/CONTRACTING labels are this app&apos;s own reading of that growth rate&apos;s level
          and own-history trend, not a BIS-published classification.
        </p>
        <p className="mb-2" id="nbfi-monitoring-methodology">
          <strong>NBFI Monitoring</strong> treats non-bank financial intermediation as a first-class
          liquidity amplifier, per the spec&apos;s own framing (&ldquo;Global Monitoring of NBFI... leverage,
          liquidity mismatch, funding/interconnectedness&rdquo;) and the FSB&apos;s own explicit
          identification of NBFI growth, leverage, liquidity mismatch, funding/deposit relationships,
          repo/credit exposures and bank-security holdings as genuine interconnectedness channels — not a
          footnote. No free source publishes country-level NBFI balance-sheet data this app could ingest as
          a numeric time series, so this is built the same way the Central Bank FSR registry is: ONE
          curated, verified entry — the Financial Stability Board&apos;s own annual &ldquo;Global Monitoring
          Report on Nonbank Financial Intermediation&rdquo; (the only genuinely global, cross-jurisdiction,
          methodologically-consistent NBFI data source, covering 29 jurisdictions and &gt;90% of global
          GDP) — with its headline figures (total NBFI assets, share of global financial assets, growth,
          the FSB&apos;s own &ldquo;narrow measure&rdquo; of entities posing bank-like financial-stability
          risk) transcribed directly from the report&apos;s own publication-day summary, verified live at
          fsb.org before being added (2025 edition: $256.8tn total, 51.0% of global financial assets, +9.4%
          YoY; narrow measure $76.3tn, +12% YoY). The FRESHNESS of that transcription is auto-checked on
          every pipeline run — a regex anchored to the exact live page text (the 2025 edition&apos;s title
          drops the hyphen, &ldquo;Nonbank&rdquo; vs. every prior year&apos;s &ldquo;Non-Bank&rdquo; —
          verified directly against the page&apos;s raw text, not assumed; if a future edition reverts to
          the hyphenated form the check fails SAFE, reporting &ldquo;needs review&rdquo; rather than
          silently reporting current). Splitting this into per-jurisdiction entries was considered and
          rejected: no national regulator publishes a comparably comprehensive NBFI monitoring report, so
          doing so would mean either fabricating detail this app cannot verify, or mostly-empty rows.
        </p>
        <p className="mb-2" id="liquidity-transmission-methodology">
          <strong>Liquidity Transmission panel</strong> is the direct implementation of this engine&apos;s
          own design brief: liquidity as a TRANSMISSION mechanism connecting the other systemic-risk
          engines, not a sixth independent score sitting next to them. Rather than fabricate a new
          cross-engine correlation model or a bilateral contagion graph (spec §109-111, 210 — needs
          bilateral exposure data this app doesn&apos;t have), the panel reads each sibling engine&apos;s
          ALREADY-COMPUTED composite score directly (Banking, Property, G7 Sovereign Debt, EM Debt, Carry
          Trade) and flags &ldquo;Systemic Liquidity Convergence&rdquo; only when Liquidity itself is
          elevated (≥60) AND at least two of those other five are too — a real, honest, if simple,
          engine-granularity implementation of the spec&apos;s own &ldquo;Liquidity Fragility
          Convergence&rdquo; concept (&ldquo;at least three independent channels deteriorating
          together&rdquo;). EM Debt has no dedicated composite-score function elsewhere in this app, so an
          equal-weighted mean of its rows&apos; own vulnerability score is computed for this panel only,
          identical to how every other engine&apos;s own composite getter already aggregates its rows. This
          is a genuine convergence READING of real, already-verified numbers — not a forecast, not a
          simulation of how a shock would actually propagate (spec&apos;s own Root-Shock/Liquidity Shock
          Simulator, §124-125, 174, 211-213, is not built).
        </p>
        <p className="mb-2">
          <strong>Still not built</strong> — checked, no free/reliable source found or out of scope for
          incremental work on an existing app, disclosed rather than faked: repo volumes/haircuts/
          specialness (no free source publishes cross-country repo market depth), collateral availability/
          concentration/haircut-shock modeling, margin/CCP data, country-level NBFI numeric leverage/
          redemption series (covered instead, qualitatively and globally only, by the NBFI registry above),
          capital-flow/reserve-adequacy metrics for non-China EM, a Liquidity Shock Simulator, historical
          backtesting with lead-time analysis, an interactive bilateral contagion network graph, and a
          daily 8am report/AI Q&amp;A layer.
        </p>
      </section>

      <section className="mb-8" id="energy-systemic-risk">
        <h2 className="mb-2 text-base font-semibold text-text">Global Energy Systemic Risk (GESRI)</h2>
        <p className="mb-2">
          Built against a 171-section institutional spec covering oil/gas/LNG/coal/electricity/grid/
          nuclear/renewables/critical-minerals/shipping/chokepoints/geopolitics/weather/transition risk
          across a 30-secondary-score index, a 250+-signal library, a global energy trade network graph,
          a 20-scenario stress library with a policy simulator, historical backtesting to the 1973 oil
          crisis, a daily 8am IST report and a full AI Q&amp;A layer. This is a genuinely large build
          (dozens of new tables and connectors, not a single-engine addition), and is proceeding in
          phases rather than one shot: each domain is checked against real free/official sources before
          being wired in, work lands incrementally, and everything not yet built is disclosed here rather
          than faked or silently skipped. Lives on the existing{" "}
          <a href="/dashboard/energy" className="text-accent hover:underline">
            Energy
          </a>{" "}
          page, below the pre-existing flat, GFMI-weighted &ldquo;Energy&rdquo; composite (Brent/WTI/
          Henry Hub spot levels only), which is unchanged by this addition (same &ldquo;new analytical
          layer, not a second vote&rdquo; pattern as every other Systemic Risk engine here).
        </p>
        <p className="mb-2">
          <strong>Four structural domains</strong>: Oil (Brent+WTI spot levels, already tracked by the
          flat engine, blended with CBOE&apos;s Crude Oil ETF Volatility Index — OVX, a real
          options-implied-volatility &ldquo;market stress&rdquo; signal for oil, the same concept as VIX
          for equities); Natural Gas (Henry Hub spot plus its own realized volatility — a genuine US
          storage series was checked and requires a keyed EIA API registration this app does not have
          configured, not used); Critical Minerals/Nuclear Fuel (Copper and Uranium, both IMF-sourced
          &ldquo;Global price of...&rdquo; series, scored on |z| — extreme moves in either direction
          count as risk, since both a bottleneck-driven spike and a demand-collapse crash are genuine
          hazards; Lithium was checked and has no free equivalent series); and Shipping/Supply Chain (the
          NY Fed&apos;s Global Supply Chain Pressure Index, already ingested for the Supply Chains engine
          and reused here rather than re-fetched, blended 55/45 with a genuine tanker-transit chokepoint
          signal from{" "}
          <a href="https://portwatch.imf.org/pages/data-and-methodology" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            IMF PortWatch
          </a>
          : free, official, AIS-derived daily vessel counts for all 28 tracked global chokepoints. Hormuz,
          Bab el-Mandeb, Suez and Malacca — the four through which most seaborne oil/LNG physically
          moves — feed this domain directly; a drop in tanker transits below a chokepoint&apos;s own
          trailing norm scores as risk. This supersedes the original build&apos;s assumption that no free
          chokepoint-level data existed.
        </p>
        <p className="mb-2">
          Market = the Energy Select Sector SPDR (XLE) own-history price z-score (60%) blended with
          realized-volatility z-score (40%) — no free cross-country energy-equity index exists, so XLE
          serves as a liquid, real-time proxy for producer/company financial stress, the same
          &ldquo;sector ETF as market domain&rdquo; pattern already used for REITs and bank equities
          elsewhere in this app. Structural = Oil 35% + Natural Gas 25% + Critical Minerals/Nuclear Fuel
          20% + Shipping 20% (weighted toward oil&apos;s outsized share of global energy trade value).
          Composite = Structural 40% + Market 35% + Convergence 25% — this app&apos;s standard split.
        </p>
        <p className="mb-2">
          <strong>Convergence, not cross-country contagion</strong>: because this is a single global
          entity rather than a peer-country table, the cross-country breadth pattern every other
          Systemic Risk engine here uses cannot apply directly. The spec&apos;s own &ldquo;Energy Supply
          Chain Convergence&rdquo; concept (raise risk when independent stress appears simultaneously
          across commodities, not simply summing correlated variables) supplies the single-entity
          substitute used instead: the fraction of this engine&apos;s own four structural domains that
          are independently elevated (≥60) at the same time.
        </p>
        <p className="mb-2">
          <strong>Stage model</strong>: the spec&apos;s own 9-stage Energy Crisis Clock (Stage 0 Normal
          through Stage 8 Global Energy Crisis) compressed to this app&apos;s standard 7-stage
          convention. Hidden Energy Risk (structural elevated, market still calm) and a market-led
          warning (market deteriorating well ahead of structural) promote the stage floor, never demote
          it. Stage 7 is reserved for a genuinely high Convergence reading alongside an already-high
          composite, rather than any single commodity in isolation.
        </p>
        <p className="mb-2">
          <strong>Phase 1 (shipped)</strong>: the four structural domains and Market/Convergence layer
          above, now including real chokepoint-transit data from IMF PortWatch; country-level oil
          production/consumption, import dependency and US natural gas storage via a registered EIA API v2
          key; and live load/generation/margin data for all seven major US grid operators — ISO-NE, CAISO
          and NYISO from each operator&apos;s own real-time feed, and MISO, PJM, ERCOT and SPP from EIA-930
          (Form EIA-930 Hourly Electric Grid Monitor, same-day official data with a 1-3hr lag) after MISO&apos;s
          own public data broker was confirmed deprecated with no free replacement, and PJM/ERCOT&apos;s
          deeper real-time feeds were confirmed registration-gated; renewable/non-renewable electricity
          capacity and generation by country via IRENA IRENASTAT (free PxWeb statistical API, no key) —
          capacity published annually in March, generation in July with a longer lag; a 20-scenario
          stress-test library with a policy simulator, applying fixed shocks to today&apos;s live domain
          scores through the exact same composite weighting the engine itself uses (not a parallel model);
          and a global energy trade network graph built on real bilateral crude-oil and petroleum-gas
          export values from UN Comtrade (free, no key), with node centrality computed via Brandes&apos;
          algorithm (degree, weighted strength, and betweenness centrality), not a hand-picked score; and a
          historical backtest validating a real long-run signal (FRED&apos;s WTI spot price, monthly since
          1946) against 8 documented energy crises back to the 1973 OPEC embargo, with AUC, Brier-score and
          per-event lead-time metrics computed via the standard Mann-Whitney U / mean-squared-error
          definitions (src/lib/metrics/stats.ts) — explicitly a single-signal proxy validation, not a claim
          that GESRI&apos;s current multi-domain methodology existed or would have scored the same way
          during any of these events (its own structural inputs only exist from ~2019 onward).
        </p>
        <p className="mb-2">
          <strong>Phase 2 (credentials requested, build in progress)</strong>: deeper 5-minute-resolution
          PJM and ERCOT data, pending each operator&apos;s own registration approval (PJM Tools Account +
          Customer Account Manager sign-off; ERCOT developer-portal client ID) — checked whether the
          open-source{" "}
          <a href="https://github.com/kmax12/gridstatus" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            gridstatus
          </a>{" "}
          library&apos;s PJM module offers a free path around this: it doesn&apos;t — its real-time
          load/fuel-mix/LMP calls all require the same registered subscription key (verified live:{" "}
          <span className="gfew-mono">api.pjm.com</span> returns 403 without one). European grid
          reserve-margin and blackout-risk data via ENTSO-E, pending a ~3-business-day API access request;
          MISO and SPP&apos;s own deeper data feeds via MISO Data Exchange, pending registration. In the
          meantime, PJM&apos;s regulatory and market-oversight context (not ingested into the pipeline —
          narrative/PDF documents, not time-series data) is available directly from{" "}
          <a href="https://www.ferc.gov/industries-data/electric/electric-power-markets/pjm" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            FERC&apos;s PJM market oversight page
          </a>{" "}
          and PJM&apos;s Independent Market Monitor,{" "}
          <a href="https://www.monitoringanalytics.com/" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Monitoring Analytics
          </a>
          , whose &ldquo;State of the Market&rdquo; reports audit PJM&apos;s own pricing/transactional
          compliance (e.g. its{" "}
          <a
            href="https://www.pjm.com/-/media/DotCom/library/reports-notices/state-of-the-market/20250811-pjm-response-to-the-2024-state-of-the-market-report.pdf"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            2024 State of the Market response
          </a>
          ).
        </p>
        <p className="mb-2">
          <strong>Genuine gaps — checked, no free source exists, disclosed rather than faked</strong>:
          OPEC+ quota/compliance tracking (EIA publishes OPEC production estimates for free, but
          compliance-vs-quota is analyst judgment, not a series), a full futures curve/backwardation/
          options-skew signal (needs a paid CME/ICE feed — front-month spot is used instead), Baltic
          Exchange freight rates (licensed; GSCPI + PortWatch chokepoint volumes are used as the free
          proxy), nuclear reactor-level outage tracking (IAEA PRIS has no public API), critical-mineral
          mining/refining/manufacturing concentration breakdowns, a cyber risk score (spec explicitly
          calls for &ldquo;aggregated risk intelligence,&rdquo; and no free aggregator exists — no
          placeholder number is shown), producer fiscal-breakeven tracking (analyst estimates, not a free
          official series), full multi-domain historical backtesting to 1973 with lead-time/AUC/Brier-score
          validation (GESRI&apos;s own structural inputs — chokepoint transit data, EIA country balances —
          only exist from ~2019 onward; a fabricated retroactive history would violate this project&apos;s
          own data-integrity rule), and a daily 8am IST report/AI Q&amp;A layer (needs an LLM API key;
          deferred by request rather than built without one).
        </p>
      </section>

      <section className="mb-8" id="china-systemic-risk">
        <h2 className="mb-2 text-base font-semibold text-text">China Systemic Risk</h2>
        <p className="mb-2">
          Built against a 96-section institutional spec covering macro/deflation/fiscal/LGFV/property/
          banking/shadow-banking/credit/monetary/FX/external/industrial/provincial engines, a 100+
          -signal library, province-level risk maps, a 15-scenario stress-test library with a
          user-facing policy simulator, historical backtesting to 1997, a daily 8am IST report and a
          full AI Q&amp;A layer. Same discipline as every other deep-dive engine here: checked domain by
          domain against what free, verified data genuinely supports for a single-country deep dive on
          top of an existing app rather than a from-scratch platform, everything else disclosed as
          deferred rather than faked. Lives on the existing{" "}
          <a href="/dashboard/china" className="text-accent hover:underline">
            China
          </a>{" "}
          page, below the pre-existing flat, GFMI-weighted &ldquo;China&rdquo; composite engine, which
          is unchanged by this addition (same &ldquo;new analytical layer, not a second vote&rdquo;
          pattern as every other Systemic Risk engine here).
        </p>
        <p className="mb-2">
          <strong>Cross-engine reuse, not double-counting</strong>: two of the six structural domains
          below are not re-derived from raw series — they read China&apos;s own already-computed row
          straight out of the existing Banking Systemic Risk and Property Systemic Risk engines (China
          is already a member of both nine-country universes). Because this is a single-country engine,
          the peer-country contagion-breadth pattern every other Systemic Risk engine here uses cannot
          apply directly — the spec&apos;s own &ldquo;China Convergence Engine&rdquo; concept (monitor
          simultaneous deterioration across Property/LGFV/Banks/Credit/Deflation/FX/External; the
          greater the independent convergence, the higher the systemic risk) supplies the single-country
          substitute used instead: a Convergence score measuring the fraction of this engine&apos;s own
          six structural domains that are independently elevated (≥60) at the same time.
        </p>
        <p className="mb-2">
          <strong>Six structural domains</strong>: Property (China&apos;s row from the Property Systemic
          Risk engine, blended with a locally-computed Activity score from NBS property-sales and
          developer-financing flow series — declining transactions/investment scored as risk, not
          &ldquo;overheating,&rdquo; reflecting China&apos;s actual current property problem); Banking
          (China&apos;s row from the Banking Systemic Risk engine, read not recomputed); Fiscal/LGFV
          (the IMF Article IV &ldquo;Augmented Debt&rdquo; annual series — only ~6 annual points exist,
          far below this app&apos;s 20-point z-score minimum, so this domain uses a fixed, disclosed
          calibration band instead: 60% of GDP = 0 risk, 160% = 100 risk, linear, clamped, anchored on
          the IMF&apos;s own 97.5%–126.6% historical range for this series); Deflation (year-on-year CPI
          inflation computed locally from the same CPI index level already ingested for the flat engine
          — scored as risk when YoY inflation is low or negative, the opposite convention from every
          other inflation-risk indicator in this app; a true PPI series was checked and found
          discontinued since December 2022, not used); External/FX (CNY depreciation pressure, SAFE
          reserves-ex-gold trend, and the trade balance computed from exports minus imports, blended);
          and Liquidity/Money Market (China&apos;s 3M interbank rate, elevated relative to its own
          history = funding-cost stress).
        </p>
        <p className="mb-2">
          Market = Shanghai Composite own-history price z-score (60%) blended with realized-volatility
          z-score (40%) — the identical construction used by every sibling Systemic Risk engine&apos;s
          own Market domain. Structural = Property 25% + Banking 20% + Fiscal/LGFV 15% + Deflation 15%
          + External/FX 15% + Liquidity 10% (weighted toward the property→bank→LGFV→fiscal transmission
          chain the spec draws explicitly). Composite = Structural 40% + Market 35% + Convergence 25% —
          this app&apos;s standard split, applied verbatim.
        </p>
        <p className="mb-2">
          <strong>Stage model</strong>: the spec&apos;s own 8-stage crisis clock (Stage 0 Stable through
          Stage 7 Systemic Contagion) compressed to this app&apos;s standard 7-stage convention — the
          same compression pattern used by Property/Banking/Carry Trade/Treasury Risk. Hidden China Risk
          (structural elevated, market still calm) and a market-led warning (market deteriorating well
          ahead of structural) promote the stage floor, never demote it. Stage 7 is reserved for a
          genuinely high Convergence reading alongside an already-high composite, rather than any single
          domain in isolation.
        </p>
        <p className="mb-2">
          <strong>Still not built</strong> — checked, no free/reliable source found, or genuinely out of
          scope for incremental work on an existing app, disclosed rather than faked: province-level
          LGFV/property/fiscal/banking risk maps (no free province-level breakdown exists for any of
          these), Total Social Financing / a literal credit impulse computed from raw PBOC flow data
          (BIS&apos;s own official Credit-to-GDP Gap is used as the already-established free proxy, same
          as the flat china.ts engine), individual LGFV bond/developer default event tracking, a genuine
          bank/property/LGFV exposure-weighted contagion network graph (the Convergence score above is a
          breadth proxy, not a network), dedicated shadow-banking/NBFI-specific tracking, a China policy
          ammunition/fiscal-monetary-FX space index, a 15-scenario stress-test library with a
          user-facing policy-response simulator, historical backtesting with lead-time/AUC/Brier-score
          validation, and a daily 8am IST report/AI Q&amp;A layer.
        </p>
      </section>

      <section className="mb-8" id="treasury-risk-engine">
        <h2 className="mb-2 text-base font-semibold text-text">Global Treasury Risk Engine</h2>
        <p className="mb-2">
          Built against a 259-section institutional spec covering sovereign cash management, funding/
          issuance, rollover, auctions, interest-rate/FX portfolio risk, investor base, contingent
          liabilities, sovereign ALM and market functioning — same discipline as every other deep-dive
          engine here: checked component by component against what free, verified data genuinely
          supports, everything else disclosed as deferred rather than faked. Lives at{" "}
          <a href="/dashboard/treasury-risk" className="text-accent hover:underline">
            /dashboard/treasury-risk
          </a>{" "}
          — deliberately a new route, since the existing &ldquo;Treasury&rdquo; nav label/route is already
          the GFMI-weighted <code className="gfew-mono">us_treasury_sovereign</code> yield/debt-to-GDP
          engine (treasury.ts), unchanged by this build.
        </p>
        <p className="mb-2">
          <strong>The core distinction this engine insists on:</strong> it does not re-ask whether a
          government&apos;s debt is structurally sustainable (the G7 Debt and EM Debt pages already answer
          that). It asks a different question — can the Treasury actually fund and manage its obligations
          right now? A country can score fine here with elevated debt/GDP (funded comfortably, deep
          investor base), or score badly here despite moderate debt (thin real-time funding signals).
        </p>
        <p className="mb-2">
          <strong>Country universe:</strong> the union of the G7 (7) and the 14-country EM Debt universe
          (which already includes China and India) — 21 Treasuries total, region-grouped the same way as
          the Banking/Credit/Liquidity pages.
        </p>
        <p className="mb-2">
          <strong>Four country-table domains</strong>, each reusing metric keys already live for other
          engines rather than re-fetching: <strong>Funding Cost</strong> (each country&apos;s own
          short-term policy/money-market rate, own-history trend — 18 of 21; Malaysia, Thailand and the
          Philippines have no free short-rate series found anywhere in this app);{" "}
          <strong>External/FX Debt</strong> (World Bank external-debt/GNI, short-term-debt/reserves,
          reserves-months-of-imports — EM-only, cross-sectional among EM peers, already live for
          emDebtRegime.ts); <strong>Investor Base</strong> (IMF foreign holdings of local-currency debt,
          own-history trend, declining = risk up — EM-only); <strong>Market Access</strong> (sovereign
          CDS, Damodaran/NYU Stern, cross-sectional WITHIN each peer group separately — G7-vs-G7 and
          EM-vs-EM, never mixed, since a shared cross-section would make every G7 country trivially read
          as &ldquo;safe&rdquo; next to EM&apos;s much wider spreads). Structural = Funding Cost 30% +
          External Debt 35% + Investor Base 35% (G7: Funding Cost alone, renormalized — honestly thinner
          for G7, not padded with a fabricated external-debt score). Composite = Structural 40% + Market
          Access 35% + Contagion 25% (breadth of peers ≥60), the same fixed weighting used everywhere
          else in this app — the spec&apos;s own adaptive NORMAL/STRESS/CRISIS regime-weight switching is
          not implemented.
        </p>
        <p className="mb-2">
          <strong>Two US-only real-time panels</strong> — the spec itself singles out the US as the most
          systemically important case, and no other country has an equivalent free daily feed:
        </p>
        <ul className="mb-2 list-inside list-disc space-y-1">
          <li>
            <strong>US Treasury Cash &amp; Debt Ceiling:</strong> the Daily Treasury Statement&apos;s own
            Treasury General Account (TGA) closing balance — the government&apos;s checking-account
            balance at the Fed — and debt-ceiling headroom, computed as the Statutory Debt Limit minus
            debt actually subject to it (Debt Held by the Public + Intragovernmental Holdings, minus
            Other Debt/Unamortized Discount/Federal Financing Bank, plus Guaranteed Debt of Government
            Agencies — Treasury&apos;s own Table III-C categories). Per the spec&apos;s own explicit
            instruction (&ldquo;never create unsupported X-date forecasts&rdquo;), this shows only the
            real, current headroom figure — never a projected exhaustion date.
          </li>
          <li>
            <strong>US Treasury Auction Health:</strong> bid-to-cover ratio and indirect-bidder share
            (a foreign/overseas-investor demand proxy) across seven tenors — 17-Week, 26-Week and 52-Week
            bills, 2-Year and 5-Year notes (new this pass), plus the 10-Year note and 30-Year bond
            (already tracked by the G7 Debt page&apos;s UsTreasuryDetail sidecar, reused here rather than
            re-fetched).
          </li>
        </ul>
        <p className="mb-2">
          <strong>Still not built</strong> — checked, no free/reliable source found or out of scope for
          incremental work on an existing app, disclosed rather than faked: cash-flow forecasting and
          forecast-error tracking (needs a government&apos;s own internal forecast, not published free
          anywhere), non-US Treasury cash/TGA-equivalent balances (Japan, UK, Germany, France, Italy and
          Canada checked directly — no free daily source found for any of the six), non-US auction
          results beyond the US (Japan MOF, UK DMO, Germany/France/Italy/Canada checked directly, no
          stable free endpoint verified), any debt-maturity-wall breakdown by tenor bucket for any
          country, contingent liabilities (government guarantees, SOE debt, PPP guarantees, pension
          obligations, natural-disaster fiscal exposure — needs each government&apos;s own balance-sheet
          disclosures, no uniform free source across 21 countries), primary-dealer capacity/inventories,
          sovereign wealth fund or non-reserve sovereign asset tracking, the full stress-test scenario
          library and historical backtest suite (the spec&apos;s own §170/210-214), and a daily 8am
          report/AI Q&amp;A layer.
        </p>
      </section>

      <section className="mb-8" id="liquidity-g7-china-india">
        <h2 className="mb-2 text-base font-semibold text-text">
          Liquidity: G7 + China, and a separate India Liquidity engine
        </h2>
        <p className="mb-2">
          Global Liquidity previously covered the Fed, ECB and BOJ. It now adds the
          <strong> UK</strong> (Bank of England reserve balances, series RPWB56A — BoE&apos;s own Weekly
          Report database has no single &ldquo;total assets&rdquo; line, checked directly; reserve
          balances, the liabilities side of the balance sheet, is the same underlying concept the Fed&apos;s
          own reserve-balances series tracks, and arguably the more directly relevant one for gauging
          ample-vs-scarce banking-system liquidity) and <strong>Canada</strong> (Bank of Canada&apos;s own
          &ldquo;Total assets&rdquo; series, V36610, from its weekly balance sheet table via the Valet API).
          Germany, France and Italy were already covered — there is no separate national central-bank
          balance sheet distinct from the consolidated Eurosystem one, so the ECB figure already tracked
          here is their liquidity input.
        </p>
        <p className="mb-2">
          <strong>China</strong> now has a genuine balance-sheet-side quantity, not just a rate-side
          proxy: no free, verified PBOC total-assets series was found (checked pbc.gov.cn&apos;s own
          statistics pages directly — its monthly English-language Financial Statistics Reports cover
          Total Social Financing and RMB loans, not a balance-sheet total), but China&apos;s monthly
          Official Reserve Assets minus Gold is a real, free, verified quantity — IMF-compiled via
          FRED (series TRESEGCNM052N, &ldquo;Total Reserves excluding Gold for China&rdquo;) for deep
          history, gap-filled forward each month by SAFE&apos;s (State Administration of Foreign
          Exchange) own fresher release under the identical definition once FRED&apos;s own ~2-3 month
          lag falls behind. Verified directly: SAFE&apos;s own August 2026 ex-gold figure (~$3.50T)
          lines up with FRED&apos;s June 2026 reading (~$3.48T) for the same underlying concept. FX
          reserves have historically been the dominant driver of PBOC balance-sheet size, making this a
          genuine (if partial — it excludes RMB-denominated domestic assets) balance-sheet-side signal,
          shown alongside (not replacing) China&apos;s 3-month interbank rate, the same rate-side role
          SOFR and the ECB deposit rate play for the US and Eurozone.
        </p>
        <p>
          <strong>India Liquidity is a new, separate tab</strong> — deliberately not folded into India
          Market Regime, which is a bullish/bearish equity-direction call on a different 0-100 scale, not a
          banking-system liquidity read. Both of its inputs come from the RBI&apos;s own daily &ldquo;Money
          Market Operations as on &lt;date&gt;&rdquo; press release, which — unlike the RBI&apos;s PDF-only
          &ldquo;Weekly Statistical Supplement&rdquo; release (whose PDF is served from
          rbidocs.rbi.org.in, verified to sit behind an Imperva/TSPD bot-mitigation JS challenge that this
          project will not solve) — has its actual numbers inline in the HTML page itself, published on
          every business day: RBI&apos;s own headline &ldquo;net liquidity injected/absorbed&rdquo; figure
          (India&apos;s direct analog to the Fed&apos;s RRP/reserve-operations signal — negative means RBI
          is absorbing a banking-system surplus, positive means it is net injecting to cover a deficit),
          and the Weighted Average Call Rate (WACR, India&apos;s overnight interbank rate, the direct
          analog to SOFR/EFFR). USDINR, already tracked elsewhere in this project, is reused as a
          coincident cross-check.
        </p>
      </section>

      <section className="mb-8" id="central-bank-liquidity-regime">
        <h2 className="mb-2 text-base font-semibold text-text">
          Central Bank Liquidity: Ample, Adequate or Deficit — not just balance-sheet size
        </h2>
        <p className="mb-2">
          The Global Liquidity engine above blends everything into one G7+China composite score,
          which answers &ldquo;how tight is liquidity globally&rdquo; but not &ldquo;is the Fed
          specifically ample right now, or is the ECB the tight one?&rdquo; The Liquidity tab now
          also shows a per-central-bank table answering that directly, classified into AMPLE /
          ADEQUATE / NORMAL / TIGHTENING / DEFICIT.
        </p>
        <p className="mb-2">
          The classification basis is deliberately the <strong>money-market rate vs. the bank&apos;s
          own policy rate</strong> — the actual framework central banks themselves use to judge
          reserve scarcity, not balance-sheet size. Under a floor system, the market rate should sit
          a few basis points <em>below</em> the policy rate when reserves are ample; it prints at or
          <em> above</em> the policy rate (arbitrage/collateral pressure) when reserves start getting
          scarce — the same mechanism behind the September 2019 US repo spike. A raw balance-sheet
          z-score only says &ldquo;bigger or smaller than its own recent trend,&rdquo; a materially
          weaker signal for this specific question, so it is now paired with a real rate spread for
          four of the six banks tracked:
        </p>
        <ul className="mb-2 list-inside list-disc space-y-1">
          <li><strong>Fed:</strong> SOFR − IORB (Interest on Reserve Balances, FRED series IORB, daily since mid-2021), alongside the actual weekly reserve-balances level (WRESBAL) rather than only total balance-sheet size (WALCL also includes non-reserve assets).</li>
          <li><strong>Bank of England:</strong> SONIA − Bank Rate, both from BoE&apos;s own IADB (series IUDSOIA and IUDBEDR).</li>
          <li><strong>ECB:</strong> €STR − Deposit Facility Rate, €STR from the ECB&apos;s own public Data Portal API (no key required — the successor to the old SDW web service, same request syntax).</li>
          <li><strong>Bank of Canada:</strong> CORRA − Target Overnight Rate, both from the BoC&apos;s own Valet API.</li>
        </ul>
        <p className="mb-2">
          Two of six deliberately do <strong>not</strong> use a spread, disclosed per row rather than
          papered over: <strong>Bank of Japan</strong> is classified on its uncollateralized
          overnight call rate&apos;s own level trend — sourced from BOJ&apos;s own new (launched
          February 2026) public Time-Series Data Search API, series STRDCLUCON, free and
          key-less — since no free daily BOJ policy/target-rate time series was found to pair it
          with for a spread. <strong>PBOC (China)</strong> is likewise classified on its 3-month
          interbank rate&apos;s own level trend, for the same reason (no free PBOC policy/target-rate
          series exists to pair it with) — but its Balance Sheet column is no longer empty: China&apos;s
          Official Reserve Assets minus Gold (FRED, gap-filled by SAFE — see &ldquo;Global Liquidity:
          G7+China&rdquo; above) is shown as real context, the same &ldquo;shown, not used for
          classification&rdquo; role Japan&apos;s own balance sheet plays in this table.
        </p>
        <p>
          Every regime label is relative to that <strong>same</strong> bank&apos;s own trailing
          ~1-year z-score, not a universal absolute threshold shared across banks — the same
          convention every other z-scored engine in this project uses. A &ldquo;DEFICIT&rdquo;
          read does not mean the same absolute spread width for the Fed as for the ECB, and is
          not by itself a crisis-level reading: for example, the ECB narrowed its own interest-rate
          corridor in April 2024, which mechanically pushed €STR&apos;s spread to the Deposit
          Facility Rate structurally closer to zero than its pre-2024 range, so a reading near the
          top of that bank&apos;s own recent range can score as DEFICIT at a numerically modest
          spread. Read each row as &ldquo;unusually tight or loose for this specific bank
          lately,&rdquo; not as a cross-bank-comparable absolute scale.
        </p>
      </section>

      <section className="mb-8" id="central-bank-liquidity-forecast">
        <h2 className="mb-2 text-base font-semibold text-text">
          Central Bank Liquidity Forecast (short / medium / long term) — trend extrapolation, not a prediction
        </h2>
        <p className="mb-2">
          The Liquidity tab also shows a forward-looking table for the same six banks, with three
          horizons: <strong>short term</strong> (~2 weeks ahead), <strong>medium term</strong>
          (~2 months ahead) and <strong>long term</strong> (~6 months ahead). This is
          <strong> not</strong> built from any forward-looking market instrument — no free OIS-forward
          curve or central-bank dot-plot feed is tracked here. It is a plain ordinary-least-squares
          fit to each bank&apos;s own real basis series (the exact same spread or rate used for the
          current-regime table above), fit over a trailing calendar-day window, projected forward,
          and re-scored against that bank&apos;s own trailing baseline the same way the current
          regime is computed.
        </p>
        <p className="mb-2">
          The slope-fitting window is measured in calendar days, not observation count, deliberately:
          five of the six basis series update daily, but China&apos;s (the 3-month interbank rate) is
          monthly. A 30-calendar-day window fit to a single monthly print cannot support a short-term
          slope, so it correctly returns <strong>INSUFFICIENT_DATA</strong> for that cell rather than
          fitting a line through one point. Windows: 30 days for the short-term horizon, 120 days for
          medium-term, 400 days for long-term — each requiring at least 5 real observations inside its
          window before it will produce a reading.
        </p>
        <p className="mb-2">
          Each cell shows two things: the <strong>regime pill</strong> (AMPLE/ADEQUATE/NORMAL/
          TIGHTENING/DEFICIT) the trend would land on if it continued unchanged, and a{" "}
          <strong>momentum arrow</strong> (↑ tightening, ↓ easing, → stable) showing which direction
          the projection moves relative to today&apos;s reading. Both are computed off the identical
          z-score baseline as the live regime table, so a forecast cell is directly comparable to the
          &ldquo;now&rdquo; column next to it.
        </p>
        <p>
          This is explicitly a momentum read, not a guaranteed outcome — a rate decision, a
          quantitative-tightening taper or restart, or a funding-market shock is not modeled anywhere
          in this calculation and can invalidate it instantly. Treat it the same as every other
          engine&apos;s &ldquo;model estimate, not a guaranteed forecast&rdquo; disclaimer.
        </p>
      </section>

      <section className="mb-8" id="credit-spreads-by-country">
        <h2 className="mb-2 text-base font-semibold text-text">
          Credit Spreads by Country (G7 + China) — what&apos;s real, and the gaps disclosed
        </h2>
        <p className="mb-2">
          The Credit tab now shows a per-country table alongside the composite Credit Markets
          engine, the same &ldquo;disclosed basis, per-unit regime&rdquo; pattern used for Central
          Bank Liquidity above. Corporate credit is not observable per-country the way sovereign
          debt is, so each row shows the best real signal that actually exists for that country,
          not a forced national breakdown:
        </p>
        <ul className="mb-2 list-inside list-disc space-y-1">
          <li><strong>United States:</strong> US High-Yield OAS (ICE BofA, via FRED) — already tracked, genuinely US-specific.</li>
          <li><strong>Germany, France, Italy:</strong> all three show the <em>same</em> Euro-Area High-Yield OAS value. This is not a data gap — eurozone corporate bonds are issued and spread-quoted in one EUR-currency market, not split by nation the way government debt is (there is no separate &ldquo;German corporate index&rdquo; distinct from the Euro-area one). Country-specific eurozone credit risk shows up on the <em>sovereign</em> side instead (the Treasury tab&apos;s Italy-Germany &ldquo;BTP-Bund&rdquo; and France-Germany &ldquo;OAT-Bund&rdquo; spreads), which is not duplicated here since it is a different signal.</li>
          <li><strong>China:</strong> a new, dedicated <strong>AAA Corporate-Government Spread</strong> — ChinaBond (CCDC) publishes a full corporate-bond yield curve by credit rating alongside its government curve (already used for China&apos;s 10Y sovereign yield), found via the site&apos;s own curve-tree API. Both legs are the same publisher, same 10Y tenor, same day, so the derived spread is a clean, real, China-specific corporate signal (currently ~35-40bps, ranging roughly 12-60bps over the last ~2.7 years of history pulled) — a genuine upgrade over relying on the regional Asia-Pacific EM proxy alone for China exposure.</li>
          <li><strong>United Kingdom, Canada, Japan:</strong> no free GBP, CAD or JPY-denominated corporate bond spread index exists. FRED&apos;s entire ICE BofA Indices release (all 192 series enumerated directly via its API, not just keyword search) was checked and contains zero non-USD/EUR corporate bond index. The Bank of England&apos;s own Interactive Database was also checked directly: it publishes corporate bond <em>issuance</em> flow data (gross issues, repayments, net issues by sector) but no queryable yield or spread series. Rather than leave these three UNAVAILABLE, each now shows the <strong>BIS credit-to-GDP gap</strong> instead — see below for what that is and why it was chosen over the alternatives.</li>
        </ul>
        <p className="mb-2">
          <strong>Credit-to-GDP gap for UK, Canada and Japan (new).</strong> The BIS (Bank for
          International Settlements) publishes a free, no-key SDMX API for its Total Credit
          statistics, including the credit-to-GDP <em>gap</em> — actual private-sector credit minus
          its long-run HP-filter trend, as a share of GDP. This is the literal Basel III
          countercyclical-capital-buffer indicator: the standard, official early-warning signal
          central banks themselves use for a credit boom building up ahead of a future correction.
          It was already used here for China (as &ldquo;China credit impulse&rdquo;); checking the
          same API directly (not assumed from documentation) confirmed it also covers the UK,
          Canada and Japan, with data current through 2025-Q4 for all three. As of that print: UK
          −17.8, Canada −15.3 (both well below trend, consistent with post-2022 rate-hike
          deleveraging), Japan +6.8 and <em>rising</em> (4.3 → 5.2 → 6.8 over the prior three
          quarters) — a genuinely different, real signal: Japan is the one G7 economy in this table
          currently showing a credit boom building, not a credit contraction.
        </p>
        <p className="mb-2">
          Two alternative sources were suggested and checked before settling on BIS: a Bank of
          England IADB series for &ldquo;total domestic credit growth&rdquo; (no single clean series
          code for an aggregate figure was found in the database), and Statistics Canada&apos;s
          National Balance Sheet Accounts table 38-10-0238-01 (real, and checked directly via
          StatCan&apos;s own Web Data Service metadata — but it turned out to be a{" "}
          <em>household</em>-sector-only credit summary table, not the combined household+corporate
          credit market debt it had been described as, and even a correct table would still be a
          raw, undetrended level rather than the properly risk-signed gap BIS already publishes).
          BIS was used instead because it is verified accurate, already integrated in this codebase
          for China with the same methodology, and — critically — is properly detrended: a raw
          credit-growth or loan-outstanding figure is directionally ambiguous (growth can mean
          either easing conditions or a bubble building) in a way the BIS gap is not.
        </p>
        <p>
          Because the credit-to-GDP gap measures something structurally different from a
          market-priced spread — a quantity-side credit-boom signal, quarterly, not a daily-priced
          risk premium — it is tagged &ldquo;Credit-to-GDP Gap&rdquo; on the dashboard table rather
          than shown as if it were the same kind of reading as the OAS-based rows. Read a high
          reading there as &ldquo;credit is growing faster than its trend relative to GDP,&rdquo;
          not as &ldquo;a spread has widened.&rdquo; The composite Credit Markets engine includes
          all three (UK, Canada, Japan credit-to-GDP gaps) as additional weighted inputs alongside
          the China AAA corporate-government spread and the existing US HY/IG, EM and Euro-area HY
          inputs.
        </p>
      </section>

      <section className="mb-8" id="central-bank-credit-data-verification">
        <h2 className="mb-2 text-base font-semibold text-text">
          Central Bank Credit Data Verification — the same 34-country universe as Banking, applied to credit
        </h2>
        <p className="mb-2">
          Same instruction as the Banking tab&apos;s Central Bank FSR table: &ldquo;All the countries
          which are in banking should be in Credit also.&rdquo; The Credit tab&apos;s{" "}
          <a href="/dashboard/credit#central-bank-credit-data-verification" className="text-accent hover:underline">
            /dashboard/credit
          </a>{" "}
          page now carries a 34-country table (creditDataRegistry.ts) covering the exact same G7 /
          G20-major-EM / ASEAN / CEE / Latin America / Middle East / Africa universe as the Banking
          tab&apos;s FSR registry. Unlike the FSR table, this is not a curated narrative
          classification — every reading is the BIS (Bank for International Settlements)
          Credit-to-GDP Gap, the official Basel III countercyclical-buffer indicator, pulled from the
          same free, no-key SDMX API already used for China/UK/Canada/Japan&apos;s credit-gap rows
          above (bisCreditGap.ts), now extended to all 34 countries.
        </p>
        <p className="mb-2">
          <strong>Coverage — checked directly, not assumed:</strong> BIS&apos;s Credit-to-GDP Gap
          dataflow was queried live for all 25 non-original countries before this table was built.
          19 returned real data (Brazil, Russia, South Korea, Indonesia, Mexico, Saudi Arabia, South
          Africa, Turkey, Argentina, Australia, Malaysia, Singapore, Thailand, Poland, Czech
          Republic, Hungary, Chile, Colombia, Israel) and were wired into the same
          ingestBisCreditGaps pipeline stage that already feeds Banking and Property. Six returned
          &ldquo;No data for data query&rdquo; from BIS&apos;s own API — Philippines, Romania, Peru,
          UAE, Kenya, Egypt. These six are omitted from the dashboard table entirely (rather than
          shown as an empty/unavailable row) — the underlying registry entry still records why
          (creditDataRegistry.ts), but no row is rendered, and no weaker, unverified national proxy
          was substituted in their place.
        </p>
        <p className="mb-2">
          <strong>Genuinely automatic updates, no separate check needed:</strong> this is the one
          place where the &ldquo;automate updation&rdquo; requirement was structurally easier to
          satisfy than the FSR table&apos;s HTML/RSS checks — because this data is already numeric and
          already flows through this app&apos;s normal ingestion pipeline. There is no HTML page to
          scrape or regex to anchor: the same quarterly BIS refresh that already keeps Banking&apos;s
          and Property&apos;s credit-gap inputs current keeps this table current too, automatically,
          every pipeline run. The &ldquo;As Of&rdquo; column is simply the latest point already in
          metric_series.
        </p>
        <p className="mb-2">
          <strong>Reading</strong> buckets the raw gap value using the Basel Committee&apos;s own
          materiality threshold — beyond +/-2 percentage points is treated as a genuine deviation
          from trend, not noise: &gt;+2pp is tagged &ldquo;Expanding (credit boom building)&rdquo;,
          &lt;-2pp &ldquo;Contracting&rdquo;, otherwise &ldquo;Neutral&rdquo;. This is a mechanical
          classification of the number itself, not a human-curated judgment call, unlike
          bankStanceLevel on the FSR registry.
        </p>
        <p className="mb-2">
          <strong>&ldquo;Δ vs Our Credit Score&rdquo;</strong> cross-checks this quantity-side BIS
          reading against creditRegime.ts&apos;s own market-spread-based Credit tab score, for
          countries where this app has both: an OAS-based &ldquo;STRESSED&rdquo;/&ldquo;DISLOCATED&rdquo;
          regime disagreeing with the BIS gap&apos;s &ldquo;Expanding&rdquo; reading is flagged as
          &ldquo;Credit-gap reads more stress&rdquo; or &ldquo;Spread reads more stress&rdquo; — two
          genuinely different lenses (a priced risk premium vs a structural quantity signal) that can
          legitimately disagree; the flag does not claim one is more correct than the other.
        </p>
        <p>
          <strong>Supplemental sources</strong>: the user specifically named two other well-known
          public credit datasets — the RBI&apos;s Sectoral Bank Credit Deployment data and the New
          York Fed&apos;s Household Debt and Credit Report. Both are real, freely accessible, and
          linked directly on India&apos;s and the US&apos;s rows respectively, but building actual
          ingestion for them (sector-level credit breakdowns / household-level microdata, a
          different shape of data than a single country-level score) is a distinct, larger task not
          attempted this pass — surfaced as a direct link rather than claimed as built.
        </p>
      </section>

      <section className="mb-8" id="em-debt-by-country">
        <h2 className="mb-2 text-base font-semibold text-text">
          Emerging-Market Debt — rebuilt as a structural + market + contagion engine
        </h2>
        <p className="mb-2">
          The EM Debt tab was rebuilt against a detailed institutional specification (&ldquo;EM
          Debt Systemic Risk Engine,&rdquo; 76 sections) whose core complaint was correct: an
          exchange-rate-only reading is insufficient, since FX is one transmission channel among
          many, not a proxy for debt stress itself. Every one of the spec&apos;s ~20 requested
          sub-engines (sovereign solvency, rollover risk, FX reserve adequacy, sovereign CDS,
          capital flows, foreign bond ownership, sovereign-bank nexus, corporate external debt,
          auctions, contagion, backtesting, an AI agent, a world map) was checked individually
          against what free, verified data actually supports before writing any code. What follows
          is the honest result: real structural and market data now drives the score, and every
          component the spec asked for that has no free source is disclosed here, not silently
          dropped or faked.
        </p>
        <p className="mb-2">
          <strong>What is built, and from where:</strong>
        </p>
        <ul className="mb-2 list-inside list-disc space-y-1">
          <li><strong>Structural vulnerability</strong> — World Bank Open Data API (free, no key, verified live): government debt/GDP, external debt/GNI, external debt service/exports, short-term external debt/reserves, reserve adequacy (months of imports), current account/GDP, real GDP growth, and fiscal balance/GDP. Annual data, cross-sectionally z-scored against the 14-country EM peer set at each observation — the spec&apos;s own instruction (&ldquo;do not use universal debt/GDP thresholds… use peer groups&rdquo;), and the only sensible basis anyway, since an annual series never accumulates the ~20 points a time-series z-score needs. Coverage genuinely varies: World Bank&apos;s International Debt Statistics excludes several upper-middle/high-income economies in the tracked set from its external-debt-ratio family (Poland, Hungary, the Czech Republic, Malaysia and South Korea have no WDI external-debt-to-GNI series, for instance), and the government-debt and fiscal-balance ratios specifically have no WDI data for a different subset (Indonesia, China, the Philippines, Poland and the Czech Republic) — each row&apos;s &ldquo;coverage&rdquo; percentage discloses this directly, and most of these specific gaps are now patched from other free sources (see below). A genuine, verified example: Turkey&apos;s short-term external debt exceeded 100% of total reserves in the 2024 observation — short-term FX obligations larger than the reserves available to meet them, a real rollover-risk red flag, not a synthetic one.</li>
          <li><strong>Gap-filling the World Bank coverage holes above</strong>, checked and sourced individually rather than left blank: (1) <strong>government debt/GDP</strong> for Indonesia, China, the Philippines, Poland and the Czech Republic — IMF&apos;s Global Debt Database (free, no key; &ldquo;190 advanced economies, emerging market economies and low-income countries, dating back to 1950&rdquo;) genuinely has this for all five, verified live (China 88.3%, Indonesia 40.2%, Philippines 57.1%, Poland 55.3%, Czech Republic 43.0%, all 2024). (2) <strong>fiscal balance/GDP</strong> for China and Indonesia — IMF&apos;s World Economic Outlook database has &ldquo;net lending/borrowing, general government, % of GDP&rdquo; for both; since WEO is a projections database, only observations at least a full calendar year old are used, to avoid quietly ingesting a multi-year-ahead forecast as if it were an observed fact. (3) <strong>external debt/GNI</strong> for the Czech Republic and Hungary — World Bank&apos;s own Quarterly External Debt Statistics (QEDS), a separate, broader-coverage product from the WDI ratio family, has a real gross external-debt-position figure for both (Czech Republic $273.6bn, Hungary $313.6bn, both 2026 Q1), divided here by World Bank&apos;s own GNI level to build the ratio. Two further patches were attempted and explicitly rejected on data-quality/methodology grounds rather than used anyway: QEDS&apos;s short-term-debt breakdown for these same two countries returns mostly stale (2016) or literal-zero values, and its &ldquo;debt service&rdquo; series are forward-looking scheduled-payment buckets, not a trailing-12-month actual comparable to WDI&apos;s ratio — both stay genuinely unavailable rather than being filled with a shaky or mismatched substitute. Poland, Malaysia and South Korea were checked the same way for all three external-debt-family gaps: Poland and Korea have no QEDS data at all (checked directly, every page), and Malaysia&apos;s latest QEDS observation is from 2016 — too stale to use.</li>
          <li><strong>Sovereign CDS</strong> — no free live feed exists for actual credit-default-swap pricing (ICE/Markit-licensed, checked directly). Aswath Damodaran (NYU Stern) publishes a free, no-login annual workbook with a real &ldquo;10-year CDS Spreads&rdquo; sheet — actual observed market levels where a market maker quotes one (his own separate ratings-derived synthetic spread column is deliberately not used, since it adds no information beyond the credit rating itself). This is disclosed as a single point-in-time annual snapshot, not a daily feed — there is no &ldquo;CDS acceleration&rdquo; signal here because there is nothing to accelerate from one observation. Argentina and a few others show no CDS at all in this dataset (no market quotes one), left unavailable rather than backfilled.</li>
          <li><strong>Market/FX</strong> — the existing 14-currency composite (see the &ldquo;prominent EM currencies&rdquo; work below) blended with the CDS reading above. Own-history time-series z-score, unchanged mechanism from before.</li>
          <li><strong>Contagion breadth</strong> — the fraction of the 14 tracked economies currently at Funding-Stress-or-worse (vulnerability score ≥ 60), scaled so the spec&apos;s own stated calibration (&ldquo;40%+ stressed = CRITICAL&rdquo;) maps to a 100 score. Not weighted by GDP, creditor exposure or trade linkages (no free data supports that weighting) — a plain breadth count, disclosed as such.</li>
          <li><strong>Latent risk / market-led-warning flags</strong> — genuinely computed per country: &ldquo;latent&rdquo; means structural score ≥ 55 while market score stays below 40 (fundamentals deteriorating before the market notices — the spec&apos;s highest-priority feature); &ldquo;market-led&rdquo; is the reverse (market pricing running materially ahead of fundamentals). Both read directly from the same real data above, not asserted.</li>
          <li><strong>7-stage crisis staging</strong> (spec&apos;s &ldquo;Stage 1: Early Warning&rdquo; → &ldquo;Stage 7: Default/Restructuring&rdquo; framework) — built as a finer 7-band split of the same 0-100 vulnerability score (bands at 15/30/45/60/75/90, matching the app&apos;s existing severity palette exactly), with Stage 2 (Early Warning) and Stage 4 (Market Repricing) each promoted — never demoted — whenever the latentRisk or marketLedWarning flag above is true for that country, so a country whose fundamentals are quietly deteriorating is never shown at Stage 1. <strong>Stage 7 (&ldquo;Acute Crisis&rdquo;) is disclosed honestly as a score band, not a detected default</strong> — no free data source can confirm an actual sovereign default or restructuring event, so this stage means &ldquo;as severe as this model can measure,&rdquo; not &ldquo;default has occurred.&rdquo; The composite engine score gets its own stage (shown at the top of the dashboard page), and each country&apos;s individual stage is shown in the per-country table below it.</li>
          <li><strong>Corporate FX debt</strong> (BIS International Debt Securities statistics, free, no key, verified live for all 14 countries) — non-financial-corporate foreign-currency bonds outstanding in international markets, divided by World Bank GDP. A second EM Debt spec was supplied with the exact free-source hierarchy to check (IMF/BIS/World Bank first), and this BIS dataset genuinely covers it: e.g. India&apos;s corporates had $27.0bn, Mexico&apos;s $132.0bn, in foreign-currency international bonds outstanding as of 2026 Q1 — real, verified figures. Disclosed as a partial proxy: this is bond-market issuance only, not FX-denominated bank loans or domestically-issued FX debt, which BIS does not compile at this granularity for free.</li>
          <li><strong>Foreign ownership of local debt securities / a capital-flow-direction proxy</strong> (IMF Portfolio Investment Positions, formerly CPIS, free, no key) — previously declined (see below for why that call was reconsidered). Querying the dataset with a tracked country as counterpart returns one series per voluntarily-reporting creditor economy — 64 to 75 of them per country as of the 2023 vintage — which are summed to an aggregate foreign-holdings figure (e.g. India $79.1bn, China $561.9bn, sanity-checked against known market sizes and, for India, a realistic concentration in known FPI-routing jurisdictions like Singapore and Mauritius). The score actually used is the <strong>year-over-year change</strong> in that aggregate, not its level — this is far more robust to a persistently-incomplete reporter set than the level would be, since whichever creditors don&apos;t report tend to be missing in both years being compared, so the YoY delta still moves with real exposure changes among whoever does report.</li>
        </ul>
        <p className="mb-2">
          <strong>Blending (spec §31, adaptive weighting):</strong> the final score blends structural,
          market and contagion buckets with weights that shift by contagion breadth itself — the one
          real cross-country signal available — rather than an invented regime detector: roughly
          50/30/20 (structural/market/contagion) when breadth is low, moving toward 25/40/35 as more
          of the tracked set deteriorates simultaneously. FX/OAS alone is now at most 40% of the
          final score, directly answering the spec&apos;s core objection. The structural bucket
          itself now blends 10 indicators (the original 8 World Bank series plus the corporate
          FX debt and foreign-holdings-YoY signals above), each weighted and cross-sectionally
          z-scored the same way.
        </p>
        <p className="mb-2">
          A follow-up institutional specification (&ldquo;Emerging Debt Engine&rdquo;) supplied a
          documented free-source hierarchy — IMF SDMX API, BIS bulk/API endpoints, World Bank
          QEDS — and asked that each previously-declined component be re-checked against it before
          accepting the earlier conclusion. That re-check is what produced the corporate-FX-debt
          and foreign-holdings components above: the original &ldquo;no free source&rdquo; call on
          foreign ownership specifically was too hasty — IMF PIP is real and does work, once the
          risk signal is built as a YoY delta rather than a raw level (which is where the original,
          correct concern about reporting gaps actually bites).
        </p>
        <p className="mb-2">
          <strong>What is still not built, and why — disclosed, not dropped:</strong>
        </p>
        <ul className="mb-2 list-inside list-disc space-y-1">
          <li><strong>Full capital-flow reconstruction (bond/equity/ETF/fund flows, daily-to-monthly frequency).</strong> EPFR and IIF, the standard sources for this, are paid with no free tier found. The IMF PIP-based YoY signal above is a genuine but partial substitute — annual, not daily/monthly, and a position-level view rather than a true flow series.</li>
          <li><strong>A true domestic sovereign-bank nexus</strong> (bank balance-sheet holdings of their own country&apos;s government debt — the classic &ldquo;doom loop&rdquo;). Re-checked directly against this pass&apos;s new source list: IMF&apos;s Financial Soundness Indicators dataset has an indicator that looks exactly right (&ldquo;sectoral distribution of investments: central government, percent&rdquo;, reported by deposit-taking banks) — but querying it live returns no populated series for any of the 14 tracked countries at any sector code tried. BIS&apos;s Consolidated Banking Statistics were also checked and found to measure a different thing (cross-border bank claims by foreign creditor banks, not domestic banks&apos; own-sovereign holdings) — useful for a common-lender contagion view, not this specific metric. Genuinely not available free at this granularity, not merely unchecked.</li>
          <li><strong>Auction-level stress</strong> (bid-to-cover, tail, auction-secondary spread). No free aggregator exists; the spec&apos;s own national source list (RBI, ÁKK, Banxico, PDMO, etc.) would need ~14 separate, heterogeneous national debt-office integrations, each with its own format and parser — a real, large effort, not attempted this pass.</li>
          <li><strong>Backtesting against historical EM crises, a world-map/maturity-wall UI, an AI chat agent, a daily report, a vintage-aware &ldquo;what did GFMI know on date X&rdquo; database, and a from-scratch Python/DuckDB/Parquet data-lake rearchitecture.</strong> The backtesting needs the still-unavailable full flow/auction data above as historical input. The rest are large net-new product or infrastructure asks (this app has no chat agent, scheduled-report, or vintage-tracking infrastructure today, and runs on Next.js/Supabase rather than the spec&apos;s suggested Python/FastAPI/DuckDB stack) rather than data-sourcing gaps — out of scope for an incremental pass on an existing production app.</li>
        </ul>
        <p>
          The per-country table on the dashboard shows every structural indicator, the CDS reading,
          the FX reading, and both derived scores per country — so a single blended headline number
          never hides which specific country, and which specific factor, is actually driving it.
        </p>
      </section>

      <section className="mb-8" id="em-debt-fx-coverage">
        <h2 className="mb-2 text-base font-semibold text-text">
          Emerging-Market Debt — the underlying FX coverage (prominent EM currencies)
        </h2>
        <p className="mb-2">
          The market/FX side above draws on all 14 <strong>MSCI Emerging Markets constituents that
          the ECB itself publishes a daily reference rate for</strong>: Brazil, Mexico, South
          Africa, Turkey, India, Indonesia, China, the Philippines, Poland, Hungary, the Czech
          Republic, Thailand, Malaysia and South Korea — verified directly against
          Frankfurter&apos;s (the ECB reference-rate mirror already used elsewhere in this project)
          own currency list rather than assumed.
        </p>
        <p>
          Taiwan, Chile, Colombia, Peru, Saudi Arabia, the UAE, Qatar and Kuwait are also prominent
          EM debt issuers (several are MSCI EM constituents themselves), but the ECB does not
          publish reference rates for TWD/CLP/COP/PEN/SAR/AED/QAR/KWD — checked directly, not
          assumed — so no free daily FX source was reused for them here.
        </p>
      </section>

      <section className="mb-8" id="india-yield-curve-ccil">
        <h2 className="mb-2 text-base font-semibold text-text">
          India Yield Curve (new tab), and why CCIL is not used as a source
        </h2>
        <p className="mb-2">
          <strong>CCIL</strong> (the Clearing Corporation of India) publishes the industry-standard
          secondary-market reference for India&apos;s sovereign curve — its daily Zero Coupon Yield Curve —
          and was the first source checked for a fuller India debt-market picture. It was deliberately not
          used: CCIL&apos;s own Terms of Use, read in full, explicitly state (§4.8) that &ldquo;the User
          shall not conduct any systematic or automated data collection activities which include but are
          not limited to scrapping, data mining, data extraction and data harvesting&rdquo; on its site, and
          separately (§4.1) prohibit any commercial use of its published Content without CCIL&apos;s express
          written consent. This is a legal access restriction stated in plain language, not a technical bot
          block — but this project treats the two the same way: it does not circumvent either kind of
          restriction to reach data a source has said it does not want scraped. (Compare the Imperva/TSPD
          JS bot-mitigation challenge on RBI&apos;s own PDF subdomain, rbidocs.rbi.org.in, discussed above —
          same principle, different mechanism.)
        </p>
        <p className="mb-2">
          Instead, the new <strong>India Yield Curve</strong> engine is built entirely from RBI&apos;s own
          primary-auction results — genuine cut-off yields the government actually borrowed at, published
          as ordinary press releases on rbi.org.in (not gated in any way):
        </p>
        <ul className="mb-2 list-inside list-disc space-y-1">
          <li>
            <strong>Short</strong> (91-day and 364-day): the weekly &ldquo;T-Bill Auction Result:
            Cut-off&rdquo; release.
          </li>
          <li>
            <strong>Medium</strong> (residual maturity ≤8 years, e.g. 5Y/7Y reissues) and{" "}
            <strong>long</strong> (&gt;8 years, e.g. 10Y/14Y/30Y/40Y): the &ldquo;Government Stock - Auction
            Results: Cut-off&rdquo; release, bucketed by each auctioned security&apos;s maturity year minus
            the release&apos;s own year. When a release also auctions a Sovereign Green Bond or another
            non-standard instrument alongside ordinary G-Secs, only the plain G-Secs are bucketed — the
            others are skipped, not guessed.
          </li>
          <li>
            A continuous long-end cross-check, <span className="gfew-mono">india.gsec_10y</span>, from the
            OECD/FRED-mirrored India 10Y benchmark (monthly) — since RBI&apos;s own borrowing calendar
            doesn&apos;t auction a 10Y-ish security every week, this fills the gap between auctions.
          </li>
        </ul>
        <p className="mb-2">
          Three derived spreads read the curve&apos;s shape directly: 1Y-10Y (the primary inversion gauge —
          India has no liquid 2Y benchmark, so this plays the role the 2s10s spread plays in the US), 1Y-5Y
          (front-end steepness) and 5Y-10Y+ (back-end steepness) — each shown as its own live indicator on
          the India Yield Curve tab, with a plain-language read of which end is currently steeper and
          whether the curve has inverted. Because the medium/long buckets only update on weeks RBI actually
          auctions a security in that bucket, they are genuinely irregular (not a pipeline fault) — this is
          disclosed directly on the engine.
        </p>
        <p>
          <strong>Seasonal liquidity pattern (Diwali / fiscal year-end):</strong> India has a well-documented
          pattern of banking-system liquidity tightening in the weeks before Diwali (festive currency demand
          pulls cash out of the banking system) and again in the back half of March (advance-tax payments due
          March 15, plus the March 31 fiscal year-end) — both repeatedly reported by RBI and financial press
          across recent years. This project checks that pattern directly against its own backfilled RBI
          history (india.rbi_net_liquidity/india.wacr, extended via RBI&apos;s own year/month press-release
          archive — a genuine, publicly-advertised feature of rbi.org.in&apos;s press-release page,
          reached the same way a browser would: replicating its own postback rather than a bypass of
          anything) rather than only asserting the pattern in prose — shown as a &ldquo;Seasonal Pattern&rdquo;
          panel on the India Liquidity tab, with real computed averages and observation counts, and years with
          too little backfilled history yet named as such rather than papered over.
        </p>
      </section>

      <section className="mb-8" id="horizon-differentiation">
        <h2 className="mb-2 text-base font-semibold text-text">Engine scoring, and why short/medium/long differ</h2>
        <p className="mb-2">
          Each engine tracks a set of indicators, classified leading, coincident or lagging. For each
          indicator with at least 20 trailing observations, we compute a trailing z-score and map it onto a
          0-100 risk scale (0 = 3 standard deviations &ldquo;calmer than usual&rdquo;, 100 = 3 standard
          deviations more stressed than usual). The engine score is the completeness-weighted average of
          its indicators&apos; scores. An indicator whose trailing window has been perfectly flat (zero
          variance — e.g. a status-event count sitting at 0 for weeks) scores as exactly neutral (50) while
          it stays flat, and jumps to the scale&apos;s extreme the moment it departs from that constant
          baseline at all, rather than being dropped as &ldquo;insufficient data&rdquo;: a genuinely
          unchanging series carries real information (calm), and a first departure from it is maximally
          notable relative to its own history even before enough of a track record exists to size it precisely.
        </p>
        <p className="mb-2">
          The z-score window and each indicator&apos;s weight both change by horizon, following the
          near-term/medium-term split used in practice by the IMF Global Financial Stability Report and the
          Fed Financial Stability Report (near-term risk read off market-price signals; medium/long-term
          vulnerability read off structural buildups like leverage and debt) and BIS&apos;s financial-cycle
          framing (credit/GDP gaps and property prices measured over multi-year windows): short-term uses a
          ~63-observation (one trading quarter) window and up-weights leading/coincident indicators;
          medium-term uses the ~252-observation (one trading year) baseline window with indicators weighted
          as configured; long-term uses a ~756-observation (three trading year) window and up-weights
          lagging/structural indicators. This is why the three horizons for the same engine are not the
          same number — they are answering different questions from the same data, not the same question
          three times.
        </p>
        <p>
          An engine&apos;s <em>confidence</em> is not the same as its <em>data completeness</em>. Data
          completeness is the plain fraction of an engine&apos;s intended indicator set that currently has
          usable (LIVE, RECENT or STALE) data — this can honestly be 100% when every indicator is populated.
          Confidence folds in each indicator&apos;s freshness (a STALE indicator counts for less than a LIVE
          one) and is then multiplied by a horizon-specific discount factor — 0.95 short-term, 0.88
          medium-term, 0.75 long-term — applied at every data-quality level, not just as a ceiling near
          perfect data, so it can never reach 100% and is always lowest for the longest horizon: forecast
          uncertainty compounds with horizon the same way a central bank&apos;s fan chart widens further
          out, and a model score should never claim absolute certainty about anything.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-text">GFMI composite</h2>
        <p>
          The Global Financial Meltdown Index is a confidence- and weight-adjusted average of engine
          scores, then passed through a multi-shock amplifier: when two or more independent engines are
          simultaneously elevated (score ≥ 60), the composite is bumped above the plain weighted average
          (up to +25%), since correlated stress across independent risk dimensions has historically been
          more dangerous than any single elevated reading in isolation. A crisis-override rule additionally
          forces the label to GLOBAL_DELEVERAGING_REGIME when GFMI &gt; 75 with VIX &gt; 35 and the credit
          engine &gt; 70, or SYSTEMIC_CRISIS_REGIME when GFMI &gt; 90 — the exact rule that fired is always
          shown alongside the score. The same 15/30/45/60/75/90 band thresholds that produce this regime
          label are also shown on the main dashboard as a 7-stage stepper (Low Systemic Risk → Watch →
          Vulnerability Building → High Systemic Risk → Crisis Developing → Major Deleveraging → Systemic
          Crisis), the same presentation used for the EM Debt engine&apos;s per-country crisis stages — it
          is not a second, independently-computed model, just a named view over the one composite score.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-text">Source hierarchy &amp; data quality</h2>
        <p>
          Sources are tiered: Tier 1 (official primary — FRED, CFTC, central-bank feeds), Tier 2
          (multilateral institutions), Tier 3 (licensed market-data aggregators, e.g. Stooq), Tier 4
          (licensed financial news), Tier 5 (verified official social accounts). Every displayed value
          carries a freshness status — LIVE, RECENT, STALE or UNAVAILABLE — computed from its age relative
          to its own publication frequency. Data is never silently backfilled or estimated to hide a gap;
          missing coverage is shown as UNAVAILABLE.
        </p>
        <p className="mt-2">
          A STALE badge on an indicator that updates daily (equities, FX, Treasury yields) would mean
          something is actually broken — that has never been observed in production. STALE on an
          internationally-sourced or annual-disclosure indicator instead reflects genuine publication lag in
          the underlying official source itself, confirmed directly against that source&apos;s own metadata
          rather than assumed: G7 government debt/GDP ratios and AI-engine debt-maturity schedules are
          annual figures (IMF-compiled debt ratios often carry a further multi-month-to-multi-year
          compilation lag; debt-maturity schedules are 10-K-only disclosures, refreshed once a year per
          company) and are compared against an annual-cadence threshold rather than a monthly or quarterly
          one for exactly this reason; Italy, France, Japan and China&apos;s interbank rate still come from
          OECD-compiled monthly series that structurally publish 2-4 months behind (UK, Germany, Canada and
          China&apos;s 10Y yield moved to their own central bank/depository&apos;s daily series and no
          longer carry this lag — see Country coverage above), and BIS real house-price indices typically
          lag one to two quarters. None of this
          means the pipeline missed anything newer — where we&apos;ve checked, our stored value already
          matches the freshest observation the source has ever published.
        </p>
        <p className="mt-2">
          Bitcoin and Ethereum spot price come from Yahoo
          Finance&apos;s chart endpoint (Tier 3), not investing.com — investing.com has no free public API,
          and scraping its site would break the no-scraping/official-source-only rule every other connector
          in this platform follows; Yahoo publishes genuine multi-year daily history for both, which fixed
          a real gap where the Crypto/Stablecoins engine sat below its 20-observation z-score floor for
          weeks after every fresh deploy (CoinGecko&apos;s free tier is a live snapshot only, with no
          historical backfill). CoinGecko remains the source for total market cap, BTC dominance and
          stablecoin peg/supply, which Yahoo doesn&apos;t publish.
        </p>
      </section>

      <section className="mb-8" id="commodities-engine">
        <h2 className="mb-2 text-base font-semibold text-text">Commodities</h2>
        <p className="mb-2">
          Built against a ~115-section Commodity Intelligence Platform spec covering a full price/production/
          consumption/inventory/trade/forecast/India-risk system across roughly 60 commodities. That spec also
          calls for its own new database schema (UUID-keyed commodity/country/source tables); per its own
          engineering rules (§112-113 — &ldquo;adapt to the existing repository,&rdquo; &ldquo;never create
          duplicate functionality&rdquo;), this instead reuses the same <code className="gfew-mono">metric_series</code>{" "}
          fact table and config-in-code source pattern every other engine on this platform already uses, rather
          than standing up a second, parallel schema.
        </p>
        <p className="mb-2">
          <strong>Phase 1 (shipped)</strong>: real monthly commodity prices since 1960 from the World Bank
          Commodity Price Data workbook (&ldquo;the Pink Sheet&rdquo; — free, no key), covering ~50 commodities
          across Energy, Base Metals, Precious Metals, Grains, Oilseeds, Soft Commodities, Livestock/Dairy,
          Fertilizers and Forestry — the download link is scraped live from the World Bank&apos;s own page rather
          than hardcoded, since its hash changes across releases. A price-momentum signal (not the spec&apos;s
          full Commodity Direction Score) z-scores each commodity&apos;s 1M/3M/6M/12M/36M returns against that
          same commodity&apos;s own trailing return history, blends them per the spec&apos;s own horizon weights,
          and classifies the result into the spec&apos;s own STRONG POSITIVE..STRONG NEGATIVE buckets — see the{" "}
          <a href="/dashboard/commodities" className="text-accent hover:underline">
            Commodities page
          </a>{" "}
          for the full disclosure of what this is and isn&apos;t measuring. Checked directly against the Pink
          Sheet and confirmed absent: all eight critical minerals and a distinct OPEC Basket series.
        </p>
        <p className="mb-2">
          <strong>Phase 1b (shipped)</strong>: six of those eight critical minerals turned out to be real,
          free, no-key data after all — just not through IMF&apos;s own broken API (both
          <code className="gfew-mono"> dataservices.imf.org</code> and{" "}
          <code className="gfew-mono">api.imf.org/external/sdmx/3.0</code> were checked live and are
          dead/404). The IMF Primary Commodity Price System dataset is mirrored, live and free, by{" "}
          <a href="https://db.nomics.world/IMF/PCPS" className="text-accent hover:underline" target="_blank" rel="noreferrer">
            DBnomics
          </a>
          , an open-source data aggregator — verified series-by-series against IMF&apos;s own published unit
          documentation and known market price history (e.g. the mirrored Lithium series spikes to ~$410k/mt
          in November 2022 and collapses through 2023-2025, consistent with the real lithium price crash on a
          contained-metal basis) before wiring in. This adds Cobalt, Lithium, Manganese, Molybdenum, Vanadium
          Pentoxide, and a Rare Earth Elements basket as a new &ldquo;Critical Minerals&rdquo; category.
          Graphite, Tungsten, and the OPEC Reference Basket remain genuinely absent from both free sources
          checked (EIA v2&apos;s international dataset publishes Brent/WTI/Dubai spot prices only, no ORB
          series; opec.org&apos;s own basket page returns HTTP 403 to unauthenticated requests).
        </p>
        <p className="mb-2">
          <strong>Phase 2 (shipped)</strong>: a real global supply-demand balance table — annual world
          production, consumption, and ending stocks for 20 commodities (Grains, Oilseeds, Soft Commodities,
          Livestock/Dairy) from USDA FAS&apos;s Production, Supply and Distribution (PSD) database. Free, no key,
          no login — but not via the gated <code className="gfew-mono">apps.fas.usda.gov/OpenData</code> API
          (needs an API key); instead the ~2 million row bulk CSV download (
          <code className="gfew-mono">psdonline/downloads/psd_alldata_csv.zip</code>) that needs no auth at all.
          Computing correct world totals took real care: PSD sometimes reports EU production only as a bloc
          (codes E2/E3/E4) with no individual member-country rows — true for Wheat, where naively excluding the
          bloc code undercounts world production by ~15% (verified live: adding it back moves the 2022 total
          from ~656M to ~790M tonnes, matching published figures) — and sometimes reports EU members
          individually alongside the bloc in the same years — true for Sugar, 2001-2005, which would
          double-count if both were summed. Resolved per commodity/year: prefer the member-country sum when it
          exists for that year, fall back to the bloc figure otherwise. Stocks-to-use (ending stocks ÷
          consumption) is shown as the standard tightness signal.
        </p>
        <p className="mb-2">
          <strong>Phase 2b (shipped)</strong>: world Petroleum &amp; Other Liquids, Natural Gas, and Coal
          production/consumption from the EIA international dataset&apos;s own pre-computed{" "}
          <code className="gfew-mono">countryRegionId=WORL</code> aggregate — not summed from the 16-country list
          the Energy tab uses, since EIA publishes a true world total directly (verified against known published
          figures: 2025 petroleum &amp; other liquids production ~106M bbl/day, 2024 natural gas
          production/consumption ~149 Tcf, 2024 coal production/consumption ~8.8 billion MT). EIA has no
          &ldquo;crude oil consumption&rdquo; concept at all — checked live, the query returns zero rows, since
          crude isn&apos;t consumed directly, it&apos;s refined first — so production and consumption pair up at
          the broader &ldquo;Total petroleum and other liquids&rdquo;/&ldquo;Refined petroleum products&rdquo;
          level instead, the same convention eiaApi.ts already uses for country-level balances. Also added: Cocoa,
          Tea, Rubber, and Tobacco world production from FAOSTAT&apos;s bulk data file (production only — FAOSTAT
          doesn&apos;t publish consumption/stocks in this domain, so those columns show a blank rather than a
          fabricated figure). FAOSTAT&apos;s live JSON API (fenixservices.fao.org) is unreachable from this
          deployment — TLS connects but the request hangs indefinitely, the same symptom seen earlier with USGS
          ScienceBase, consistent with a bot challenge that never resolves for non-browser clients — so this uses
          FAOSTAT&apos;s S3/CloudFront-hosted bulk CSV instead, which has no such issue. Its &ldquo;World&rdquo;
          row (Area Code 5000) is a pre-computed aggregate published by FAO itself, unlike USDA PSD&apos;s bulk
          file — no EU-style double-counting risk there.
        </p>
        <p className="mb-2">
          <strong>Genuinely still to build</strong>: production data for base/precious metals — checked live,
          USGS publishes this but only as annual PDFs (Mineral Commodity Summaries), and this app has no
          PDF-parsing infrastructure yet, so it&apos;s deferred rather than silently skipped — the full weighted
          Commodity Direction Score combining price momentum with this balance data, a UN Comtrade-based
          commodity trade network, an India-specific production/consumption/import-dependency view, a Global
          Commodity Stress Index, an early-warning alert engine, a scenario/what-if simulator, model backtesting,
          and fundamental reference-value/price-forecast models.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-text">What we don&apos;t do</h2>
        <ul className="list-inside list-disc">
          <li>We do not fabricate market prices, quotes, speeches, filings or sources.</li>
          <li>We do not present a scenario or model estimate as a guaranteed forecast.</li>
          <li>We do not issue buy/sell recommendations.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-text">Update cadence</h2>
        <p>
          Data ingestion and score recomputation run once daily via an automated, unattended pipeline,
          scheduled inside a window that starts after the US market close and finishes before the Tokyo
          market open — so no visible change happens mid-session anywhere in the world. See{" "}
          <code className="gfew-mono">/dashboard/sources</code> for the run log.
        </p>
      </section>
    </div>
  );
}
