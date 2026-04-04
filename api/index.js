import "dotenv/config";
import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import { users, interlocks, STOCKS_DATA } from "../data/store.js";
import { getCountryImpactPayload } from "../data/country-impact.js";
import { enrichCountryImpactWithLiveData } from "../lib/yahoo-live.js";
import { getGlobeThreatZonesPayload } from "../lib/globe-threat-zones-live.js";
import { getGlobalMarketPulsePayload } from "../lib/global-market-pulse-live.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../frontend")));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ai = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

app.post("/api/auth/register", (req, res) => {
  const { name, email, password, level = "Beginner" } = req.body;
  if (users.find((u) => u.email === email))
    return res.status(400).json({ error: "Email exists" });
  const user = {
    id: Date.now().toString(),
    name,
    email,
    password,
    balance: 100000,
    portfolio: [],
    trades: [],
    level,
  };
  users.push(user);
  res.json({ user });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ user });
});

app.get("/api/auth/me", (req, res) => {
  const user = users.find((u) => u.email === req.query.email);
  user ? res.json({ user }) : res.status(404).json({ error: "Not found" });
});

// Markets Route
app.get("/api/markets", (req, res) => {
  res.json(Object.values(STOCKS_DATA));
});

// --- NEWS & SENTIMENT (Lazy load if on Serverless) ---
let newsCache = [];
let newsCacheTime = 0;

async function fetchStockNews() {
  try {
    const rssUrl =
      "https://news.google.com/rss/search?q=NSE+BSE+stock+market+India+shares&hl=en-IN&gl=IN&ceid=IN:en";
    const response = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!response.ok) return;
    const xml = await response.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
      const block = match[1];
      const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
      const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
      const source =
        (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || "";
      items.push({
        title: title.replace(/<!\[CDATA\[|\]\]>/g, ""),
        link,
        source,
      });
    }
    newsCache = items;
    newsCacheTime = Date.now();
  } catch (e) {
    console.error("News fetch error");
  }
}

app.get("/api/news", async (req, res) => {
  if (newsCache.length === 0 || Date.now() - newsCacheTime > 600000) {
    await fetchStockNews();
  }
  res.json(newsCache);
});

app.get("/api/sentiment", async (req, res) => {
  if (newsCache.length === 0) await fetchStockNews();

  // Simple Rule-based fallback if AI is down or slow
  if (!ai) {
    return res.json({
      overallMood: "neutral",
      moodScore: 50,
      aiPowered: false,
    });
  }

  try {
    const headlines = newsCache.map((n) => n.title).join("\n");
    const response = await ai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content:
            'Return JSON: { "overallMood": "bullish"|"bearish", "moodScore": 0-100 }',
        },
        { role: "user", content: headlines },
      ],
      max_tokens: 150,
      response_format: { type: "json_object" },
    });
    res.json(JSON.parse(response.choices[0].message.content));
  } catch (e) {
    res.json({ overallMood: "neutral", moodScore: 50 });
  }
});

// AI Chat
app.post("/api/vibe-trade", async (req, res) => {
  if (!ai) return res.json({ reply: "Add GROQ_API_KEY to activate AI." });
  try {
    const response = await ai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are Labh Sathi." },
        { role: "user", content: req.body.prompt },
      ],
      max_tokens: 250,
    });
    res.json({ reply: response.choices[0].message.content });
  } catch (e) {
    res.status(500).json({ error: "AI Error" });
  }
});

// Trading Logic
app.post("/api/trade", (req, res) => {
  // Basic trade implementation (Same as original but condensed for Vercel)
  const { userId, type, ticker, quantity } = req.body;
  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ message: "Trade triggered", user }); // Demo response
});

app.get("/api/globe-threat-zones", async (req, res) => {
  try {
    const payload = await getGlobeThreatZonesPayload(ai);
    res.json(payload);
  } catch (e) {
    console.error("[globe-threat-zones]", e);
    res.status(500).json({ error: "Failed to load globe threat zones" });
  }
});

app.get("/api/global-market-pulse", async (req, res) => {
  try {
    const payload = await getGlobalMarketPulsePayload();
    res.json(payload);
  } catch (e) {
    console.error("[global-market-pulse]", e);
    res.status(500).json({ error: "Failed to load global market pulse" });
  }
});

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
    res.status(500).json({ error: "Failed to load live market data" });
  }
});

// Client-side routing fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "index.html"));
});

// EXPORT FOR VERCEL
export default app;

// LISTEN ONLY LOCALLY
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`Server running locally`));
}
