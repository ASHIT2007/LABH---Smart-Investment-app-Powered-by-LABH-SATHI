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
  const syms = symbols.map((s) => encodeURIComponent(s.trim())).join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${syms}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const results = data.quoteResponse?.result || [];
    const out = {};
    for (const r of results) {
      out[r.symbol] = {
        price: r.regularMarketPrice,
        liveChangePercent: +(r.regularMarketChangePercent || 0).toFixed(2),
        currency: r.currency,
      };
    }
    return out;
  } catch {
    return {};
  }
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
