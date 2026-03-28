import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import { users, interlocks, STOCKS_DATA } from './data/store.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Serve frontend static files from the 'frontend' directory
app.use(express.static(path.join(__dirname, 'frontend')));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ai = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// Auth Routes
app.post('/api/auth/register', (req, res) => {
    const { name, email, password, level = 'Beginner' } = req.body;
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email exists' });
    const user = { id: Date.now().toString(), name, email, password, balance: 100000, portfolio: [], trades: [], level };
    users.push(user);
    res.json({ user });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ user });
});

app.get('/api/auth/me', (req, res) => {
    const user = users.find(u => u.email === req.query.email);
    user ? res.json({ user }) : res.status(404).json({ error: 'Not found' });
});

// Markets Route
app.get('/api/markets', (req, res) => {
    res.json(Object.values(STOCKS_DATA));
});

// --- BACKGROUND POLLER FOR LIVE LOBBY DATA ---
async function fetchLivePrices() {
    const symbols = Object.keys(STOCKS_DATA);
    console.log(`[Poller] Fetching live prices for ${symbols.length} stocks...`);
    
    // Fetch quotes dynamically using v8 endpoint and Promise.allSettled
    const fetchPromises = symbols.map(symbol => {
        const isIntl = STOCKS_DATA[symbol].intl === true;
        const yahooSymbol = isIntl ? symbol : `${symbol}.NS`;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`;
        
        return fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            }
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            const result = data.chart?.result?.[0];
            const meta = result?.meta;
            if (meta && meta.regularMarketPrice) {
                const price = meta.regularMarketPrice;
                const prevClose = meta.previousClose || meta.chartPreviousClose || price;
                const change = +(((price - prevClose) / prevClose) * 100).toFixed(2);
                
                // Mutate the imported object to act as an in-memory live cache
                STOCKS_DATA[symbol].price = price;
                STOCKS_DATA[symbol].change = change;

                // Extract additional live data from meta
                if (meta.fiftyTwoWeekHigh) STOCKS_DATA[symbol].week52High = +meta.fiftyTwoWeekHigh.toFixed(2);
                if (meta.fiftyTwoWeekLow) STOCKS_DATA[symbol].week52Low = +meta.fiftyTwoWeekLow.toFixed(2);
                if (meta.regularMarketVolume) {
                    const vol = meta.regularMarketVolume;
                    STOCKS_DATA[symbol].volume = vol >= 1e6 ? (vol / 1e6).toFixed(1) + 'M' : vol >= 1e3 ? (vol / 1e3).toFixed(0) + 'K' : vol.toString();
                }

                // Try to get volume from indicators if not in meta
                if (!meta.regularMarketVolume && result.indicators?.quote?.[0]?.volume) {
                    const volumes = result.indicators.quote[0].volume.filter(v => v != null);
                    if (volumes.length > 0) {
                        const totalVol = volumes.reduce((a, b) => a + b, 0);
                        STOCKS_DATA[symbol].volume = totalVol >= 1e6 ? (totalVol / 1e6).toFixed(1) + 'M' : totalVol >= 1e3 ? (totalVol / 1e3).toFixed(0) + 'K' : totalVol.toString();
                    }
                }
            }
        });
    });

    await Promise.allSettled(fetchPromises);
}

// Fundamentals poller — fetches Market Cap & PE Ratio (runs less frequently)
async function fetchFundamentals() {
    const symbols = Object.keys(STOCKS_DATA);
    console.log(`[Poller] Fetching fundamentals for ${symbols.length} stocks...`);

    // Process in batches of 5 to avoid rate limiting
    for (let i = 0; i < symbols.length; i += 5) {
        const batch = symbols.slice(i, i + 5);
        const promises = batch.map(symbol => {
            const isIntl = STOCKS_DATA[symbol].intl === true;
            const yahooSymbol = isIntl ? symbol : `${symbol}.NS`;
            const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${yahooSymbol}?modules=price,defaultKeyStatistics`;
            
            return fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                const price = data.quoteSummary?.result?.[0]?.price;
                const stats = data.quoteSummary?.result?.[0]?.defaultKeyStatistics;
                
                if (price) {
                    // Market Cap
                    const mc = price.marketCap;
                    if (mc && mc.raw) {
                        const raw = mc.raw;
                        const isINR = !STOCKS_DATA[symbol].intl;
                        if (isINR) {
                            if (raw >= 1e12) STOCKS_DATA[symbol].mktCap = '₹' + (raw / 1e12).toFixed(1) + 'L Cr';
                            else if (raw >= 1e7) STOCKS_DATA[symbol].mktCap = '₹' + (raw / 1e7).toFixed(0) + ' Cr';
                            else STOCKS_DATA[symbol].mktCap = '₹' + (raw / 1e5).toFixed(0) + ' L';
                        } else {
                            if (raw >= 1e12) STOCKS_DATA[symbol].mktCap = '$' + (raw / 1e12).toFixed(1) + 'T';
                            else if (raw >= 1e9) STOCKS_DATA[symbol].mktCap = '$' + (raw / 1e9).toFixed(0) + 'B';
                            else STOCKS_DATA[symbol].mktCap = '$' + (raw / 1e6).toFixed(0) + 'M';
                        }
                    }
                }

                if (stats) {
                    // P/E Ratio (trailing)
                    const pe = stats.trailingPE || stats.forwardPE;
                    if (pe && pe.raw) STOCKS_DATA[symbol].peRatio = +pe.raw.toFixed(1);
                }
            })
            .catch(() => { /* silently skip failed symbols */ });
        });
        
        await Promise.allSettled(promises);
        // Small delay between batches to be respectful
        if (i + 5 < symbols.length) await new Promise(r => setTimeout(r, 500));
    }
    console.log('[Poller] Fundamentals update complete.');
}

// Bootstrapper: prices every 15s, fundamentals every 5 minutes
fetchLivePrices();
setInterval(fetchLivePrices, 15000);
setTimeout(() => fetchFundamentals(), 5000); // Start 5s after server boot
setInterval(fetchFundamentals, 300000);       // Then every 5 minutes
// ----------------------------------------------

// --- COMMODITIES LIVE DATA ---
const COMMODITIES_DATA = {
    // Energy
    'CL=F':  { sym: 'CL=F',  name: 'Crude Oil',    category: 'Energy',   unit: 'USD/bbl', price: 0, change: 0 },
    'NG=F':  { sym: 'NG=F',  name: 'Natural Gas',   category: 'Energy',   unit: 'USD/MMBtu', price: 0, change: 0 },
    // Precious Metals
    'GC=F':  { sym: 'GC=F',  name: 'Gold (XAU)',    category: 'Precious Metals', unit: 'USD/oz', price: 0, change: 0 },
    'SI=F':  { sym: 'SI=F',  name: 'Silver (XAG)',  category: 'Precious Metals', unit: 'USD/oz', price: 0, change: 0 },
    'PL=F':  { sym: 'PL=F',  name: 'Platinum',      category: 'Precious Metals', unit: 'USD/oz', price: 0, change: 0 },
    'PA=F':  { sym: 'PA=F',  name: 'Palladium',     category: 'Precious Metals', unit: 'USD/oz', price: 0, change: 0 },
    // Base Metals
    'HG=F':  { sym: 'HG=F',  name: 'Copper',        category: 'Base Metals', unit: 'USD/lb', price: 0, change: 0 },
    'ALI=F': { sym: 'ALI=F', name: 'Aluminium',     category: 'Base Metals', unit: 'USD/t', price: 0, change: 0 },
    // Grains
    'ZW=F':  { sym: 'ZW=F',  name: 'Wheat',         category: 'Grains',   unit: 'USd/bu', price: 0, change: 0 },
    'ZC=F':  { sym: 'ZC=F',  name: 'Corn',          category: 'Grains',   unit: 'USd/bu', price: 0, change: 0 },
    'ZS=F':  { sym: 'ZS=F',  name: 'Soybeans',      category: 'Grains',   unit: 'USd/bu', price: 0, change: 0 },
    // Softs
    'KC=F':  { sym: 'KC=F',  name: 'Coffee',        category: 'Softs',    unit: 'USd/lb', price: 0, change: 0 },
    'SB=F':  { sym: 'SB=F',  name: 'Sugar',         category: 'Softs',    unit: 'USd/lb', price: 0, change: 0 },
    'CT=F':  { sym: 'CT=F',  name: 'Cotton',        category: 'Softs',    unit: 'USd/lb', price: 0, change: 0 },
};

async function fetchCommodityPrices() {
    const symbols = Object.keys(COMMODITIES_DATA);
    console.log(`[Poller] Fetching live prices for ${symbols.length} commodities...`);

    const fetchPromises = symbols.map(symbol => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
        return fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            }
        })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(data => {
            const meta = data.chart?.result?.[0]?.meta;
            if (meta && meta.regularMarketPrice) {
                const price = meta.regularMarketPrice;
                const prevClose = meta.previousClose || meta.chartPreviousClose || price;
                const change = +(((price - prevClose) / prevClose) * 100).toFixed(2);
                COMMODITIES_DATA[symbol].price = price;
                COMMODITIES_DATA[symbol].change = change;
            }
        });
    });
    await Promise.allSettled(fetchPromises);
}

fetchCommodityPrices();
setInterval(fetchCommodityPrices, 30000); // Every 30s for commodities

app.get('/api/commodities', (req, res) => {
    res.json(Object.values(COMMODITIES_DATA));
});
// --- END COMMODITIES ---

// --- STOCK NEWS ---
let newsCache = [];

async function fetchStockNews() {
    try {
        console.log('[Poller] Fetching stock news...');
        const rssUrl = 'https://news.google.com/rss/search?q=NSE+BSE+stock+market+India+shares&hl=en-IN&gl=IN&ceid=IN:en';
        const response = await fetch(rssUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);
        const xml = await response.text();

        // Simple XML parsing for RSS items
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(xml)) !== null && items.length < 12) {
            const block = match[1];
            const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
            const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
            const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
            const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';

            // Clean CDATA
            const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
            const cleanLink = link.replace(/<!\[CDATA\[|\]\]>/g, '').trim();

            // Try to match a tracked stock
            let matchedStock = null;
            const titleLower = cleanTitle.toLowerCase();
            for (const sym of Object.keys(STOCKS_DATA)) {
                const stock = STOCKS_DATA[sym];
                const nameWords = stock.name.toLowerCase().split(/\s+/);
                // Match if the first significant word of stock name appears in headline
                const keyword = nameWords.find(w => w.length > 3) || nameWords[0];
                if (titleLower.includes(keyword) || titleLower.includes(sym.toLowerCase())) {
                    matchedStock = { sym: stock.sym, name: stock.name, logo: stock.logo, price: stock.price, change: stock.change };
                    break;
                }
            }

            items.push({
                title: cleanTitle,
                link: cleanLink,
                pubDate,
                source,
                stock: matchedStock
            });
        }
        newsCache = items;
    } catch (e) {
        console.error('[News] Fetch error:', e.message);
    }
}

fetchStockNews();
setInterval(fetchStockNews, 120000); // Every 2 minutes

app.get('/api/news', (req, res) => {
    res.json(newsCache);
});
// --- END STOCK NEWS ---

// --- SENTIMENT ENGINE ---
let sentimentCache = null;
let sentimentCacheTime = 0;
const SENTIMENT_CACHE_TTL = 180000; // 3 minutes

app.get('/api/sentiment', async (req, res) => {
    // Return cached if fresh
    if (sentimentCache && (Date.now() - sentimentCacheTime < SENTIMENT_CACHE_TTL)) {
        return res.json(sentimentCache);
    }

    // Need news headlines to analyze
    if (!newsCache || newsCache.length === 0) {
        return res.json({ headlines: [], overallMood: 'neutral', moodScore: 50, analyzedAt: new Date().toISOString() });
    }

    // If no AI key, return rule-based fallback
    if (!ai) {
        const fallback = newsCache.slice(0, 10).map(item => {
            const title = item.title.toLowerCase();
            let sentiment = 'neutral', confidence = 0.5;
            const bullWords = ['surge','rally','gain','rise','jump','soar','boom','high','profit','record','up','bull'];
            const bearWords = ['fall','drop','crash','sink','loss','decline','down','bear','plunge','slump','low','fear'];
            const bullHits = bullWords.filter(w => title.includes(w)).length;
            const bearHits = bearWords.filter(w => title.includes(w)).length;
            if (bullHits > bearHits) { sentiment = 'bullish'; confidence = Math.min(0.6 + bullHits * 0.1, 0.95); }
            else if (bearHits > bullHits) { sentiment = 'bearish'; confidence = Math.min(0.6 + bearHits * 0.1, 0.95); }
            else { confidence = 0.4; }
            return {
                title: item.title,
                source: item.source || 'Unknown',
                pubDate: item.pubDate,
                link: item.link,
                stock: item.stock,
                sentiment,
                confidence: +confidence.toFixed(2),
                reasoning: 'Rule-based analysis (add GROQ_API_KEY for AI analysis)',
                keywords: []
            };
        });
        const bullCount = fallback.filter(h => h.sentiment === 'bullish').length;
        const bearCount = fallback.filter(h => h.sentiment === 'bearish').length;
        const moodScore = Math.round(50 + ((bullCount - bearCount) / fallback.length) * 50);
        const overallMood = moodScore >= 60 ? 'bullish' : moodScore <= 40 ? 'bearish' : 'neutral';
        sentimentCache = { headlines: fallback, overallMood, moodScore, analyzedAt: new Date().toISOString(), aiPowered: false };
        sentimentCacheTime = Date.now();
        return res.json(sentimentCache);
    }

    // AI-powered analysis
    try {
        const headlinesToAnalyze = newsCache.slice(0, 10).map((n, i) => `${i+1}. "${n.title}" (Source: ${n.source || 'Unknown'})`).join('\n');

        const response = await ai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{
                role: 'system',
                content: `You are a financial sentiment analysis engine for the Indian Stock Market (NSE/BSE). Analyze each headline and return ONLY valid JSON. No markdown, no explanation.`
            }, {
                role: 'user',
                content: `Analyze these Indian stock market headlines for sentiment. Return pure JSON (no markdown backticks):
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
${headlinesToAnalyze}`
            }],
            max_tokens: 1200,
            temperature: 0.2
        });

        let content = response.choices[0].message.content.trim();
        // Clean any markdown wrapping
        if (content.startsWith('```json')) content = content.replace(/```json/g, '').replace(/```/g, '');
        else if (content.startsWith('```')) content = content.replace(/```/g, '');

        const aiResult = JSON.parse(content);

        // Merge AI results with our news data
        const merged = newsCache.slice(0, 10).map((item, i) => {
            const aiItem = aiResult.headlines.find(h => h.index === i + 1) || {};
            return {
                title: item.title,
                source: item.source || 'Unknown',
                pubDate: item.pubDate,
                link: item.link,
                stock: item.stock,
                sentiment: aiItem.sentiment || 'neutral',
                confidence: aiItem.confidence || 0.5,
                reasoning: aiItem.reasoning || 'No analysis available',
                keywords: aiItem.keywords || []
            };
        });

        sentimentCache = {
            headlines: merged,
            overallMood: aiResult.overallMood || 'neutral',
            moodScore: aiResult.moodScore || 50,
            marketSummary: aiResult.marketSummary || '',
            analyzedAt: new Date().toISOString(),
            aiPowered: true
        };
        sentimentCacheTime = Date.now();
        res.json(sentimentCache);
    } catch (e) {
        console.error('[Sentiment] AI analysis error:', e.message);
        res.status(500).json({ error: 'Sentiment analysis failed: ' + e.message });
    }
});
// --- END SENTIMENT ENGINE ---

// Chart Route — fetches OHLCV data from Yahoo Finance
app.get('/api/chart/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const range = req.query.range || '3mo';
        const interval = req.query.interval || '1d';
        const stockData = STOCKS_DATA[symbol];
        const isIntl = stockData && stockData.intl === true;
        const yahooSymbol = isIntl ? symbol : `${symbol}.NS`;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${range}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            }
        });

        if (!response.ok) throw new Error(`Yahoo Finance API returned ${response.status}`);
        const data = await response.json();

        const result = data.chart?.result?.[0];
        if (!result) throw new Error('No result from Yahoo API');

        const timestamps = result.timestamp || [];
        const quotes = result.indicators?.quote?.[0] || {};

        const chartDataMap = {};
        timestamps.forEach((ts, i) => {
            if (quotes.open?.[i] != null && quotes.close?.[i] != null) {
                const date = new Date(ts * 1000);
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                const timeStr = `${y}-${m}-${d}`;
                chartDataMap[timeStr] = {
                    time: timeStr,
                    open: +quotes.open[i].toFixed(2),
                    high: +(quotes.high?.[i] ?? quotes.open[i]).toFixed(2),
                    low: +(quotes.low?.[i] ?? quotes.close[i]).toFixed(2),
                    close: +quotes.close[i].toFixed(2),
                    volume: quotes.volume?.[i] || 0
                };
            }
        });
        const chartData = Object.values(chartDataMap).sort((a, b) => a.time.localeCompare(b.time));

        // Also pull latest meta for live price
        const meta = result.meta || {};
        res.json({
            candles: chartData,
            meta: {
                regularMarketPrice: meta.regularMarketPrice,
                previousClose: meta.previousClose || meta.chartPreviousClose,
                currency: meta.currency,
                symbol: meta.symbol
            }
        });
    } catch (error) {
        console.error('Chart fetch error for', req.params.symbol, ':', error.message);
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
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            const open = curPrice;
            const close = i === 0 ? basePrice : curPrice * (1 + (Math.random() * 0.04 - 0.02));
            const high = Math.max(open, close) * (1 + Math.random() * 0.012);
            const low = Math.min(open, close) * (1 - Math.random() * 0.012);
            mockCandles.push({
                time: `${y}-${m}-${d}`,
                open: +open.toFixed(2),
                high: +high.toFixed(2),
                low: +low.toFixed(2),
                close: +close.toFixed(2),
                volume: Math.round(Math.random() * 5000000 + 500000)
            });
            curPrice = close;
        }
        res.json({ candles: mockCandles, meta: { regularMarketPrice: basePrice, mock: true } });
    }
});

// Live Quote Route — fetches real-time price for a single stock
app.get('/api/quote/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const yahooSymbol = `${symbol}.NS`;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            }
        });

        if (!response.ok) throw new Error(`Yahoo returned ${response.status}`);
        const data = await response.json();
        const meta = data.chart?.result?.[0]?.meta;
        if (!meta) throw new Error('No meta');

        res.json({
            price: meta.regularMarketPrice,
            previousClose: meta.previousClose || meta.chartPreviousClose,
            change: meta.regularMarketPrice && meta.previousClose
                ? +(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100).toFixed(2)
                : 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Quote unavailable' });
    }
});

// Trading Engine
app.post('/api/trade', (req, res) => {
    const { userId, type, ticker, quantity } = req.body;
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const stock = STOCKS_DATA[ticker];
    if (!stock) return res.status(400).json({ error: 'Invalid stock' });

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid quantity' });

    const totalCost = stock.price * qty;
    
    user.trades = user.trades || [];
    const executionDate = new Date().toISOString();

    if (type === 'BUY') {
        if (user.balance < totalCost) return res.status(400).json({ error: 'Insufficient funds' });
        user.balance -= totalCost;
        const existing = user.portfolio.find(p => p.ticker === ticker);
        if (existing) {
            existing.avgPrice = ((existing.qty * existing.avgPrice) + totalCost) / (existing.qty + qty);
            existing.qty += qty;
        } else {
            user.portfolio.push({ ticker, qty: qty, avgPrice: stock.price });
        }
        user.trades.push({ type, ticker, qty, price: stock.price, total: totalCost, date: executionDate });
        res.json({ message: 'Buy successful', user });
    } else if (type === 'SELL') {
        const existing = user.portfolio.find(p => p.ticker === ticker);
        if (!existing || existing.qty < qty) return res.status(400).json({ error: 'Insufficient shares' });
        
        user.balance += totalCost;
        existing.qty -= qty;
        if (existing.qty === 0) {
            user.portfolio = user.portfolio.filter(p => p.ticker !== ticker);
        }
        user.trades.push({ type, ticker, qty, price: stock.price, total: totalCost, date: executionDate });
        res.json({ message: 'Sell successful', user });
    } else {
        res.status(400).json({ error: 'Invalid trade type' });
    }
});


// AI Routes Mock/Integration
app.post('/api/vibe-trade', async (req, res) => {
    try {
        if (!ai) return res.json({ reply: "I am Labh Sathi! Please add GROQ_API_KEY in .env to enable my AI brain. Right now, I'm just a simple bot. But I can tell you the market looks interesting today!" });
        const { prompt } = req.body;
        const response = await ai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'system', content: 'You are Labh Sathi, a helpful AI assistant for the Indian Stock Market.' }, { role: 'user', content: prompt }],
            max_tokens: 300
        });
        res.json({ reply: response.choices[0].message.content });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "AI Error: " + e.message }); 
    }
});

app.post('/api/roast', async (req, res) => {
    if (!ai) return res.json({ roastText: "Your portfolio is too boring to roast. Add GROQ_API_KEY to get the real FIRE! 🔥", riskScore: 5 });
    try {
        const response = await ai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'Roast this stock portfolio: ' + JSON.stringify(req.body.portfolio) + '. Return pure JSON format: { "roastText": "string", "riskScore": integer } without any markdown like ```json' }],
            max_tokens: 200
        });
        let content = response.choices[0].message.content.trim();
        if(content.startsWith('```json')) content = content.replace(/```json/g, '').replace(/```/g, '');
        else if(content.startsWith('```')) content = content.replace(/```/g, '');
        res.json(JSON.parse(content));
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "AI Error: " + e.message }); 
    }
});

// Serve index.html for unknown routes (SPA behavior fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
