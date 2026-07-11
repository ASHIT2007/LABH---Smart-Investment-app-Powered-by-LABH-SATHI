/**
 * Geographic threat-globe zones (WGS84) + tickers to quote on Yahoo.
 * Headlines are filled server-side via Groq + live prices.
 */

export const GLOBE_THREAT_ZONE_DEFS = [
  {
    id: "gulf",
    lat: 25.2048,
    lng: 55.2708,
    regionLabel: "United Arab Emirates (Gulf)",
    threatName: "Middle East — energy & shipping risk",
    topStocks: [
      { ticker: "XOM", name: "Exxon Mobil" },
      { ticker: "CVX", name: "Chevron" },
      { ticker: "SLB", name: "SLB" },
      { ticker: "COP", name: "ConocoPhillips" },
    ],
    historicalEvents: [
      { name: "Israel-Hamas Conflict Start", date: "2023-10-06" }, // Pre-weekend close
      { name: "Red Sea Shipping Attacks Peak", date: "2023-12-15" }
    ]
  },
  {
    id: "ukraine",
    lat: 50.4501,
    lng: 30.5234,
    regionLabel: "Ukraine",
    threatName: "Eastern Europe — corridor & defense supply shock",
    topStocks: [
      { ticker: "BA", name: "Boeing" },
      { ticker: "LMT", name: "Lockheed Martin" },
      { ticker: "NOC", name: "Northrop Grumman" },
      { ticker: "ADM", name: "Archer-Daniels-Midland" },
    ],
    historicalEvents: [
      { name: "Russian Invasion", date: "2022-02-23" }, // Pre-invasion close
      { name: "Nord Stream Sabotage", date: "2022-09-26" }
    ]
  },
  {
    id: "scs",
    lat: 10.5,
    lng: 115.0,
    regionLabel: "South China Sea (maritime)",
    threatName: "South China Sea — trade & chip exposure",
    topStocks: [
      { ticker: "TSM", name: "TSMC (ADR)" },
      { ticker: "ASML", name: "ASML Holding" },
      { ticker: "AVGO", name: "Broadcom" },
      { ticker: "QCOM", name: "Qualcomm" },
      { ticker: "NVDA", name: "NVIDIA" },
    ],
    historicalEvents: [
      { name: "Pelosi Taiwan Visit", date: "2022-08-01" },
      { name: "US Chip Export Bans", date: "2022-10-07" }
    ]
  },
  {
    id: "brazil",
    lat: -15.7942,
    lng: -47.8822,
    regionLabel: "Brazil",
    threatName: "South America — energy & sovereign risk",
    topStocks: [
      { ticker: "PBR", name: "Petrobras" },
      { ticker: "VALE", name: "Vale" },
      { ticker: "ITUB", name: "Itaú Unibanco" },
      { ticker: "BBD", name: "Banco Bradesco" },
    ],
    historicalEvents: [
      { name: "Brazil Election Runoff", date: "2022-10-28" }
    ]
  },
  {
    id: "usa_east",
    lat: 40.7128,
    lng: -74.006,
    regionLabel: "United States (N.Y.)",
    threatName: "North America — rates & mega-cap risk",
    topStocks: [
      { ticker: "SPY", name: "SPDR S&P 500 ETF" },
      { ticker: "JPM", name: "JPMorgan Chase" },
      { ticker: "AAPL", name: "Apple" },
    ],
    historicalEvents: [
      { name: "SVB Collapse", date: "2023-03-09" },
      { name: "CPI Shock", date: "2022-09-12" }
    ]
  },
  {
    id: "uk_london",
    lat: 51.5074,
    lng: -0.1278,
    regionLabel: "United Kingdom",
    threatName: "Western Europe — energy & sterling exposure",
    topStocks: [
      { ticker: "BP", name: "BP plc" },
      { ticker: "SHEL", name: "Shell" },
      { ticker: "UL", name: "Unilever" },
    ],
    historicalEvents: [
      { name: "UK Mini-Budget Crisis", date: "2022-09-22" }
    ]
  },
  {
    id: "japan_tokyo",
    lat: 35.6762,
    lng: 139.6503,
    regionLabel: "Japan",
    threatName: "Northeast Asia — yen & exporters",
    topStocks: [
      { ticker: "TM", name: "Toyota (ADR)" },
      { ticker: "SONY", name: "Sony" },
      { ticker: "MUFG", name: "Mitsubishi UFJ" },
    ],
    historicalEvents: [
      { name: "BOJ Yield Curve Control Tweak", date: "2022-12-19" }
    ]
  },
  {
    id: "india_mumbai",
    lat: 19.076,
    lng: 72.8777,
    regionLabel: "India",
    threatName: "South Asia — EM flows & IT services",
    topStocks: [
      { ticker: "INFY", name: "Infosys (ADR)" },
      { ticker: "WIT", name: "Wipro (ADR)" },
      { ticker: "INDA", name: "iShares MSCI India ETF" },
    ],
    historicalEvents: [
      { name: "Hindenburg Adani Report", date: "2023-01-24" }
    ]
  },
  {
    id: "south_africa",
    lat: -26.2041,
    lng: 28.0473,
    regionLabel: "South Africa",
    threatName: "Southern Africa — commodity & currency beta",
    topStocks: [
      { ticker: "GFI", name: "Gold Fields" },
      { ticker: "AU", name: "AngloGold Ashanti" },
      { ticker: "SBSW", name: "Sibanye Stillwater" },
    ],
    historicalEvents: []
  },
  {
    id: "australia",
    lat: -33.8688,
    lng: 151.2093,
    regionLabel: "Australia",
    threatName: "Oceania — materials & China demand",
    topStocks: [
      { ticker: "BHP", name: "BHP Group" },
      { ticker: "RIO", name: "Rio Tinto" },
    ],
    historicalEvents: []
  },
  {
    id: "canada",
    lat: 43.6532,
    lng: -79.3832,
    regionLabel: "Canada",
    threatName: "North America — banks & energy",
    topStocks: [
      { ticker: "TD", name: "Toronto-Dominion Bank" },
      { ticker: "ENB", name: "Enbridge" },
    ],
    historicalEvents: []
  },
  {
    id: "south_korea",
    lat: 37.5665,
    lng: 126.978,
    regionLabel: "South Korea",
    threatName: "Korean Peninsula — tech & memory cycle",
    topStocks: [{ ticker: "EWY", name: "iShares MSCI South Korea ETF" }],
    historicalEvents: []
  },
  {
    id: "mexico",
    lat: 19.4326,
    lng: -99.1332,
    regionLabel: "Mexico",
    threatName: "Latin America — nearshoring & peso",
    topStocks: [
      { ticker: "AMX", name: "América Móvil" },
      { ticker: "CX", name: "Cemex" },
    ],
    historicalEvents: []
  },
  {
    id: "singapore",
    lat: 1.3521,
    lng: 103.8198,
    regionLabel: "Singapore",
    threatName: "Southeast Asia — trade & finance hub",
    topStocks: [{ ticker: "EWS", name: "iShares MSCI Singapore ETF" }],
    historicalEvents: []
  },
];
