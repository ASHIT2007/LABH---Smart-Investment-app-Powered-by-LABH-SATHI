/**
 * Mapping of Country ISO codes to representative stock market tickers and top stocks.
 * Used for the "Global Market Pulse" dots on the globe.
 */

export const GLOBAL_MARKET_TICKERS = {
  // North America
  US: {
    ticker: "SPY",
    name: "S&P 500 (USA)",
    topStocks: [
      { ticker: "AAPL", name: "Apple" },
      { ticker: "MSFT", name: "Microsoft" },
      { ticker: "NVDA", name: "NVIDIA" },
      { ticker: "AMZN", name: "Amazon" },
    ],
  },
  CA: {
    ticker: "EWC",
    name: "MSCI Canada",
    topStocks: [
      { ticker: "RY", name: "Royal Bank of Canada" },
      { ticker: "TD", name: "Toronto-Dominion Bank" },
      { ticker: "SHOP", name: "Shopify" },
    ],
  },
  MX: {
    ticker: "EWW",
    name: "MSCI Mexico",
    topStocks: [
      { ticker: "AMX", name: "América Móvil" },
      { ticker: "WALMEX.MX", name: "Walmart de México" },
      { ticker: "FEMSAUBD.MX", name: "Femsa" },
    ],
  },

  // Europe
  GB: {
    ticker: "EWU",
    name: "MSCI UK",
    topStocks: [
      { ticker: "SHEL.L", name: "Shell" },
      { ticker: "HSBA.L", name: "HSBC Holdings" },
      { ticker: "AZN.L", name: "AstraZeneca" },
    ],
  },
  DE: {
    ticker: "EWG",
    name: "MSCI Germany",
    topStocks: [
      { ticker: "SAP", name: "SAP SE" },
      { ticker: "SIE.DE", name: "Siemens" },
      { ticker: "VOW3.DE", name: "Volkswagen" },
    ],
  },
  FR: {
    ticker: "EWQ",
    name: "MSCI France",
    topStocks: [
      { ticker: "LVMUY", name: "LVMH" },
      { ticker: "OR.PA", name: "L'Oréal" },
      { ticker: "TTE", name: "TotalEnergies" },
    ],
  },
  IT: {
    ticker: "EWI",
    name: "MSCI Italy",
    topStocks: [
      { ticker: "ENI.MI", name: "Eni" },
      { ticker: "RACE", name: "Ferrari" },
      { ticker: "ISP.MI", name: "Intesa Sanpaolo" },
    ],
  },

  // Asia-Pacific
  IN: {
    ticker: "INDA",
    name: "MSCI India",
    topStocks: [
      { ticker: "RELIANCE.NS", name: "Reliance Industries" },
      { ticker: "TCS.NS", name: "TCS" },
      { ticker: "HDFCBANK.NS", name: "HDFC Bank" },
    ],
  },
  CN: {
    ticker: "FXI",
    name: "FTSE China 50",
    topStocks: [
      { ticker: "TCEHY", name: "Tencent" },
      { ticker: "BABA", name: "Alibaba" },
      { ticker: "美团-W", name: "Meituan" },
    ],
  },
  JP: {
    ticker: "EWJ",
    name: "MSCI Japan",
    topStocks: [
      { ticker: "TM", name: "Toyota" },
      { ticker: "SONY", name: "Sony" },
      { ticker: "6758.T", name: "Keyence" },
    ],
  },
  KR: {
    ticker: "EWY",
    name: "MSCI South Korea",
    topStocks: [
      { ticker: "005930.KS", name: "Samsung Electronics" },
      { ticker: "000660.KS", name: "SK Hynix" },
    ],
  },
  AU: {
    ticker: "EWA",
    name: "MSCI Australia",
    topStocks: [
      { ticker: "BHP", name: "BHP Group" },
      { ticker: "CBA.AX", name: "Commonwealth Bank" },
    ],
  },
  BR: {
    ticker: "EWZ",
    name: "MSCI Brazil",
    topStocks: [
      { ticker: "PBR", name: "Petrobras" },
      { ticker: "VALE", name: "Vale" },
    ],
  },
  ZA: {
    ticker: "EZA",
    name: "MSCI South Africa",
    topStocks: [
      { ticker: "NPN.JO", name: "Naspers" },
      { ticker: "FSR.JO", name: "FirstRand" },
    ],
  },
};
