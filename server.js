import "dotenv/config";
import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import OpenAI from "openai";
import { interlocks, STOCKS_DATA } from "./data/store.js";
import { getCountryImpactPayload } from "./data/country-impact.js";
import { enrichCountryImpactWithLiveData } from "./lib/yahoo-live.js";
import { generateRecommendations } from "./lib/ml-recommender.js";
import { detectCognitiveBias, detectRevengeTrade } from "./lib/user-analytics.js";
import { getGlobeThreatZonesPayload } from "./lib/globe-threat-zones-live.js";
import { getGlobalMarketPulsePayload } from "./lib/global-market-pulse-live.js";
import { computeIndicators, formatIndicatorsForPrompt, computePortfolioMetrics, formatPortfolioMetricsForPrompt, getSector } from "./lib/technical-indicators.js";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
export const supabase = SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const nvidiaAi = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY_1
});

const moonshotAi = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY_2
});

// --- TECHNICAL INDICATOR CACHE (5-minute TTL) ---
const indicatorCache = {};
const INDICATOR_CACHE_TTL = 300000; // 5 minutes

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
    

// Normalize initial hardcoded STOCKS_DATA to INR so early trades don't glitch
Object.values(STOCKS_DATA).forEach(stock => {
  if (stock.intl) {
    stock.price *= 83.5;
    if (stock.week52High) stock.week52High *= 83.5;
    if (stock.week52Low) stock.week52Low *= 83.5;
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
// Serve frontend static files from the 'frontend' directory
app.use(express.static(path.join(__dirname, "frontend")));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ai = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;


// Auth Routes
app.post("/api/auth/register", (req, res) => {
  res.status(400).json({ error: "Please use Supabase Auth on the frontend." });
});

app.post("/api/auth/login", (req, res) => {
  res.status(400).json({ error: "Please use Supabase Auth on the frontend." });
});

app.get("/api/auth/me", async (req, res) => {
  const { data: user } = await supabase.from("profiles").select("*").eq("email", req.query.email).single();
  user ? res.json({ user }) : res.status(404).json({ error: "Not found" });
});

app.put("/api/auth/profile", async (req, res) => {
  const { id, name, avatar, phone } = req.body;
  const { data: user } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (!user) return res.status(404).json({ error: "User not found" });

  const updates = {};
  if (name) updates.name = name;
  if (avatar !== undefined) updates.avatar = avatar;
  if (phone !== undefined) updates.phone = phone;

  const { data: updatedUser } = await supabase.from("profiles").update(updates).eq("id", id).select().single();
  res.json({ user: updatedUser });
});

// Markets Route
app.get("/api/markets", (req, res) => {
  res.json(Object.values(STOCKS_DATA));
});

// --- BACKGROUND POLLER FOR LIVE LOBBY DATA ---
async function fetchLivePrices() {
  const symbols = Object.keys(STOCKS_DATA);
  console.log(`[Poller] Fetching live prices for ${symbols.length} stocks...`);

  // Fetch quotes dynamically using v8 endpoint and Promise.allSettled
  const fetchPromises = symbols.map((symbol) => {
    const isIntl = STOCKS_DATA[symbol].intl === true;
    const yahooSymbol = isIntl ? symbol : `${symbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`;

    return fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const result = data.chart?.result?.[0];
        const meta = result?.meta;
        if (meta && meta.regularMarketPrice) {
          let price = meta.regularMarketPrice;
          let prevClose =
            meta.previousClose || meta.chartPreviousClose || price;

          if (isIntl) {
            price *= 83.5;
            prevClose *= 83.5;
          }

          const change = +(((price - prevClose) / prevClose) * 100).toFixed(2);

          // Mutate the imported object to act as an in-memory live cache
          STOCKS_DATA[symbol].price = price;
          STOCKS_DATA[symbol].change = change;

          // Extract additional live data from meta
          if (meta.fiftyTwoWeekHigh)
            STOCKS_DATA[symbol].week52High = +(meta.fiftyTwoWeekHigh * (isIntl ? 83.5 : 1)).toFixed(2);
          if (meta.fiftyTwoWeekLow)
            STOCKS_DATA[symbol].week52Low = +(meta.fiftyTwoWeekLow * (isIntl ? 83.5 : 1)).toFixed(2);
          if (meta.regularMarketVolume) {
            const vol = meta.regularMarketVolume;
            STOCKS_DATA[symbol].volume =
              vol >= 1e6
                ? (vol / 1e6).toFixed(1) + "M"
                : vol >= 1e3
                  ? (vol / 1e3).toFixed(0) + "K"
                  : vol.toString();
          }

          // Try to get volume from indicators if not in meta
          if (
            !meta.regularMarketVolume &&
            result.indicators?.quote?.[0]?.volume
          ) {
            const volumes = result.indicators.quote[0].volume.filter(
              (v) => v != null,
            );
            if (volumes.length > 0) {
              const totalVol = volumes.reduce((a, b) => a + b, 0);
              STOCKS_DATA[symbol].volume =
                totalVol >= 1e6
                  ? (totalVol / 1e6).toFixed(1) + "M"
                  : totalVol >= 1e3
                    ? (totalVol / 1e3).toFixed(0) + "K"
                    : totalVol.toString();
            }
          }
        }
      });
  });

  await Promise.allSettled(fetchPromises);
  pricesLoaded = true;

  // After updating prices, process any pending Stop-Loss or Limit orders
  processPendingOrders();
}

/**
 * Background Order Processor
 * Checks for triggered Stop-Loss (SL) and Limit orders across all users
 */
async function processPendingOrders() {
  let ordersProcessed = 0;
  const { data: users } = await supabase.from("profiles").select("*");
  if (!users) return;

  for (const user of users) {
    if (!user.pendingOrders || user.pendingOrders.length === 0) continue;

    const remainingOrders = [];
    for (const order of user.pendingOrders) {
      const stock = STOCKS_DATA[order.ticker];
      if (!stock || !stock.price) {
        remainingOrders.push(order);
        continue;
      }

      let triggered = false;
      const currentPrice = stock.price;

      if (order.orderType === "SL") {
        if (order.type === "SELL" && currentPrice <= order.triggerPrice) triggered = true;
        if (order.type === "BUY" && currentPrice >= order.triggerPrice) triggered = true;
      } else if (order.orderType === "LIMIT") {
        if (order.type === "SELL" && currentPrice >= order.triggerPrice) triggered = true;
        if (order.type === "BUY" && currentPrice <= order.triggerPrice) triggered = true;
      }

      if (triggered) {
        console.log(`[OrderEngine] Triggered ${order.orderType} ${order.type} for ${user.email}: ${order.ticker} @ ${currentPrice}`);
        await executeTrade(user, order, currentPrice);
        ordersProcessed++;
      } else {
        remainingOrders.push(order);
      }
    }
    
    // Update user's pending orders in Supabase if changed
    if (remainingOrders.length !== user.pendingOrders.length) {
      await supabase.from("profiles").update({ pendingOrders: remainingOrders }).eq("id", user.id);
    }
  }

  if (ordersProcessed > 0) {
    console.log(`[OrderEngine] Processed ${ordersProcessed} pending orders.`);
  }
}

/**
 * Helper to execute a trade from a triggered pending order
 */
function executeTrade(user, order, executionPrice) {
  const totalValue = executionPrice * order.qty;
  const executionDate = new Date().toISOString();

  if (order.type === "BUY") {
    if (user.balance < totalValue) return; // Silent fail for simplicity in bg
    user.balance -= totalValue;
    const existing = user.portfolio.find((p) => p.ticker === order.ticker);
    if (existing) {
      existing.avgPrice = (existing.qty * existing.avgPrice + totalValue) / (existing.qty + order.qty);
      existing.qty += order.qty;
    } else {
      user.portfolio.push({ ticker: order.ticker, qty: order.qty, avgPrice: executionPrice });
    }
  } else {
    const existing = user.portfolio.find((p) => p.ticker === order.ticker);
    if (!existing || existing.qty < order.qty) return;
    user.balance += totalValue;
    existing.qty -= order.qty;
    if (existing.qty === 0) {
      user.portfolio = user.portfolio.filter((p) => p.ticker !== order.ticker);
    }
  }

  user.trades = user.trades || [];
  user.trades.push({
    type: order.type,
    ticker: order.ticker,
    qty: order.qty,
    price: executionPrice,
    total: totalValue,
    date: executionDate,
    isTriggered: true,
    triggeredFrom: order.orderType
  });
}

// Fundamentals poller — fetches Market Cap & PE Ratio (runs less frequently)
async function fetchFundamentals() {
  const symbols = Object.keys(STOCKS_DATA);
  console.log(`[Poller] Fetching fundamentals for ${symbols.length} stocks...`);

  // Process in batches of 5 to avoid rate limiting
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5);
    const promises = batch.map((symbol) => {
      const isIntl = STOCKS_DATA[symbol].intl === true;
      const yahooSymbol = isIntl ? symbol : `${symbol}.NS`;
      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${yahooSymbol}?modules=price,defaultKeyStatistics,assetProfile`;

      return fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          const result = data.quoteSummary?.result?.[0];
          if (!result) return;

          const price = result.price;
          const stats = result.defaultKeyStatistics;
          const profile = result.assetProfile;

          if (price) {
            // Market Cap
            const mc = price.marketCap;
            if (mc && mc.raw) {
              let raw = mc.raw;
              if (STOCKS_DATA[symbol].intl) {
                raw *= 83.5;
              }
              // Always format as INR
              if (raw >= 1e12)
                STOCKS_DATA[symbol].mktCap =
                  "₹" + (raw / 1e12).toFixed(1) + "L Cr";
              else if (raw >= 1e7)
                STOCKS_DATA[symbol].mktCap =
                  "₹" + (raw / 1e7).toFixed(0) + " Cr";
              else
                STOCKS_DATA[symbol].mktCap =
                  "₹" + (raw / 1e5).toFixed(0) + " L";
            }
          }

          if (stats) {
            // P/E Ratio (trailing)
            const pe = stats.trailingPE || stats.forwardPE;
            if (pe && pe.raw) STOCKS_DATA[symbol].peRatio = +pe.raw.toFixed(1);
          }

          if (profile) {
            STOCKS_DATA[symbol].industry =
              profile.industry || profile.sector || "";
            if (profile.companyOfficers && profile.companyOfficers.length > 0) {
              // Often the CEO is the first officer or titled CEO
              const ceoObj =
                profile.companyOfficers.find(
                  (o) => o.title && o.title.toLowerCase().includes("ceo"),
                ) || profile.companyOfficers[0];
              STOCKS_DATA[symbol].ceo = ceoObj.name;
            }
            STOCKS_DATA[symbol].description = profile.longBusinessSummary || "";
          }
        })
        .catch(() => {
          /* silently skip failed symbols */
        });
    });

    await Promise.allSettled(promises);
    // Small delay between batches to be respectful
    if (i + 5 < symbols.length) await new Promise((r) => setTimeout(r, 500));
  }
  console.log("[Poller] Fundamentals update complete.");
}

// Bootstrapper: prices every 15s, fundamentals every 5 minutes
fetchLivePrices();
setInterval(fetchLivePrices, 15000);
setTimeout(() => fetchFundamentals(), 5000); // Start 5s after server boot
setInterval(fetchFundamentals, 300000); // Then every 5 minutes
// ----------------------------------------------

// --- COMMODITIES LIVE DATA ---
const COMMODITIES_DATA = {
  // Energy
  "CL=F": {
    sym: "CL=F",
    name: "Crude Oil",
    category: "Energy",
    unit: "USD/bbl",
    price: 0,
    prevClose: 0,
    change: 0,
  },
  "NG=F": {
    sym: "NG=F",
    name: "Natural Gas",
    category: "Energy",
    unit: "USD/MMBtu",
    price: 0,
    prevClose: 0,
    change: 0,
  },
  // Precious Metals
  "GC=F": {
    sym: "GC=F",
    name: "Gold (XAU)",
    category: "Precious Metals",
    unit: "USD/oz",
    price: 0,
    prevClose: 0,
    change: 0,
  },
  "SI=F": {
    sym: "SI=F",
    name: "Silver (XAG)",
    category: "Precious Metals",
    unit: "USD/oz",
    price: 0,
    prevClose: 0,
    change: 0,
  },
  "PL=F": {
    sym: "PL=F",
    name: "Platinum",
    category: "Precious Metals",
    unit: "USD/oz",
    price: 0,
    prevClose: 0,
    change: 0,
  },
  "PA=F": {
    sym: "PA=F",
    name: "Palladium",
    category: "Precious Metals",
    unit: "USD/oz",
    price: 0,
    prevClose: 0,
    change: 0,
  },
  // Base Metals
  "HG=F": {
    sym: "HG=F",
    name: "Copper",
    category: "Base Metals",
    unit: "USD/lb",
    price: 0,
    prevClose: 0,
    change: 0,
  },
  "ALI=F": {
    sym: "ALI=F",
    name: "Aluminium",
    category: "Base Metals",
    unit: "USD/t",
    price: 0,
    prevClose: 0,
    change: 0,
  },
  // Grains
  "ZW=F": {
    sym: "ZW=F",
    name: "Wheat",
    category: "Grains",
    unit: "USd/bu",
    price: 0,
    prevClose: 0,
    change: 0,
  },
  "ZC=F": {
    sym: "ZC=F",
    name: "Corn",
    category: "Grains",
    unit: "USd/bu",
    price: 0,
    prevClose: 0,
    change: 0,
  },
  "ZS=F": {
    sym: "ZS=F",
    name: "Soybeans",
    category: "Grains",
    unit: "USd/bu",
    price: 0,
    prevClose: 0,
    change: 0,
  },
  // Softs
  "KC=F": {
    sym: "KC=F",
    name: "Coffee",
    category: "Softs",
    unit: "USd/lb",
    price: 0,
    prevClose: 0,
    change: 0,
  },
  "SB=F": {
    sym: "SB=F",
    name: "Sugar",
    category: "Softs",
    unit: "USd/lb",
    price: 0,
    prevClose: 0,
    change: 0,
  },
  "CT=F": {
    sym: "CT=F",
    name: "Cotton",
    category: "Softs",
    unit: "USd/lb",
    price: 0,
    prevClose: 0,
    change: 0,
  },
};

async function fetchCommodityPrices() {
  const symbols = Object.keys(COMMODITIES_DATA);
  console.log(
    `[Poller] Fetching live prices for ${symbols.length} commodities...`,
  );

  const fetchPromises = symbols.map((symbol) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    return fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const meta = data.chart?.result?.[0]?.meta;
        if (meta && meta.regularMarketPrice) {
          const price = meta.regularMarketPrice;
          const prevClose =
            meta.previousClose || meta.chartPreviousClose || price;
          const change = +(((price - prevClose) / prevClose) * 100).toFixed(2);
          COMMODITIES_DATA[symbol].price = price;
          COMMODITIES_DATA[symbol].prevClose = prevClose;
          COMMODITIES_DATA[symbol].change = change;
        }
      });
  });
  await Promise.allSettled(fetchPromises);
}

fetchCommodityPrices();
setInterval(fetchCommodityPrices, 30000); // Every 30s for commodities

app.get("/api/commodities", (req, res) => {
  res.json(Object.values(COMMODITIES_DATA));
});
// --- END COMMODITIES ---

// --- MARKET BENCHMARKS LIVE DATA ---
const BENCHMARKS_DATA = {
  "^NSEI": { sym: "^NSEI", name: "NIFTY 50", price: 0, change: 0 },
  "^BSESN": { sym: "^BSESN", name: "SENSEX", price: 0, change: 0 },
  "^GSPC": { sym: "^GSPC", name: "S&P 500", price: 0, change: 0 },
};

async function fetchBenchmarkPrices() {
  const symbols = Object.keys(BENCHMARKS_DATA);
  console.log(`[Poller] Fetching live prices for ${symbols.length} benchmarks...`);

  const fetchPromises = symbols.map((symbol) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    return fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const meta = data.chart?.result?.[0]?.meta;
        if (meta && meta.regularMarketPrice) {
          const price = meta.regularMarketPrice;
          const prevClose =
            meta.previousClose || meta.chartPreviousClose || price;
          const change = +(((price - prevClose) / prevClose) * 100).toFixed(2);
          BENCHMARKS_DATA[symbol].price = price;
          BENCHMARKS_DATA[symbol].change = change;
        }
      });
  });
  await Promise.allSettled(fetchPromises);
}

fetchBenchmarkPrices();
setInterval(fetchBenchmarkPrices, 15000); // Every 15s for benchmarks

app.get("/api/benchmarks", (req, res) => {
  res.json(Object.values(BENCHMARKS_DATA));
});
// --- END MARKET BENCHMARKS ---

// --- STOCK NEWS ---
let newsCache = [];

async function fetchStockNews() {
  try {
    console.log("[Poller] Fetching global and Indian stock news...");
    const fetchOpts = {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    };
    
    const [resIn, resGlobal] = await Promise.all([
      fetch("https://news.google.com/rss/search?q=NSE+BSE+stock+market+India+shares&hl=en-IN&gl=IN&ceid=IN:en", fetchOpts),
      fetch("https://news.google.com/rss/search?q=global+stock+market+finance+wall+street&hl=en-US&gl=US&ceid=US:en", fetchOpts)
    ]);
    
    const [xmlIn, xmlGlobal] = await Promise.all([
      resIn.ok ? resIn.text() : "",
      resGlobal.ok ? resGlobal.text() : ""
    ]);

    const parseXML = (xml) => {
      const parsed = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && parsed.length < 8) {
        const block = match[1];
        const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
        const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
        const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "";
        const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || "";

        const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        const cleanLink = link.replace(/<!\[CDATA\[|\]\]>/g, "").trim();

        let matchedStock = null;
        const titleLower = cleanTitle.toLowerCase();
        for (const sym of Object.keys(STOCKS_DATA)) {
          const stock = STOCKS_DATA[sym];
          const nameWords = stock.name.toLowerCase().split(/\s+/);
          const keyword = nameWords.find((w) => w.length > 3) || nameWords[0];
          if (titleLower.includes(keyword) || titleLower.includes(sym.toLowerCase())) {
            matchedStock = {
              sym: stock.sym,
              name: stock.name,
              logo: stock.logo,
              price: stock.price,
              change: stock.change,
            };
            break;
          }
        }

        parsed.push({
          title: cleanTitle,
          link: cleanLink,
          pubDate,
          source,
          stock: matchedStock,
        });
      }
      return parsed;
    };

    const itemsIn = parseXML(xmlIn);
    const itemsGlobal = parseXML(xmlGlobal);
    
    const items = [];
    const maxLength = Math.max(itemsIn.length, itemsGlobal.length);
    for (let i = 0; i < maxLength; i++) {
      if (itemsIn[i]) items.push(itemsIn[i]);
      if (itemsGlobal[i]) items.push(itemsGlobal[i]);
      if (items.length >= 12) break;
    }

    newsCache = items;
  } catch (e) {
    console.error("[News] Fetch error:", e.message);
  }
}
fetchStockNews();
setInterval(fetchStockNews, 120000); // Every 2 minutes

app.get("/api/news", (req, res) => {
  res.json(newsCache);
});
// --- END STOCK NEWS ---

// --- COMPANY INFO ENGINE (Groq) ---
const companyInfoCache = {};

app.get("/api/company-info/:symbol", async (req, res) => {
  const { symbol } = req.params;

  if (companyInfoCache[symbol]) {
    return res.json(companyInfoCache[symbol]);
  }

  const stock = STOCKS_DATA[symbol];
  const name = stock ? stock.name : symbol;

  if (!ai) {
    return res.json({
      ceo: stock?.ceo || "N/A",
      industry: stock?.industry || "Unknown",
      founded: "N/A",
      description:
        stock?.description || `${name} (${symbol}) is a major entity.`,
    });
  }

  try {
    const response = await ai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content:
            "Act as a financial data provider. Return ONLY valid JSON containing company info. No markdown, no explanation.",
        },
        {
          role: "user",
          content: `Provide company details for the stock symbol: ${symbol} (${name}). Return pure JSON: {"ceo": "Name of CEO or Top Executive", "industry": "Sector/Industry", "founded": "Year", "description": "1-2 sentences concise company description."}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.1,
    });

    let content = response.choices[0].message.content.trim();
    if (content.startsWith("```json"))
      content = content.replace(/```json/g, "").replace(/```/g, "");
    else if (content.startsWith("```")) content = content.replace(/```/g, "");

    const aiResult = JSON.parse(content);
    companyInfoCache[symbol] = aiResult;

    res.json(aiResult);
  } catch (e) {
    console.error("[Company Info] AI error:", e.message);
    res.status(500).json({ error: "Failed to fetch company info" });
  }
});
// --- END COMPANY INFO ENGINE ---

// --- SENTIMENT ENGINE ---
let sentimentCache = null;
let sentimentCacheTime = 0;
const SENTIMENT_CACHE_TTL = 180000; // 3 minutes

app.get("/api/sentiment", async (req, res) => {
  // Return cached if fresh
  if (sentimentCache && Date.now() - sentimentCacheTime < SENTIMENT_CACHE_TTL) {
    return res.json(sentimentCache);
  }

  // Need news headlines to analyze
  if (!newsCache || newsCache.length === 0) {
    return res.json({
      headlines: [],
      overallMood: "neutral",
      moodScore: 50,
      analyzedAt: new Date().toISOString(),
    });
  }

  // If no AI key, return rule-based fallback
  if (!ai) {
    const fallback = newsCache.slice(0, 10).map((item) => {
      const title = item.title.toLowerCase();
      let sentiment = "neutral",
        confidence = 0.5;
      const bullWords = [
        "surge",
        "rally",
        "gain",
        "rise",
        "jump",
        "soar",
        "boom",
        "high",
        "profit",
        "record",
        "up",
        "bull",
      ];
      const bearWords = [
        "fall",
        "drop",
        "crash",
        "sink",
        "loss",
        "decline",
        "down",
        "bear",
        "plunge",
        "slump",
        "low",
        "fear",
      ];
      const bullHits = bullWords.filter((w) => title.includes(w)).length;
      const bearHits = bearWords.filter((w) => title.includes(w)).length;
      if (bullHits > bearHits) {
        sentiment = "bullish";
        confidence = Math.min(0.6 + bullHits * 0.1, 0.95);
      } else if (bearHits > bullHits) {
        sentiment = "bearish";
        confidence = Math.min(0.6 + bearHits * 0.1, 0.95);
      } else {
        confidence = 0.4;
      }
      return {
        title: item.title,
        source: item.source || "Unknown",
        pubDate: item.pubDate,
        link: item.link,
        stock: item.stock,
        sentiment,
        confidence: +confidence.toFixed(2),
        reasoning: "Rule-based analysis (add GROQ_API_KEY for AI analysis)",
        keywords: [],
      };
    });
    const bullCount = fallback.filter((h) => h.sentiment === "bullish").length;
    const bearCount = fallback.filter((h) => h.sentiment === "bearish").length;
    const moodScore = Math.round(
      50 + ((bullCount - bearCount) / fallback.length) * 50,
    );
    const overallMood =
      moodScore >= 60 ? "bullish" : moodScore <= 40 ? "bearish" : "neutral";
    sentimentCache = {
      headlines: fallback,
      overallMood,
      moodScore,
      analyzedAt: new Date().toISOString(),
      aiPowered: false,
    };
    sentimentCacheTime = Date.now();
    return res.json(sentimentCache);
  }

  // AI-powered analysis
  try {
    const headlinesToAnalyze = newsCache
      .slice(0, 10)
      .map(
        (n, i) => `${i + 1}. "${n.title}" (Source: ${n.source || "Unknown"})`,
      )
      .join("\n");

    const response = await ai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You are a global financial sentiment analysis engine for both the Indian Stock Market and Global Markets. Analyze each headline and return ONLY valid JSON. No markdown, no explanation.`,
        },
        {
          role: "user",
          content: `Analyze these global and Indian stock market headlines for sentiment. Return pure JSON (no markdown backticks):
{
  "headlines": [
    {
      "index": 1,
      "sentiment": "bullish" | "bearish" | "neutral",
      "confidence": 0.0-1.0,
      "reasoning": "short 10 word max reason",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "overallMood": "bullish" | "bearish" | "neutral",
  "moodScore": 0-100 (0=extreme bearish, 50=neutral, 100=extreme bullish),
  "marketSummary": "2 sentence market summary"
}

Headlines:
${headlinesToAnalyze}`,
        },
      ],
      max_tokens: 1200,
      temperature: 0.2,
    });

    let content = response.choices[0].message.content.trim();
    // Clean any markdown wrapping
    if (content.startsWith("```json"))
      content = content.replace(/```json/g, "").replace(/```/g, "");
    else if (content.startsWith("```")) content = content.replace(/```/g, "");

    const aiResult = JSON.parse(content);

    // Merge AI results with our news data
    const merged = newsCache.slice(0, 10).map((item, i) => {
      const aiItem = aiResult.headlines.find((h) => h.index === i + 1) || {};
      return {
        title: item.title,
        source: item.source || "Unknown",
        pubDate: item.pubDate,
        link: item.link,
        stock: item.stock,
        sentiment: aiItem.sentiment || "neutral",
        confidence: aiItem.confidence || 0.5,
        reasoning: aiItem.reasoning || "No analysis available",
        keywords: aiItem.keywords || [],
      };
    });

    sentimentCache = {
      headlines: merged,
      overallMood: aiResult.overallMood || "neutral",
      moodScore: aiResult.moodScore || 50,
      marketSummary: aiResult.marketSummary || "",
      analyzedAt: new Date().toISOString(),
      aiPowered: true,
    };
    sentimentCacheTime = Date.now();
    res.json(sentimentCache);
  } catch (e) {
    console.error("[Sentiment] AI analysis error:", e.message);
    const fallback = newsCache.slice(0, 10).map((item) => ({
      title: item.title,
      source: item.source || "Unknown",
      pubDate: item.pubDate,
      link: item.link,
      stock: item.stock,
      sentiment: "neutral",
      confidence: 0.5,
      reasoning: "AI sentiment temporarily unavailable",
      keywords: [],
    }));
    sentimentCache = {
      headlines: fallback,
      overallMood: "neutral",
      moodScore: 50,
      marketSummary:
        "AI sentiment is temporarily unavailable, so the dashboard is showing a neutral fallback.",
      analyzedAt: new Date().toISOString(),
      aiPowered: false,
    };
    sentimentCacheTime = Date.now();
    res.json(sentimentCache);
  }
});
// --- END SENTIMENT ENGINE ---

// Chart Route — fetches OHLCV data from Yahoo Finance
app.get("/api/chart/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const range = req.query.range || "3mo";
    const interval = req.query.interval || "1d";
    const stockData = STOCKS_DATA[symbol];
    const isIntl = stockData && stockData.intl === true;
    const yahooSymbol = isIntl ? symbol : `${symbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${range}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });

    if (!response.ok)
      throw new Error(`Yahoo Finance API returned ${response.status}`);
    const data = await response.json();

    const result = data.chart?.result?.[0];
    if (!result) throw new Error("No result from Yahoo API");

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};

    const chartData = [];
    timestamps.forEach((ts, i) => {
      if (quotes.open?.[i] != null && quotes.close?.[i] != null) {
        let timeVal;
        // If it's an intraday interval (minutes or hours), convert from UTC to IST (+5.5 hours)
        if (interval.includes("m") || interval.includes("h")) {
          timeVal = ts + 19800;
        } else {
          // Otherwise use YYYY-MM-DD string
          const date = new Date(ts * 1000);
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, "0");
          const d = String(date.getDate()).padStart(2, "0");
          timeVal = `${y}-${m}-${d}`;
        }

        chartData.push({
          time: timeVal,
          open: +quotes.open[i].toFixed(2),
          high: +(quotes.high?.[i] ?? quotes.open[i]).toFixed(2),
          low: +(quotes.low?.[i] ?? quotes.close[i]).toFixed(2),
          close: +quotes.close[i].toFixed(2),
          volume: quotes.volume?.[i] || 0,
        });
      }
    });
    chartData.sort((a, b) =>
      typeof a.time === "number"
        ? a.time - b.time
        : a.time.localeCompare(b.time),
    );

    // Also pull latest meta for live price
    const meta = result.meta || {};
    res.json({
      candles: chartData,
      meta: {
        regularMarketPrice: meta.regularMarketPrice,
        previousClose: meta.previousClose || meta.chartPreviousClose,
        currency: meta.currency,
        symbol: meta.symbol,
      },
    });
  } catch (error) {
    console.error(
      "Chart fetch error for",
      req.params.symbol,
      ":",
      error.message,
    );
    // Return mock data so the frontend always gets a chart
    const stock = STOCKS_DATA[req.params.symbol];
    const basePrice = stock?.price || 1000;
    const mockCandles = [];
    let curPrice = basePrice * 0.92;
    const today = new Date();
    for (let i = 90; i >= 0; i--) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - i);
      if (dt.getDay() === 0 || dt.getDay() === 6) continue; // skip weekends
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      const open = curPrice;
      const close =
        i === 0 ? basePrice : curPrice * (1 + (Math.random() * 0.04 - 0.02));
      const high = Math.max(open, close) * (1 + Math.random() * 0.012);
      const low = Math.min(open, close) * (1 - Math.random() * 0.012);
      mockCandles.push({
        time: `${y}-${m}-${d}`,
        open: +open.toFixed(2),
        high: +high.toFixed(2),
        low: +low.toFixed(2),
        close: +close.toFixed(2),
        volume: Math.round(Math.random() * 5000000 + 500000),
      });
      curPrice = close;
    }
    res.json({
      candles: mockCandles,
      meta: { regularMarketPrice: basePrice, mock: true },
    });
  }
});

// Live Quote Route — fetches real-time price for a single stock
app.get("/api/quote/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const yahooSymbol = `${symbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });

    if (!response.ok) throw new Error(`Yahoo returned ${response.status}`);
    const data = await response.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) throw new Error("No meta");

    res.json({
      price: meta.regularMarketPrice,
      previousClose: meta.previousClose || meta.chartPreviousClose,
      change:
        meta.regularMarketPrice && meta.previousClose
          ? +(
              ((meta.regularMarketPrice - meta.previousClose) /
                meta.previousClose) *
              100
            ).toFixed(2)
          : 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Quote unavailable" });
  }
});

let pricesLoaded = false;

// Trading Engine
app.post("/api/trade", async (req, res) => {
  if (!pricesLoaded) return res.status(503).json({ error: "Market data is still loading. Please try again in a few seconds." });

  const { userId, type, ticker, quantity } = req.body;
  const { data: user } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (!user) return res.status(404).json({ error: "User not found" });

  const stock = STOCKS_DATA[ticker];
  if (!stock) return res.status(400).json({ error: "Invalid stock" });

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0)
    return res.status(400).json({ error: "Invalid quantity" });

  const orderType = req.body.orderType || "MARKET";
  const triggerPrice = parseFloat(req.body.triggerPrice);

  if (orderType === "SL" || orderType === "LIMIT") {
    if (isNaN(triggerPrice)) return res.status(400).json({ error: "Invalid trigger price" });
    
    user.pendingOrders = user.pendingOrders || [];
    user.pendingOrders.push({
      id: Date.now().toString(),
      type,
      ticker,
      qty,
      orderType,
      triggerPrice,
      date: new Date().toISOString()
    });
    
    await supabase.from("profiles").update({
      balance: user.balance,
      portfolio: user.portfolio,
      trades: user.trades,
      pendingOrders: user.pendingOrders || []
    }).eq("id", user.id);
    return res.json({ message: `${orderType} order placed successfully`, user });
  }

  const totalCost = stock.price * qty;

  user.trades = user.trades || [];
  const executionDate = new Date().toISOString();

  if (type === "BUY") {
    if (user.balance < totalCost)
      return res.status(400).json({ error: "Insufficient funds" });

    // --- BEHAVIORAL ML: REVENGE TRADING DETECTION ---
    let aiCoachMessage = null;
    let biasType = null;
    const revengeBias = detectRevengeTrade(user.trades, stock);
    
    if (revengeBias && ai) {
      biasType = "REVENGE_TRADE";
      try {
        const response = await ai.chat.completions.create({
          model: "llama-3.1-8b-instant",
          messages: [{
            role: "system",
            content: "You are Labh Sathi, an expert AI trading coach. The user is exhibiting a revenge trading pattern — they have had multiple consecutive losing trades and are immediately trying to buy again. Give a 1-2 sentence supportive but firm warning about revenge trading and emotional decision-making. Be direct, cite the stats provided, and suggest waiting."
          }, {
            role: "user",
            content: `I've had ${revengeBias.consecutiveLosses} consecutive losing trades (avg loss ${revengeBias.avgLossPct}%) and I'm trying to buy ${ticker} just ${revengeBias.timeSinceLastLoss} hours after my last loss.`
          }],
          max_tokens: 150,
          temperature: 0.3
        });
        aiCoachMessage = response.choices[0].message.content.trim();
      } catch (e) {
        console.error("[AI Coach] Revenge trade warning failed", e.message);
      }
    }
    // -----------------------------------------------

    user.balance -= totalCost;
    const existing = user.portfolio.find((p) => p.ticker === ticker);
    if (existing) {
      existing.avgPrice =
        (existing.qty * existing.avgPrice + totalCost) / (existing.qty + qty);
      existing.qty += qty;
    } else {
      user.portfolio.push({ ticker, qty: qty, avgPrice: stock.price });
    }
    user.trades.push({
      type,
      ticker,
      qty,
      price: stock.price,
      total: totalCost,
      date: executionDate,
    });
    await supabase.from("profiles").update({
      balance: user.balance,
      portfolio: user.portfolio,
      trades: user.trades,
      pendingOrders: user.pendingOrders || []
    }).eq("id", user.id);
    res.json({ message: "Buy successful", user, aiCoachMessage, biasType });
  } else if (type === "SELL") {
    const existing = user.portfolio.find((p) => p.ticker === ticker);
    if (!existing || existing.qty < qty)
      return res.status(400).json({ error: "Insufficient shares" });

    user.balance += totalCost;
    existing.qty -= qty;
    if (existing.qty === 0) {
      user.portfolio = user.portfolio.filter((p) => p.ticker !== ticker);
    }
    user.trades.push({
      type,
      ticker,
      qty,
      price: stock.price,
      total: totalCost,
      date: executionDate,
    });
    
    // --- BEHAVIORAL ML: COGNITIVE BIAS DETECTION ---
    let aiCoachMessage = null;
    const bias = detectCognitiveBias(user.trades, ticker, stock.price);
    
    if (bias && ai) {
      try {
        const response = await ai.chat.completions.create({
          model: "llama-3.1-8b-instant",
          messages: [{
            role: "system",
            content: "You are Labh Sathi, an expert AI trading coach. The user just panic-sold a stock at a loss after holding for less than 48 hours. Give a 1-sentence supportive but data-driven critique about the dangers of panic selling and loss aversion. Be direct, professional, and brief."
          }, {
            role: "user",
            content: `I just sold ${ticker} at a ${bias.dropPct}% loss after holding for only ${bias.holdTimeHours} hours.`
          }],
          max_tokens: 150,
          temperature: 0.3
        });
        aiCoachMessage = response.choices[0].message.content.trim();
      } catch (e) {
        console.error("[AI Coach] Failed to generate message", e.message);
      }
    }
    // -----------------------------------------------

    await supabase.from("profiles").update({
      balance: user.balance,
      portfolio: user.portfolio,
      trades: user.trades,
      pendingOrders: user.pendingOrders || []
    }).eq("id", user.id);
    res.json({ message: "Sell successful", user, aiCoachMessage });
  } else {
    res.status(400).json({ error: "Invalid trade type" });
  }
});

// --- AI FUNDAMENTAL COMPARISON ENDPOINT ---
app.post("/api/ai/compare", async (req, res) => {
  const { s1, s2 } = req.body;
  if (!s1 || !s2) return res.status(400).json({ error: "Missing stock symbols" });

  const stock1 = STOCKS_DATA[s1];
  const stock2 = STOCKS_DATA[s2];
  
  if (!stock1 || !stock2) return res.status(404).json({ error: "Stocks not found" });

  try {
    const prompt = `You are a Senior Quantitative Equity Analyst and ML Research Lead. 
Perform a deep-dive fundamental and machine learning comparison between:
STOCK 1: ${JSON.stringify(stock1)}
STOCK 2: ${JSON.stringify(stock2)}

LATEST NEWS & CONTEXT: ${Object.keys(STOCKS_DATA).slice(0, 10).join(", ")} market status.

Provide a definitive investment verdict.
CRITICAL: You MUST respond with ONLY a valid JSON object.
CRITICAL STRING REQUIREMENT: The fields "summary", "stock1Analysis", "stock2Analysis", and "mlInsights" MUST be flat Markdown strings. DO NOT put nested JSON objects inside them.
Format:
{
  "summary": "A 2-sentence executive summary of the comparison.",
  "stock1Analysis": "Key strengths/weaknesses for S1 in a Markdown string.",
  "stock2Analysis": "Key strengths/weaknesses for S2 in a Markdown string.",
  "mlInsights": "Describe technical patterns or valuation anomalies detected in a Markdown string.",
  "verdict": "WINNER_S1" | "WINNER_S2" | "NEUTRAL",
  "reasoning": "Clear explanation of why one is better than the other.",
  "riskLevel": "Low" | "Medium" | "High",
  "winnerSymbol": "SYMBOL"
}`;

    const response = await ai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "system", content: "Respond ONLY with valid JSON. Do not nest objects in text fields." }, { role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    // Safety check: force object-to-string conversion if the LLM hallucinates nested objects
    ["summary", "stock1Analysis", "stock2Analysis", "mlInsights"].forEach(key => {
      if (typeof result[key] === 'object' && result[key] !== null) {
        result[key] = JSON.stringify(result[key], null, 2);
      }
    });

    res.json(result);
  } catch (e) {
    console.error("[AI Compare Error]:", e);
    res.status(500).json({ error: "Comparison failed: " + e.message });
  }
});

// AI Chatbot with Multimodal & Tool Support
app.post("/api/ai/chat", async (req, res) => {
  const reqStartTime = Date.now();
  let usedSources = [];
  try {
    if (!ai)
      return res.json({
        reply:
          "I am Labh Sathi! Please add GROQ_API_KEY to enable my multimodal brain. I can then analyze your photos, charts, and files!",
      });

    const { prompt, attachments, userId, modelId, portfolio, trades } = req.body;
    const promptLower = (prompt || "").toLowerCase();
    
    const isVision = attachments && attachments.some((a) => a.type.startsWith("image/"));
    let actualModelId = modelId;
    if (!actualModelId || actualModelId === "auto") {
      actualModelId = isVision ? "llama-3.2-11b-vision-preview" : "llama-3.1-8b-instant";
    }

    // --- DETECT JOURNAL REQUEST ---
    const isJournalRequest = /journal|grade my trades|session summary|trade summary|review my trades|analyze my trades/i.test(prompt);
    if (isJournalRequest) {
      const { data: user } = userId ? await supabase.from("profiles").select("*").eq("id", userId).single() : { data: null };
      const userTrades = trades || (user ? user.trades : []);
      if (!userTrades || userTrades.length === 0) {
        return res.json({ reply: "You haven't made any trades yet! Start trading and I'll be able to generate your personalized trade journal.", isJournal: true });
      }
      
      const todayTrades = userTrades.slice(-10); // Last 10 trades
      const tradesSummary = todayTrades.map((t, i) => 
        `${i+1}. ${t.type} ${t.qty}x ${t.ticker} @ ₹${t.price.toFixed(2)} (${new Date(t.date).toLocaleTimeString("en-IN")})`
      ).join("\n");
      
      const newsContext = newsCache.slice(0, 5).map(n => `- ${n.title}`).join("\n");
      
      try {
        const journalResponse = await ai.chat.completions.create({
          model: actualModelId,
          messages: [{
            role: "system",
            content: `You are Labh Sathi, an expert AI trading coach. Generate a professional trade journal entry. Return ONLY valid JSON, no markdown:\n{"summary":"Overall 2-3 sentence assessment","grade":"A/B/C/D","entries":[{"ticker":"SYM","type":"BUY/SELL","analysis":"1 sentence on whether this was a good decision given market context"}],"suggestions":"1-2 sentence forward-looking advice"}`
          }, {
            role: "user",
            content: `Grade these recent trades:\n${tradesSummary}\n\nMarket news today:\n${newsContext}`
          }],
          max_tokens: 800,
          temperature: 0.3
        });
        
        let jContent = journalResponse.choices[0].message.content.trim();
        if (jContent.startsWith("```json")) jContent = jContent.replace(/```json/g, "").replace(/```/g, "");
        else if (jContent.startsWith("```")) jContent = jContent.replace(/```/g, "");
        
        try {
          const journal = JSON.parse(jContent);
          return res.json({ reply: "Here's your AI Trade Journal:", journal, isJournal: true });
        } catch {
          return res.json({ reply: jContent, isJournal: true });
        }
      } catch (e) {
        console.error("[Journal] AI error:", e.message);
        return res.json({ reply: "I couldn't generate your journal right now. Please try again in a moment." });
      }
    }

    // --- BUILD CONTEXT ---
    const marketContext = Object.values(STOCKS_DATA)
      .map(
        (s) =>
          `${s.sym}: ₹${Number(s.price || 0).toFixed(2)} (${s.change >= 0 ? "+" : ""}${Number(s.change || 0).toFixed(2)}%)`,
      )
      .join(", ");
    let newsContext = newsCache
      .slice(0, 50)
      .map((n) => `- ${n.title}`)
      .join("\n");

    // --- CLASSIFY QUERY FOR FORMATTING ---
    let queryCategory = "greeting"; // Default fallback
    try {
      const classResponse = await ai.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{
          role: "system",
          content: `Classify the user's trading query into exactly one of these categories:
1. greeting (small talk, "hi", "thanks")
2. single_stock (analyzing or asking about ONE specific ticker)
3. portfolio (asking about their own portfolio performance/holdings)
4. comparison (comparing 2+ tickers or sectors)
5. market (broad market outlook, top movers, news)
6. decision (direct "should I buy/sell X" questions)
7. educational (defining terms like RSI, VWAP - ONLY for finance/trading terms)
8. screener (filtering/searching for stocks based on criteria like "cheapest", "tech stocks under 50", etc)
9. irrelevant (non-financial questions, coding, math, general knowledge completely unrelated to finance or the app)

CRITICAL RULE: If the user asks for code (e.g., C++, Python, HTML), math, or general knowledge, you MUST classify it as 'irrelevant'.
If the user's query requires fetching live web context, recent news not in your knowledge, or detailed real-world facts, set 'search_query' to a concise Google-style search string.
CRITICAL: For questions about "latest news", "trending stocks", or "market outlook", you MUST set a 'search_query' focused on Yahoo Finance and Google News (e.g., "latest stock market news site:finance.yahoo.com OR site:news.google.com").
Otherwise, set 'search_query' to null.
Return ONLY a valid JSON object: {"category": "category_name", "search_query": "search string or null"}`
        }, { role: "user", content: promptLower }],
        temperature: 0.1,
        max_tokens: 150,
        response_format: { type: "json_object" }
      });
      const classParams = JSON.parse(classResponse.choices[0].message.content);
      if (classParams && classParams.category) {
        queryCategory = classParams.category;
      }

      // --- TAVILY WEB SEARCH ---
      if (classParams && classParams.search_query && process.env.TAVILY_API_KEY) {
        try {
          console.log(`[Tavily] Executing web search: "${classParams.search_query}"`);
          const tvlyRes = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: process.env.TAVILY_API_KEY,
              query: classParams.search_query,
              search_depth: "basic",
              include_images: false,
              max_results: 3
            })
          });
          const tvlyData = await tvlyRes.json();
          if (tvlyData && tvlyData.results) {
            try {
              usedSources = tvlyData.results.map(r => ({
                title: r.title,
                url: r.url,
                domain: new URL(r.url).hostname.replace('www.', '')
              }));
            } catch(e) {}
            const searchContext = tvlyData.results.map(r => `[${r.title}](${r.url}): ${r.content.substring(0, 500)}...`).join("\n\n");
            newsContext += `\n\n=== LIVE WEB SEARCH RESULTS ===\n${searchContext}\n===============================\n`;
          }
        } catch(searchErr) {
          console.warn("[Tavily] Search failed:", searchErr.message);
        }
      }

    } catch (e) {
      console.warn("[Classifier] Error:", e.message);
    }

    // --- DETECT REQUEST TYPE ---
    const isChartRequest = /compare|chart|graph|plot|visualize|moving average|sma|ema|macd|rsi|vwap|trend|performance/i.test(prompt);
    const isWhatIfRequest = /what.?if|what happens|scenario|simulate|impact.*portfolio|stress test/i.test(prompt);

    let screenerMatchedTickers = [];
    let screenerThresholdMsg = "";
    if (queryCategory === "screener") {
      try {
        const filterResponse = await ai.chat.completions.create({
          model: actualModelId,
          messages: [{
            role: "system",
            content: `You are a financial filter bot. Extract filtering parameters from the user's prompt. 
If the user asks for "cheap", "undervalued", or "bargain" stocks, DO NOT filter by maxPrice. Instead, set "valuation": "cheap" to trigger P/E ratio sorting, and set thresholdMsg to "I've sorted these by lowest P/E ratio (valuation) rather than nominal share price to find genuinely 'cheap' stocks."
Return ONLY valid JSON: {"sector": "Technology" (optional), "maxPrice": number (optional), "minPrice": number (optional), "minVolume": number (optional), "valuation": "cheap"|"expensive" (optional), "thresholdMsg": string (optional)}`
          }, { role: "user", content: prompt }],
          temperature: 0.1,
          response_format: { type: "json_object" }
        });
        const filterParams = JSON.parse(filterResponse.choices[0].message.content);
        if (filterParams.thresholdMsg) screenerThresholdMsg = filterParams.thresholdMsg;
        
        for (const sym of Object.keys(STOCKS_DATA)) {
          const s = STOCKS_DATA[sym];
          let match = true;
          if (filterParams.sector && (!s.industry || !s.industry.toLowerCase().includes(filterParams.sector.toLowerCase()))) match = false;
          if (filterParams.maxPrice && s.price > filterParams.maxPrice) match = false;
          if (filterParams.minPrice && s.price < filterParams.minPrice) match = false;
          if (filterParams.minVolume && s.volume < filterParams.minVolume) match = false;
          if (match) screenerMatchedTickers.push(sym);
        }
        
        if (filterParams.valuation === "cheap") {
          screenerMatchedTickers.sort((a, b) => {
            const peA = STOCKS_DATA[a].peRatio || 9999;
            const peB = STOCKS_DATA[b].peRatio || 9999;
            const valA = peA < 0 ? 9999 : peA;
            const valB = peB < 0 ? 9999 : peB;
            return valA - valB;
          });
        }
        
        screenerMatchedTickers = screenerMatchedTickers.slice(0, 5);
      } catch (e) {
        console.warn("[Screener] Filter error:", e.message);
      }
    }

    // Build portfolio context for what-if scenarios
    let portfolioContext = "";
    const { data: user } = userId ? await supabase.from("profiles").select("*").eq("id", userId).single() : { data: null };
    const userPortfolio = portfolio || (user ? user.portfolio : []);
    if (userPortfolio && userPortfolio.length > 0) {
      portfolioContext = "\nUSER PORTFOLIO: " + userPortfolio.map(p => {
        const s = STOCKS_DATA[p.ticker];
        const sector = s && s.industry ? s.industry : getSector(p.ticker);
        return `${p.ticker} (${sector}): ${p.qty} shares @ avg ₹${p.avgPrice.toFixed(2)}, current ₹${Number(s?.price || 0).toFixed(2)}`;
      }).join(", ");

      // Compute portfolio-level aggregate metrics
      try {
        const portfolioMetrics = computePortfolioMetrics(userPortfolio, STOCKS_DATA);
        portfolioContext += "\n" + formatPortfolioMetricsForPrompt(portfolioMetrics);
      } catch (e) {
        console.warn("[AI Context] Portfolio metrics computation failed:", e.message);
      }
    } else {
      portfolioContext = "\nUSER PORTFOLIO: No active holdings. The user currently has 0 stocks in their portfolio.";
    }

    // --- ENHANCED SYSTEM PROMPT PER CATEGORY ---
    let categorySchema = "";
    if (queryCategory === "greeting") {
      categorySchema = `{"greeting": "One short sentence greeting, max 15 words", "next_actions": "One optional sentence offering 2-3 named next actions, not a data dump", "heatmapData": [], "dumbbellData": [], "pieChartData": []}`;
    } else if (queryCategory === "single_stock") {
      categorySchema = `{"verdict": "ticker, current price, one-word/short-phrase sentiment", "explanation": "A good, brief explanation (3-4 sentences) analyzing the stock's performance, key drivers, and future outlook", "indicators": [{"name": "Indicator Name", "value": "Value", "reading": "Reading"}], "conflict_note": "Optional 1 sentence noting any conflict between short/long term signals", "heatmapData": [], "dumbbellData": [], "pieChartData": []}`;
    } else if (queryCategory === "portfolio") {
      categorySchema = `{"total_value": "Total value in ₹", "total_pnl": "Total P&L in ₹ and %", "holdings": [{"ticker": "SYM", "qty": 0, "avg_cost": 0, "last_price": 0, "pnl": "P&L"}], "explanation": "A good, brief explanation (3-4 sentences) summarizing portfolio performance and highlighting major gainers/losers", "heatmapData": [], "dumbbellData": [], "pieChartData": []}`;
    } else if (queryCategory === "comparison") {
      categorySchema = `{"subject": "One line stating what's being compared", "metrics": [{"name": "Metric Name", "tickerA": "Ticker A Value", "tickerB": "Ticker B Value"}], "explanation": "A brief, clear explanation (3-4 sentences) summarizing the comparison takeaway and which option might be better based on the data", "heatmapData": [], "dumbbellData": [], "pieChartData": []}`;
    } else if (queryCategory === "market") {
      categorySchema = `{"news_synthesis": "1-2 sentence synthesis of the overall market picture", "news_bullets": ["Relevant headline 1 (flat string, no markdown bullets)", "Relevant headline 2"], "movers": [{"ticker": "SYM", "price": 0, "change_pct": 0, "direction": "UP/DOWN", "time_frame": "1D"}], "explanation": "A detailed but brief explanation of the market situation, its causes, and potential impacts on investors, spanning 3-4 sentences", "heatmapData": [], "dumbbellData": [], "pieChartData": []}`;
    } else if (queryCategory === "decision") {
      categorySchema = `{"observation": "State what data shows plainly", "disclaimer": "Explicit statement that you give data-backed observations not financial advice", "signal": "Specific conditional signal if one exists", "heatmapData": [], "dumbbellData": [], "pieChartData": []}`;
    } else if (queryCategory === "screener") {
      categorySchema = `{"disambiguation": "Optional 1-2 sentences clarifying ambiguous terms (e.g. 'cheapest' = absolute price vs valuation) and warning that low price != good buy", "results": [{"ticker": "SYM", "price": 0, "metric": "Optional context metric"}], "heatmapData": [], "dumbbellData": [], "pieChartData": []}`;
    } else if (queryCategory === "educational") {
      categorySchema = `{"explanation": "Clear, step-by-step explanation answering the user's question about trading strategies or concepts", "example": "Optional 1-2 sentence practical example", "heatmapData": [], "dumbbellData": [], "pieChartData": []}`;
    } else if (queryCategory === "irrelevant") {
      categorySchema = `{"reply": "Polite but firm message refusing to answer the non-financial question and steering the user back to the stock market.", "heatmapData": [], "dumbbellData": [], "pieChartData": []}`;
    } else {
      categorySchema = `{"definition": "1-2 sentence plain-language definition", "context": "Optional context if relevant to user's holding", "heatmapData": [], "dumbbellData": [], "pieChartData": []}`;
    }

    let systemPrompt = `You are Labh Sathi, a multimodal AI financial assistant.
CURRENT MARKET: ${marketContext}
LATEST NEWS: ${newsContext}${portfolioContext}

If the user provides an image (chart/document), analyze it for trends, patterns, or financial details.
If the user asks about a chart concept (like moving averages, SMA, EMA, MACD, etc) without specifying a ticker, you MUST pull up an example chart. Do this by setting 'aiChart' to a JSON object like this: {"symbol": "AAPL", "indicators": [{"type": "sma", "period": 50, "color": "#f59e0b"}, {"type": "sma", "period": 200, "color": "#ef4444"}]}. If they specify a ticker, use that ticker instead.

CRITICAL RULE: DO NOT use Markdown tables to draw heatmaps or comparisons in the 'reply' text. 
You MUST respond with ONLY a valid JSON object matching this exact schema:
${isChartRequest ? categorySchema.replace(/}$/, `, "aiChart": {"symbol": "AAPL", "indicators": [{"type": "sma", "period": 50, "color": "#f59e0b"}]} }`) : categorySchema}

RULES FOR YOUR RESPONSES:
- NEVER refer to the user in the third person. Always use 'you' and 'your portfolio'.
- NEVER give generic financial disclaimers (e.g., 'always monitor the market', 'do your own research').
- Keep your tone simple, concise, and easy to understand for beginners. Do not sound like a professional institutional analyst.

SAFETY RULES — MANDATORY:
- OFF-TOPIC RULE: If the user's prompt is NOT about finance, trading, investing, or this app, you MUST politely refuse to answer. Do not provide coding help, math solutions, or general knowledge. Output your refusal in the main text field of your required JSON schema (e.g. 'reply' or 'definition' or 'greeting').
- You never adopt urgency, all-in framing, or "act immediately" language that originates from the user's phrasing rather than from your own analysis of market conditions.
- Never recommend allocating "all available cash" or a portfolio's full balance to a single position.

DISAMBIGUATION & EVIDENCE RULES — MANDATORY:
- If a user asks for 'cheapest', 'best', 'safest', etc., you MUST disambiguate what they mean (e.g., absolute price vs valuation). Explain gently that low price != good buy.
- NEVER make a specific claim (like 'X is the cheapest') without visible numerical data to back it up in the tables/charts. If you can't show the data, don't make the claim.

INDICATOR RULES — MANDATORY:
- You NEVER calculate or estimate technical indicator values yourself.
- You ONLY report indicator values that are explicitly provided to you in the COMPUTED TECHNICAL INDICATORS section below.
- If a requested indicator is not present in the provided data, say so explicitly ("not calculated for this symbol").
- Never produce a different value for the same indicator on the same symbol within a short time window unless the underlying data has actually changed.`;

    // --- FETCH AND COMPUTE TECHNICAL INDICATORS FOR MENTIONED TICKERS ---
    // Extract ticker symbols from the user prompt
    const mentionedTickers = (prompt.match(/\b[A-Z]{2,10}\b/g) || [])
      .filter(t => STOCKS_DATA[t]); // Only valid tickers
    
    let indicatorContext = "";
    if (mentionedTickers.length > 0) {
      const tickersToAnalyze = [...new Set(mentionedTickers)].slice(0, 3); // Limit to 3
      
      for (const ticker of tickersToAnalyze) {
        try {
          const now = Date.now();
          let indicators;
          
          // Check cache first
          if (indicatorCache[ticker] && (now - indicatorCache[ticker].timestamp) < INDICATOR_CACHE_TTL) {
            indicators = indicatorCache[ticker].data;
          } else {
            // Fetch 1 year of daily OHLCV data for proper indicator computation
            const sData = STOCKS_DATA[ticker];
            const isIntl = sData && sData.intl === true;
            const yahooSymbol = isIntl ? ticker : `${ticker}.NS`;
            const hUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1y`;
            
            const hRes = await fetch(hUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
            const hJson = await hRes.json();
            const result = hJson.chart?.result?.[0];
            
            if (result && result.indicators?.quote?.[0]) {
              const quote = result.indicators.quote[0];
              const timestamps = result.timestamp || [];
              
              // Build OHLCV arrays, filtering out null values
              const ohlcv = { dates: [], opens: [], highs: [], lows: [], closes: [], volumes: [] };
              for (let i = 0; i < timestamps.length; i++) {
                if (quote.close[i] != null && quote.open[i] != null && quote.high[i] != null && quote.low[i] != null) {
                  ohlcv.dates.push(new Date(timestamps[i] * 1000).toISOString().split('T')[0]);
                  ohlcv.opens.push(quote.open[i]);
                  ohlcv.highs.push(quote.high[i]);
                  ohlcv.lows.push(quote.low[i]);
                  ohlcv.closes.push(quote.close[i]);
                  ohlcv.volumes.push(quote.volume?.[i] || 0);
                }
              }
              
              if (ohlcv.closes.length >= 20) {
                indicators = computeIndicators(ohlcv);
                indicatorCache[ticker] = { data: indicators, timestamp: now };
              }
            }
          }
          
          if (indicators) {
            indicatorContext += "\n" + formatIndicatorsForPrompt(ticker, indicators);
          }
        } catch (e) {
          console.warn(`[AI Context] Indicator computation failed for ${ticker}:`, e.message);
        }
      }
    }
    
    if (indicatorContext) {
      systemPrompt += indicatorContext + "\n";
    }

    if (isChartRequest) {
      const promptTickers = Object.keys(STOCKS_DATA).filter(t => {
        const baseName = t.replace(/(BANK|MOTORS|FINANCE|PHARMA|BZR)$/i, '');
        const regex = new RegExp(`\\b(${t}|${baseName})\\b`, 'i');
        return regex.test(prompt);
      });
      
      // Extract unknown uppercase tickers (e.g. TSLA, AMZN)
      const uppercaseWords = prompt.match(/\b[A-Z]{2,6}\b/g) || [];
      uppercaseWords.forEach(w => {
          if (!['WHAT', 'HOW', 'WHY', 'THE', 'AND', 'FOR', 'WITH', 'FROM', 'THIS', 'THAT'].includes(w)) {
              promptTickers.push(w);
          }
      });
      
      // 2. BUILD LIST OF TICKERS TO FETCH
      let tickersToFetch = new Set(promptTickers);
      if (tickersToFetch.size === 0) {
        // Fallback to portfolio if no specific ticker mentioned
        (user?.portfolio?.map(p => p.ticker) || []).forEach(t => tickersToFetch.add(t));
        if (tickersToFetch.size === 0) {
          tickersToFetch.add("HDFCBANK");
          tickersToFetch.add("RELIANCE");
          tickersToFetch.add("TCS");
        }
      }

      // Limit to 5 tickers to avoid rate limits or long wait times
      const finalTickers = Array.from(tickersToFetch).slice(0, 5);

      // 3. FETCH HISTORICAL DATA
      let historicalDataContext = "";
      try {
        for (const ticker of finalTickers) {
          const sData = STOCKS_DATA[ticker];
          
          let yahooSymbol = ticker;
          if (sData) {
              const isIntl = sData.intl === true;
              yahooSymbol = isIntl ? ticker : `${ticker}.NS`;
          }
          
          const hUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=6mo`;
          
          const hRes = await fetch(hUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
          const hJson = await hRes.json();
          const quote = hJson.chart?.result?.[0]?.indicators?.quote?.[0] || {};
          const timestamps = hJson.chart?.result?.[0]?.timestamp || [];
          if (quote.close && quote.close.length > 0) {
            const startIdx = Math.max(0, quote.close.length - 60);
            const isCandlestick = /candle|candel/i.test(prompt);
            
            if (isCandlestick) {
              let ohlcList = [];
              for(let i=startIdx; i<quote.close.length; i++) {
                 if(quote.close[i] != null) {
                   const dateStr = new Date(timestamps[i] * 1000).toLocaleDateString('en-US', {month:'short', day:'numeric'});
                   ohlcList.push(`{x:"${dateStr}", o:${quote.open[i]?.toFixed(2)}, h:${quote.high[i]?.toFixed(2)}, l:${quote.low[i]?.toFixed(2)}, c:${quote.close[i]?.toFixed(2)}}`);
                 }
              }
              historicalDataContext += `\nREAL OHLC HISTORY FOR ${ticker} (Last 60 days): [${ohlcList.join(", ")}]`;
            } else {
              let closeList = [];
              for(let i=startIdx; i<quote.close.length; i++) {
                 if(quote.close[i] != null) {
                   closeList.push(quote.close[i].toFixed(2));
                 }
              }
              historicalDataContext += `\nREAL HISTORY FOR ${ticker} (Last 60 days close prices): [${closeList.join(", ")}]`;
            }
          }
        }
      } catch (e) {
        console.warn("[AI Context] History fetch failed:", e.message);
      }

      systemPrompt += `\nREAL HISTORICAL DATA FOR CHARTING:${historicalDataContext}\n\nThe user wants a chart/visualization. You MUST choose between outputting an "aiChart" object OR a "chartConfig" object depending on the user's intent, and include it in your JSON.

1. FOR TRADING / PRICE ACTION (e.g. "How is INFY doing?", "Show me a chart", "Moving average"):
Output an "aiChart" field. You must output this field even if REAL HISTORICAL DATA is empty, as the frontend will fetch its own data to display the chart.
Format for aiChart:
{
  "symbol": "TICKER",
  "type": "candlestick",
  "timeframe": "3mo", // 1mo, 3mo, 6mo, 1y
  "indicators": [{"type": "sma", "period": 50}], // Request frontend to draw indicators (e.g. sma 20, sma 50)
  "annotations": [
    // CRITICAL RULES FOR ANNOTATIONS:
    // 1. ONLY annotate an event if it ACTUALLY HAPPENED in the raw data provided.
    // 2. NEVER annotate "No crossover" or "No event". If nothing happened, leave the array empty.
    // 3. A "bullish crossover" ONLY occurs on the exact date a faster moving average (e.g. 20-day) crosses ABOVE a slower moving average (e.g. 50-day).
    // 4. A "bearish crossover" ONLY occurs on the exact date a faster moving average crosses BELOW a slower moving average.
    // { "date": "YYYY-MM-DD", "text": "Bullish Crossover", "type": "bullish" }
  ]
}

2. FOR PORTFOLIO ALLOCATION / FUNDAMENTALS (e.g. "Sector breakdown", "Compare PE ratio"):
Output a "chartConfig" field with a Chart.js config (use "pie", "doughnut", or "bar").
- Use actual labels (e.g. Sector names or Tickers).
- Provide a 'data' object with 'labels' array and 'datasets' array.
- For pie/doughnut, provide an array of distinct backgroundColors in the dataset.

CRITICAL REQUIREMENT: You MUST include a "reply" field at the root of your JSON object containing a conversational Markdown string explaining the chart and your analysis. 
Format Example 1 (Trading): { "reply": "Here is the chart for SBI...", "aiChart": { "symbol": "SBIN", "type": "candlestick", "timeframe": "3mo", "indicators": [{"type":"sma","period":50}], "annotations": [] } }
Format Example 2 (Portfolio): { "reply": "Your portfolio...", "chartConfig": { "type": "doughnut", "data": { "labels": ["Tech", "Auto"], "datasets": [{ "data": [45, 55], "backgroundColor": ["#3b82f6", "#ef4444"] }] } } }`;
    } else if (isWhatIfRequest) {
      systemPrompt += `The user wants a what-if scenario analysis. Analyze how the described event would impact their portfolio using historical correlations. Include a "scenarioImpact" field.
CRITICAL REQUIREMENT: You MUST include a "reply" field at the root of your JSON object. This "reply" field MUST contain a conversational Markdown string explaining your analysis. DO NOT put raw JSON inside the "reply" field. DO NOT omit the "reply" field.
Format: { "reply": "detailed analysis text", "tradeSymbol": null, "scenarioImpact": { "sectors": [{ "name": "Banking", "impactPct": -2.5 }, ...], "totalPnlPct": -1.8, "affectedCountries": ["US", "IN"] } }`;
    } else if (queryCategory === "screener") {
      const screenerDetails = screenerMatchedTickers.length > 0 ? screenerMatchedTickers.map(t => `${t} (Price: ₹${STOCKS_DATA[t].price}, P/E: ${STOCKS_DATA[t].peRatio || "N/A"})`).join(", ") : "None";
      systemPrompt += `The user requested a market screen. The database matched these tickers: ${screenerDetails}. 
${screenerThresholdMsg ? `Include this note in your reply: "${screenerThresholdMsg}"` : ""}`;
    } else if (queryCategory === "irrelevant") {
      systemPrompt += `\nCRITICAL REQUIREMENT: The user asked an irrelevant question (e.g. coding, math, general knowledge) that has nothing to do with finance or the stock market. You MUST refuse to answer it. Output a "reply" field politely declining the question and steering the conversation back to trading/finance.`;
    } else {
      systemPrompt += `You must output a JSON object. The "reply" field MUST be a single Markdown-formatted string containing your conversational response and analysis. DO NOT use nested JSON objects inside "reply". The "tradeSymbol" field should be the stock ticker if they ask to buy/sell, or null. Example: {"reply": "Here is the analysis you requested:\\n\\n**Economic Impact**...", "tradeSymbol": null}`;
    }
    
    // Explicit instruction to skip thinking tokens to reduce generation time for large models
    systemPrompt += `\n\nCRITICAL SPEED REQUIREMENT: DO NOT output any <thought> or <reasoning> tags. Skip internal monologues. Output the final JSON object IMMEDIATELY to save generation time.`;

    let chatMessages = [{ role: "system", content: systemPrompt }];

    // Handling multimodal content
    if (attachments && attachments.length > 0) {
      const userContent = [
        { type: "text", text: prompt || "Analyze these files for me." },
      ];

      attachments.forEach((file) => {
        if (file.type.startsWith("image/")) {
          userContent.push({
            type: "image_url",
            image_url: { url: file.data },
          });
        } else {
          userContent.push({
            type: "text",
            text: `[User attached a file: ${file.name} (${file.type})] Content summary: ${file.data.substring(0, 500)}...`,
          });
        }
      });
      chatMessages.push({ role: "user", content: userContent });
    } else {
      chatMessages.push({ role: "user", content: prompt });
    }

    let response;
    const isNemotron = actualModelId === "nvidia/nemotron-3-ultra-550b-a55b";
    let isMoonshot = actualModelId === "moonshotai/kimi-k2.6";
    
    try {
      if (isNemotron) {
        response = await nvidiaAi.chat.completions.create({
          model: actualModelId,
          messages: chatMessages,
          temperature: 0.3,
          top_p: 0.95,
          max_tokens: 4000,
          response_format: { type: "json_object" }
        });
      } else if (isMoonshot) {
        response = await moonshotAi.chat.completions.create({
          model: actualModelId,
          messages: chatMessages,
          temperature: 0.3,
          top_p: 0.95,
          max_tokens: 4000,
          response_format: { type: "json_object" }
        });
      } else {
        const payload = {
          model: actualModelId,
          messages: chatMessages,
          max_tokens: 2000,
          temperature: 0.3
        };
        // Groq's Llama 3.2 Vision model does not yet support json_object mode
        if (actualModelId !== "llama-3.2-11b-vision-preview") {
          payload.response_format = { type: "json_object" };
        }
        response = await ai.chat.completions.create(payload);
      }
    } catch (e) {
      console.warn(`[AI] Primary model ${actualModelId} failed:`, e.message);
      
      // If Auto mode is active and the first model wasn't already Kimi, fallback to Kimi
      if ((!modelId || modelId === "auto") && !isMoonshot) {
        if (isVision) {
          return res.json({ reply: "I'm currently experiencing high traffic on my image analysis models. Please try uploading your image again in a few moments." });
        }
        console.log(`[AI] Auto-fallback triggered: Retrying with Kimi k2.6...`);
        try {
          isMoonshot = true;
          actualModelId = "moonshotai/kimi-k2.6";
          response = await moonshotAi.chat.completions.create({
            model: actualModelId,
            messages: chatMessages,
            temperature: 0.3,
            top_p: 0.95,
            max_tokens: 4000,
            response_format: { type: "json_object" }
          });
        } catch (kimiErr) {
          console.error(`[AI] Fallback model also failed:`, kimiErr.message);
          return res.json({ reply: "I'm currently experiencing high traffic and my AI models are temporarily overwhelmed. Please try your request again in a few moments." });
        }
      } else {
        // Return a friendly error instead of raw JSON
        return res.json({ reply: "My AI brain hit a snag while processing that (either the request was too large or I hit a rate limit). Please try asking again!" });
      }
    }

    let content = response.choices[0].message.content.trim();
    
    // --- ROBUST JSON EXTRACTION ---
    // 1. Strip markdown fences
    if (content.startsWith("```json")) content = content.replace(/```json/g, "").replace(/```/g, "").trim();
    else if (content.startsWith("```")) content = content.replace(/```/g, "").trim();

    let parsed = null;
    
    // 2. Try direct parse
    try { parsed = JSON.parse(content); } catch {}

    // 3. Extract JSON object embedded in natural language text
    if (!parsed) {
      const jsonMatch = content.match(/\{[\s\S]*"reply"\s*:\s*"[\s\S]*?\}(?:\s*\})?/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch {}
      }
    }

    // 4. HYBRID RESPONSE HANDLING
    // If we still don't have a valid 'reply' but we have JSON at the end
    if (!parsed || !parsed.reply) {
        const lastBrace = content.lastIndexOf('}');
        const firstBrace = content.lastIndexOf('{', lastBrace);
        if (firstBrace !== -1 && lastBrace !== -1) {
            const potentialJson = content.substring(firstBrace, lastBrace + 1);
            try {
                const p = JSON.parse(potentialJson);
                // If the main content didn't parse but the tail did
                if (!parsed) parsed = p;
                // If this is just a data block, use the text BEFORE it as the reply
                if (p && (!p.reply || p.reply.length < 5)) {
                    parsed.reply = content.substring(0, firstBrace).trim();
                }
            } catch(e) {}
        }
    }

    if (parsed) {
      let finalReply = "";
      
      if (queryCategory === "greeting") {
        finalReply = `${parsed.greeting || ""}\n\n${parsed.next_actions || ""}`.trim();
      } else if (queryCategory === "single_stock") {
        const textBody = parsed.explanation || parsed.justification || "";
        finalReply = `**${parsed.verdict || "Analysis"}**\n\n${textBody}\n\n`;
        if (parsed.indicators && Array.isArray(parsed.indicators) && parsed.indicators.length > 0) {
          finalReply += `### Indicators\n| Indicator | Value | Reading |\n|---|---|---|\n`;
          parsed.indicators.forEach(ind => {
            finalReply += `| ${ind.name || ""} | ${ind.value || ""} | ${ind.reading || ""} |\n`;
          });
        }
        if (parsed.conflict_note) {
          finalReply += `\n*${parsed.conflict_note}*`;
        }
      } else if (queryCategory === "portfolio") {
        let totalPnlStr = parsed.total_pnl || "";
        const isDownTotal = totalPnlStr.includes("-");
        const isUpTotal = totalPnlStr.includes("+") || (!isDownTotal && parseFloat(totalPnlStr.replace(/[^0-9.-]/g, '')) > 0);
        let totalPnlColor = "inherit";
        let totalPnlIcon = "";
        if (isDownTotal) { totalPnlColor = "var(--red)"; totalPnlIcon = "trending_down"; }
        else if (isUpTotal) { totalPnlColor = "var(--green)"; totalPnlIcon = "trending_up"; }
        
        let totalPnlFormatted = totalPnlStr;
        if (totalPnlColor !== "inherit") {
            totalPnlFormatted = `<span style="color: ${totalPnlColor}">${totalPnlStr}</span> <span class="material-symbols-outlined" style="color: ${totalPnlColor}; font-size: 18px; vertical-align: middle;">${totalPnlIcon}</span>`;
        }

        finalReply = `**Total Value:** ${parsed.total_value || ""} | **Total P&L:** ${totalPnlFormatted}\n\n`;
        if (parsed.holdings && Array.isArray(parsed.holdings) && parsed.holdings.length > 0) {
          finalReply += `### Holdings\n| Ticker | Qty | Avg Cost | Last Price | P&L | Trend |\n|---|---|---|---|---|---|\n`;
          parsed.holdings.forEach(h => {
            const pnlStr = h.pnl || "";
            const isDown = pnlStr.includes("-");
            const isUp = pnlStr.includes("+") || (!isDown && parseFloat(pnlStr.replace(/[^0-9.-]/g, '')) > 0);
            
            let color = "inherit";
            let icon = "";
            if (isDown) { color = "var(--red)"; icon = "trending_down"; }
            else if (isUp) { color = "var(--green)"; icon = "trending_up"; }
            
            const pnlFormatted = color !== "inherit" ? `<span style="color: ${color}">${pnlStr}</span>` : pnlStr;
            const trendFormatted = icon ? `<span class="material-symbols-outlined" style="color: ${color}; font-size: 18px; vertical-align: middle;">${icon}</span>` : "";

            finalReply += `| **${h.ticker || ""}** | ${h.qty || ""} | ${h.avg_cost || ""} | ${h.last_price || ""} | ${pnlFormatted} | ${trendFormatted} |\n`;
          });
        }
        const textBody = parsed.explanation || parsed.insight || "";
        if (textBody) {
          finalReply += `\n\n${textBody}`;
        }
      } else if (queryCategory === "comparison") {
        finalReply = `**${parsed.subject || "Comparison"}**\n\n`;
        if (parsed.metrics && Array.isArray(parsed.metrics) && parsed.metrics.length > 0) {
          finalReply += `| Metric | Ticker A | Ticker B |\n|---|---|---|\n`;
          parsed.metrics.forEach(m => {
            finalReply += `| **${m.name || ""}** | ${m.tickerA || ""} | ${m.tickerB || ""} |\n`;
          });
        }
        const textBody = parsed.explanation || parsed.takeaway || "";
        if (textBody) finalReply += `\n\n${textBody}`;
      } else if (queryCategory === "market") {
        if (parsed.news_synthesis) {
          finalReply += `${parsed.news_synthesis}\n\n`;
        }
        if (parsed.news_summary && !parsed.news_synthesis) {
          finalReply += `${parsed.news_summary}\n\n`;
        }
        if (parsed.news_bullets && Array.isArray(parsed.news_bullets) && parsed.news_bullets.length > 0) {
          parsed.news_bullets.forEach(b => {
            finalReply += `- ${b}\n`;
          });
          finalReply += `\n`;
        }
        if (parsed.movers && Array.isArray(parsed.movers) && parsed.movers.length >= 3) {
          const limitedMovers = parsed.movers.slice(0, 5);
          finalReply += `### Market Movers\n| Ticker | Price | % Change | Trend | Time Frame |\n|---|---|---|---|---|\n`;
          limitedMovers.forEach(m => {
            const pct = m.change_pct !== undefined ? m.change_pct : (m.change || 0);
            const isUp = parseFloat(pct) >= 0 || m.direction === 'UP';
            const trendIcon = isUp ? 'trending_up' : 'trending_down';
            const trendColor = isUp ? 'var(--green)' : 'var(--red)';
            const trend = `<span class="material-symbols-outlined" style="color: ${trendColor}; font-size: 18px; vertical-align: middle;">${trendIcon}</span>`;
            
            finalReply += `| **${m.ticker || ""}** | ₹${m.price || "-"} | <span style="color: ${trendColor}">${pct}%</span> | ${trend} | ${m.time_frame || "1D"} |\n`;
          });
        }
        const textBody = parsed.explanation || parsed.insight || "";
        if (textBody) finalReply += `\n\n${textBody}`;
      } else if (queryCategory === "decision") {
        finalReply = `${parsed.observation || ""}\n\n*${parsed.disclaimer || ""}*\n\n**${parsed.signal || ""}**`;
      } else if (queryCategory === "educational") {
        finalReply = `${parsed.explanation || parsed.definition || ""}\n\n${parsed.example || parsed.context || ""}`;
      } else if (queryCategory === "screener") {
        if (parsed.disambiguation) finalReply += `${parsed.disambiguation}\n\n`;
        if (parsed.results && Array.isArray(parsed.results) && parsed.results.length > 0) {
          finalReply += `### Screener Results\n| Ticker | Price | Metric |\n|---|---|---|\n`;
          parsed.results.forEach(r => {
            finalReply += `| **${r.ticker || ""}** | ₹${r.price || 0} | ${r.metric || "-"} |\n`;
          });
        }
      }
      
      if (!finalReply || finalReply.trim() === "") {
         finalReply = parsed.reply || "Here is the data visualization you requested:";
      }

      res.json({
        reply: finalReply,
        tradeSymbol: parsed.tradeSymbol || null,
        chartConfig: parsed.chartConfig || null,
        aiChart: parsed.aiChart || null,
        pieChartData: parsed.pieChartData || null,
        heatmapData: parsed.heatmapData || null,
        dumbbellData: parsed.dumbbellData || null,
        scenarioImpact: parsed.scenarioImpact || null,
        journal: parsed.journal || null,
        isJournal: parsed.isJournal || false,
        screenerResults: parsed.screenerResults || null,
        thoughtTime: ((Date.now() - reqStartTime) / 1000).toFixed(1),
        sources: usedSources.length > 0 ? usedSources : null
      });
    } else {
      // Final Fallback: The AI gave us something that failed all JSON parsing attempts.
      // We'll use regex to try and salvage just the text content from the "reply" field
      // or just show the whole thing if it's not JSON-like.
      let salvagedReply = content;
      
      if (content.includes('"reply"')) {
        // Try to grab everything between "reply": " and the next "
        const match = content.match(/"reply"\s*:\s*"([\s\S]*?)"(?:\s*[,\}]|$)/);
        if (match && match[1]) {
            salvagedReply = match[1];
        } else {
            // If that failed, try to just strip the outer braces if they exist
            salvagedReply = content.replace(/^\{/, '').replace(/\}$/, '').trim();
            // Further strip common JSON keys if they leaked into the start
            salvagedReply = salvagedReply.replace(/^"reply"\s*:\s*"/, '').replace(/"$/, '').trim();
        }
      }
      
      res.json({ 
        reply: salvagedReply, 
        tradeSymbol: null,
        thoughtTime: ((Date.now() - reqStartTime) / 1000).toFixed(1),
        sources: usedSources.length > 0 ? usedSources : null 
      });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "AI Error: " + e.message });
  }
});


app.post("/api/roast", async (req, res) => {
  if (!ai)
    return res.json({
      roastText:
        "Your portfolio is too boring to roast. Add GROQ_API_KEY to get the real FIRE! 🔥",
      riskScore: 5,
    });
  try {
    const response = await ai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content:
            "Roast this stock portfolio: " +
            JSON.stringify(req.body.portfolio) +
            '. Return pure JSON format: { "roastText": "string", "riskScore": integer } without any markdown like ```json',
        },
      ],
      max_tokens: 200,
    });
    let content = response.choices[0].message.content.trim();
    if (content.startsWith("```json"))
      content = content.replace(/```json/g, "").replace(/```/g, "");
    else if (content.startsWith("```")) content = content.replace(/```/g, "");
    res.json(JSON.parse(content));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "AI Error: " + e.message });
  }
});

app.get("/api/globe-threat-zones", async (req, res) => {
  try {
    const payload = await getGlobeThreatZonesPayload(ai);
    res.json(payload);
  } catch (e) {
    console.error("[globe-threat-zones]", e);
    res.json({
      zones: [],
      updatedAt: new Date().toISOString(),
      aiPowered: false,
      quotesSource: "fallback",
      warning: "Live globe threat zones are temporarily unavailable.",
    });
  }
});

app.get("/api/global-market-pulse", async (req, res) => {
  try {
    const payload = await getGlobalMarketPulsePayload();
    res.json(payload);
  } catch (e) {
    console.error("[global-market-pulse]", e);
    res.json({
      timestamp: new Date().toISOString(),
      pulse: [],
      warning: "Live global market pulse is temporarily unavailable.",
    });
  }
});

/**
 * World Finance & Threat Globe — curated threat copy + live Yahoo quotes & headlines.
 */
app.get("/api/country-impact/:countryCode", async (req, res) => {
  const payload = getCountryImpactPayload(req.params.countryCode);
  if (!payload) {
    return res.status(404).json({
      error: "Unknown country code",
      countryCode: String(req.params.countryCode || "").toUpperCase(),
    });
  }
  try {
    const enriched = await enrichCountryImpactWithLiveData(payload);
    res.json(enriched);
  } catch (e) {
    console.error("[country-impact]", e);
    res.json({
      ...payload,
      liveQuotesAsOf: new Date().toISOString(),
      financialDataSource: "static_fallback",
      warning: "Live market data is temporarily unavailable.",
    });
  }
});

// --- ML STOCK RECOMMENDATION ENGINE ---
const recommendationCache = {}; // per-user cache
const RECOMMENDATION_CACHE_TTL = 300000; // 5 minutes

app.get("/api/recommendations", async (req, res) => {
  try {
    const userId = req.query.userId;
    const { data: user } = userId ? await supabase.from("profiles").select("*").eq("id", userId).single() : { data: null };
    
    // Invalidate cache if user makes a new trade
    const tradeCount = user?.trades?.length || 0;
    const cacheKey = user ? `${userId}_${tradeCount}` : "__anonymous__";

    // Return cached if fresh
    if (
      recommendationCache[cacheKey] &&
      Date.now() - recommendationCache[cacheKey].timestamp < RECOMMENDATION_CACHE_TTL
    ) {
      return res.json(recommendationCache[cacheKey].data);
    }

    const result = await generateRecommendations(STOCKS_DATA, user, ai);
    recommendationCache[cacheKey] = { data: result, timestamp: Date.now() };
    res.json(result);
  } catch (e) {
    console.error("[Recommendations] Error:", e.message);
    res.status(500).json({ error: "Failed to generate recommendations: " + e.message });
  }
});
// --- END ML RECOMMENDATION ENGINE ---

// Serve index.html for unknown routes (SPA behavior fallback)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
