/**
 * Live market data helpers (Yahoo Finance unofficial endpoints).
 * Used to enrich Threat Globe payloads — no API key required.
 */

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Latest regular-session price and day-over-previous-close % (matches dashboard logic).
 * @param {string} yahooSymbol — e.g. TSM, 2330.TW, ASML
 * @returns {Promise<{ price: number, liveChangePercent: number, currency?: string } | null>}
 */
export async function fetchYahooChartQuote(yahooSymbol) {
  if (!yahooSymbol || typeof yahooSymbol !== "string") return null;
  const sym = encodeURIComponent(yahooSymbol.trim());
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1m&range=1d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose || meta.chartPreviousClose || price;
    const liveChangePercent = +(
      ((price - prevClose) / prevClose) *
      100
    ).toFixed(2);
    return {
      price,
      liveChangePercent,
      currency: meta.currency,
    };
  } catch {
    return null;
  }
}

/**
 * Batch fetch multiple symbols (matches dashboard logic).
 * @param {string[]} symbols — e.g. ["AAPL", "MSFT"]
 * @returns {Promise<Record<string, { price: number, liveChangePercent: number, currency?: string }>>}
 */
export async function fetchYahooQuotesBatch(symbols) {
  if (!symbols?.length) return {};
  const out = {};
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const q = await fetchYahooChartQuote(sym);
        if (q) {
          out[sym] = q;
        }
      } catch (e) {
        // ignore individual failures
      }
    })
  );
  return out;
}

/**
 * Yahoo Finance RSS headlines for a symbol (real-time story feed).
 * @param {string} symbol
 * @param {number} limit
 * @returns {Promise<string[]>}
 */
export async function fetchYahooHeadlines(symbol, limit = 3) {
  if (!symbol || typeof symbol !== "string") return [];
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol.trim())}&region=US&lang=en-US`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": YAHOO_UA } });
    if (!res.ok) return [];
    const xml = await res.text();
    const out = [];
    const parts = xml.split("<item>");
    for (let i = 1; i < parts.length && out.length < limit; i++) {
      const block = parts[i];
      const m = block.match(/<title(?:[^>]+)?>([\s\S]*?)<\/title>/i);
      if (!m) continue;
      let title = m[1].trim();
      title = title
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/i, "$1")
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
      if (title && !/^yahoo finance$/i.test(title)) out.push(title);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Merge live quotes and headlines into a country-impact payload (clone-safe).
 * @param {object} payload — from getCountryImpactPayload
 */
function clonePayload(payload) {
  try {
    return structuredClone(payload);
  } catch {
    return JSON.parse(JSON.stringify(payload));
  }
}

export async function enrichCountryImpactWithLiveData(payload) {
  const clone = clonePayload(payload);
  const stocks = clone.affectedStocks || [];
  const primarySymbol = stocks[0]?.ticker || "";

  const [headlines, ...quoteResults] = await Promise.all([
    fetchYahooHeadlines(primarySymbol, 5),
    ...stocks.map((s) => fetchYahooChartQuote(s.ticker)),
  ]);

  clone.newsSources =
    headlines.length > 0
      ? headlines.slice(0, 3)
      : [...(clone.newsSources || [])];

  clone.affectedStocks = stocks.map((s, i) => {
    const q = quoteResults[i];
    const next = { ...s };
    delete next.price;
    delete next.conflictImpactPercentage;
    if (q) {
      next.price = q.price;
      next.liveChangePercent = q.liveChangePercent;
      if (q.currency) next.currency = q.currency;
    } else {
      next.price = null;
      next.liveChangePercent = null;
      next.quoteError = "live_quote_unavailable";
    }
    return next;
  });

  clone.liveQuotesAsOf = new Date().toISOString();
  clone.financialDataSource = "yahoo_finance";

  return clone;
}

/**
 * Fetch average % change of a basket of symbols over the 5 trading days following a past event date.
 * @param {string[]} symbols 
 * @param {string} eventDate - YYYY-MM-DD
 */
export async function fetchHistoricalAverageMove(symbols, eventDate) {
  if (!symbols?.length || !eventDate) return null;
  const eventTime = Math.floor(new Date(eventDate).getTime() / 1000);
  const startUnix = eventTime - 86400 * 5; // buffer before
  const endUnix = eventTime + 86400 * 15; // buffer after to get 5 trading days

  let totalPct = 0;
  let validStocks = 0;

  for (const sym of symbols) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&period1=${startUnix}&period2=${endUnix}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const result = data.chart?.result?.[0];
      if (!result) continue;
      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      
      // Find the first trading day on or after eventDate
      let startIndex = -1;
      for (let i = 0; i < timestamps.length; i++) {
        // give a 12 hour slack for timezone differences
        if (timestamps[i] >= eventTime - 43200) { 
          startIndex = i;
          break;
        }
      }
      
      if (startIndex !== -1 && startIndex + 5 < closes.length) {
        const startPrice = closes[startIndex];
        const endPrice = closes[startIndex + 5];
        if (startPrice && endPrice) {
          totalPct += ((endPrice - startPrice) / startPrice) * 100;
          validStocks++;
        }
      }
    } catch {
      continue;
    }
  }

  if (validStocks === 0) return null;
  return +(totalPct / validStocks).toFixed(2);
}
