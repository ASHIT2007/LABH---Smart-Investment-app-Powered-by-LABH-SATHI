/**
 * Mapping of Country ISO codes to representative stock market tickers and top stocks.
 * Used for the "Global Market Pulse" dots on the globe.
 */

export const GLOBAL_MARKET_TICKERS = {
  // North America
  US: {
    ticker: "^GSPC",
    name: "S&P 500 (USA)",
    topStocks: [
      { ticker: "AAPL", name: "Apple" },
      { ticker: "MSFT", name: "Microsoft" },
      { ticker: "NVDA", name: "NVIDIA" },
      { ticker: "AMZN", name: "Amazon" },
    ],
  },
  CA: {
    ticker: "^GSPTSE",
    name: "S&P/TSX Composite",
    topStocks: [
      { ticker: "RY.TO", name: "Royal Bank of Canada" },
      { ticker: "TD.TO", name: "Toronto-Dominion Bank" },
      { ticker: "SHOP.TO", name: "Shopify" },
    ],
  },
  MX: {
    ticker: "^MXX",
    name: "IPC Mexico",
    topStocks: [
      { ticker: "AMX", name: "América Móvil" },
      { ticker: "WALMEX.MX", name: "Walmart de México" },
      { ticker: "FEMSAUBD.MX", name: "Femsa" },
    ],
  },

  // Europe
  GB: {
    ticker: "^FTSE",
    name: "FTSE 100",
    topStocks: [
      { ticker: "SHEL.L", name: "Shell" },
      { ticker: "HSBA.L", name: "HSBC Holdings" },
      { ticker: "AZN.L", name: "AstraZeneca" },
    ],
  },
  DE: {
    ticker: "^GDAXI",
    name: "DAX",
    topStocks: [
      { ticker: "SAP.DE", name: "SAP SE" },
      { ticker: "SIE.DE", name: "Siemens" },
      { ticker: "VOW3.DE", name: "Volkswagen" },
    ],
  },
  FR: {
    ticker: "^FCHI",
    name: "CAC 40",
    topStocks: [
      { ticker: "MC.PA", name: "LVMH" },
      { ticker: "OR.PA", name: "L'Oréal" },
      { ticker: "TTE.PA", name: "TotalEnergies" },
    ],
  },
  IT: {
    ticker: "FTSEMIB.MI",
    name: "FTSE MIB",
    topStocks: [
      { ticker: "ENI.MI", name: "Eni" },
      { ticker: "RACE.MI", name: "Ferrari" },
      { ticker: "ISP.MI", name: "Intesa Sanpaolo" },
    ],
  },

  // Asia-Pacific
  IN: {
    ticker: "^NSEI",
    name: "NIFTY 50",
    topStocks: [
      { ticker: "RELIANCE.NS", name: "Reliance Industries" },
      { ticker: "TCS.NS", name: "TCS" },
      { ticker: "HDFCBANK.NS", name: "HDFC Bank" },
    ],
  },
  CN: {
    ticker: "000001.SS",
    name: "SSE Composite",
    topStocks: [
      { ticker: "0700.HK", name: "Tencent" },
      { ticker: "9988.HK", name: "Alibaba" },
      { ticker: "3690.HK", name: "Meituan" },
    ],
  },
  JP: {
    ticker: "^N225",
    name: "Nikkei 225",
    topStocks: [
      { ticker: "7203.T", name: "Toyota" },
      { ticker: "6758.T", name: "Sony" },
      { ticker: "6861.T", name: "Keyence" },
    ],
  },
  KR: {
    ticker: "^KS11",
    name: "KOSPI",
    topStocks: [
      { ticker: "005930.KS", name: "Samsung Electronics" },
      { ticker: "000660.KS", name: "SK Hynix" },
    ],
  },
  AU: {
    ticker: "^AXJO",
    name: "S&P/ASX 200",
    topStocks: [
      { ticker: "BHP.AX", name: "BHP Group" },
      { ticker: "CBA.AX", name: "Commonwealth Bank" },
    ],
  },
  BR: {
    ticker: "^BVSP",
    name: "IBOVESPA",
    topStocks: [
      { ticker: "PETR4.SA", name: "Petrobras" },
      { ticker: "VALE3.SA", name: "Vale" },
    ],
  },
  ZA: {
    ticker: "^J203.JO",
    name: "FTSE/JSE All Share",
    topStocks: [
      { ticker: "NPN.JO", name: "Naspers" },
      { ticker: "FSR.JO", name: "FirstRand" },
    ],
  },
};
