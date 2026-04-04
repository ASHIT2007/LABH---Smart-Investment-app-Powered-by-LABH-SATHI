/**
 * Curated threat / geopolitical context for the Threat Globe (non-market copy).
 * Stock prices and session % come from Yahoo at request time (see lib/yahoo-live.js).
 * Keys: ISO 3166-1 alpha-2 (uppercase).
 */

export const COUNTRY_IMPACT_BY_CODE = {
  TW: {
    countryName: "Taiwan",
    threatType: "Geopolitical / Taiwan Strait tensions",
    threatDescription:
      "Elevated military posture and sanctions rhetoric around semiconductor supply chains are amplifying volatility for global tech hardware names exposed to the region.",
    newsSources: [
      "TSMC supplier delays flagged as Strait shipping insurers tighten terms — Reuters",
      "Taiwan dollar whipsaws on cross-strait commentary; tech funds rebalance — FT",
      "U.S.–China chip curbs: analysts cut wafer fab utilization forecasts for Q3 — Bloomberg",
    ],
    affectedStocks: [
      { ticker: "TSM", name: "Taiwan Semiconductor" },
      { ticker: "2330.TW", name: "TSMC (Taipei)" },
      { ticker: "ASML", name: "ASML Holding" },
      { ticker: "AVGO", name: "Broadcom Inc." },
    ],
    investmentVerdict:
      "The conflict channel runs through advanced-node capacity and lithography lead times: any perceived closure of the Strait reroutes components and lifts input costs for fabs outside Taiwan. That pressures margin for foundry-heavy names near term but can benefit diversified equipment vendors. Currency risk (TWD/USD) adds a separate squeeze for unhedged revenue. In this app’s simulated book, treat dips as liquidity events rather than structural turns—scale in only with a pre-defined risk budget and prefer names with geographically diversified packaging/test footprints.",
  },
  UA: {
    countryName: "Ukraine",
    threatType: "Armed conflict / Commodity corridor risk",
    threatDescription:
      "Ongoing hostilities keep grain, energy, and industrials sensitive to ceasefire headlines and sanctions enforcement across the Black Sea basin.",
    newsSources: [
      "Black Sea grain insurance costs jump after latest drone incidents — WSJ",
      "EU mulls new defense procurement credits; Eastern Europe equities gap higher — FT",
      "Wheat futures spike intraday on corridor uncertainty — MarketWatch",
    ],
    affectedStocks: [
      { ticker: "ADM", name: "Archer-Daniels-Midland" },
      { ticker: "NTR", name: "Nutrien Ltd." },
      { ticker: "BA", name: "Boeing Co." },
      { ticker: "FLR", name: "Fluor Corp." },
      { ticker: "EPOL", name: "iShares MSCI Poland ETF" },
    ],
    investmentVerdict:
      "Ukraine-linked shocks tend to reprice soft commodities and freight faster than single-stock fundamentals. A sustained corridor disruption propagates into food inflation trades and selective infrastructure rebuild narratives. For simulated trading, broad defense and construction picks carry headline gap risk; agriculturals can mean-revert quickly once futures normalize. Size smaller-than-usual unless your thesis explicitly ties to a multi-quarter supply squeeze.",
  },
  IL: {
    countryName: "Israel",
    threatType: "Regional security / Middle East flashpoint",
    threatDescription:
      "Sudden risk-off moves in regional assets with knock-on effects for cybersecurity, defense primes, and energy volatility across OECD markets.",
    newsSources: [
      "Tel Aviv indices trim gains as safe-haven flows lift USD — Haaretz / wire",
      "Cybersecurity vendors see inbound enterprise RFP spike after regional outages — CTech",
      "Brent crude jumps 2% on MENA risk premium — Reuters",
    ],
    affectedStocks: [
      { ticker: "CYBR", name: "CyberArk Software" },
      { ticker: "CHKP", name: "Check Point Software" },
      { ticker: "LMT", name: "Lockheed Martin" },
      { ticker: "NICE", name: "Nice Ltd." },
    ],
    investmentVerdict:
      "Regional escalation compresses multiples on local tech exporters while lifting perceived demand for zero-trust and sovereign cloud. Energy tails add inflation volatility that hurts long-duration growth unless hedged. In-app, cybersecurity names may overshoot on flow—fade parabolic opens unless confirmed by contract data. Consider staggered entries and tight stops on defense-linked proxies that gap on political tweets.",
  },
  IR: {
    countryName: "Iran (regional spillover)",
    threatType: "Sanctions / Energy supply risk",
    threatDescription:
      "Sanctions friction and chokepoint anxiety keep oil curves steep and stress shipping rates through the Gulf.",
    newsSources: [
      "Tanker rates climb as operators avoid certain Gulf load windows — Lloyd’s List",
      "Strait monitoring firms flag higher transit insurance quotes — Argus",
      "India refiners reassess term crude splits amid OPEC+ noise — Economic Times",
    ],
    affectedStocks: [
      { ticker: "XOM", name: "Exxon Mobil" },
      { ticker: "COP", name: "ConocoPhillips" },
      { ticker: "FRO", name: "Frontline Ltd." },
      { ticker: "SBLK", name: "Star Bulk Carriers" },
    ],
    investmentVerdict:
      "The transmission mechanism is crude availability and refining margins, not local equity access. Spikes often reverse when spare capacity narratives return. For retail simulation, energy majors offer liquid beta but carry OPEC headline risk; tankers are higher convexity and more path-dependent. Avoid sizing tankers like supermajors—treat them as event options with asymmetric drawdowns.",
  },
  VE: {
    countryName: "Venezuela",
    threatType: "Political instability / Hyperinflation legacy",
    threatDescription:
      "Sovereign stress and energy diplomacy headlines periodically move heavy-oil differentials and select LatAm ADRs.",
    newsSources: [
      "Heavy sour differentials widen onexport chatter — Argus Media",
      "LatAm debt funds trim Venezuela-exposed paper — Bloomberg",
      "Chevron joint-venture path watched by U.S. policymakers — Reuters",
    ],
    affectedStocks: [
      { ticker: "CVX", name: "Chevron Corp." },
      { ticker: "PBR", name: "Petrobras" },
      { ticker: "VAL", name: "Valaris Ltd." },
      { ticker: "SLB", name: "SLB (Schlumberger)" },
    ],
    investmentVerdict:
      "Venezuela narratives mostly reprice heavy crude spreads and politically linked oil equities rather than broad indices. Moves can be sharp but information-sparse. In simulated portfolios, treat related trades as tactical: confirm with volume and sector breadth before chasing gaps, and be mindful that regulatory headlines can invalidate a thesis overnight.",
  },
};

export function getCountryImpactPayload(countryCode) {
  const code = String(countryCode || "").toUpperCase();
  return COUNTRY_IMPACT_BY_CODE[code] || null;
}
