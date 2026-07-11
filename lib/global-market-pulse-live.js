import { GLOBAL_MARKET_TICKERS } from "../data/global-market-tickers.js";
import { fetchYahooQuotesBatch } from "./yahoo-live.js";

let cachedPulsePayload = null;
let lastPulseFetchTime = 0;
const PULSE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches live market data for all configured global countries.
 */
export async function getGlobalMarketPulsePayload() {
  if (cachedPulsePayload && (Date.now() - lastPulseFetchTime < PULSE_CACHE_TTL)) {
    return cachedPulsePayload;
  }

  const allTickers = [];

  // Collect all unique tickers to batch fetch
  for (const countryCode in GLOBAL_MARKET_TICKERS) {
    const country = GLOBAL_MARKET_TICKERS[countryCode];
    if (country.ticker) allTickers.push(country.ticker);
    if (country.topStocks) {
      country.topStocks.forEach((s) => allTickers.push(s.ticker));
    }
  }

  const uniqueTickers = [...new Set(allTickers)];
  const quotes = await fetchYahooQuotesBatch(uniqueTickers);

  const pulse = [];
  for (const countryCode in GLOBAL_MARKET_TICKERS) {
    const config = GLOBAL_MARKET_TICKERS[countryCode];
    const indexQuote = quotes[config.ticker];

    const topStocks = (config.topStocks || []).map((s) => {
      const q = quotes[s.ticker];
      return {
        ticker: s.ticker,
        name: s.name,
        price: q?.price ?? null,
        change: q?.liveChangePercent ?? null,
        currency: q?.currency ?? null,
      };
    });

    pulse.push({
      countryCode,
      name: config.name,
      indexTicker: config.ticker,
      price: indexQuote?.price ?? null,
      change: indexQuote?.liveChangePercent ?? null,
      currency: indexQuote?.currency ?? null,
      topStocks,
    });
  }

  cachedPulsePayload = {
    timestamp: new Date().toISOString(),
    pulse,
  };
  lastPulseFetchTime = Date.now();
  return cachedPulsePayload;
}
