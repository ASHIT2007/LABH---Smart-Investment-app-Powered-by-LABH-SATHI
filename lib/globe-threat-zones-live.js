/**
 * Live Threat Globe: Yahoo quotes + Groq headlines (server-side only).
 */

import { GLOBE_THREAT_ZONE_DEFS } from "../data/globe-threat-zones.js";
import { fetchYahooChartQuote, fetchYahooHeadlines, fetchHistoricalAverageMove } from "./yahoo-live.js";

/**
 * Enrich zone definitions with Yahoo quotes per ticker.
 */
async function zonesWithLiveQuotes() {
  const out = [];
  for (const z of GLOBE_THREAT_ZONE_DEFS) {
    const topStocks = [];
    for (const s of z.topStocks) {
      const q = await fetchYahooChartQuote(s.ticker);
      topStocks.push({
        ticker: s.ticker,
        name: s.name,
        price: q?.price ?? null,
        stockDrop: q?.liveChangePercent ?? null,
        currency: q?.currency ?? null,
        quoteError: q ? null : "live_quote_unavailable",
      });
    }
    out.push({
      id: z.id,
      lat: z.lat,
      lng: z.lng,
      regionLabel: z.regionLabel,
      threatName: z.threatName,
      topStocks,
    });
  }
  return out;
}

/**
 * Ask Groq to summarize ACTUAL news headlines for each zone.
 */
async function groqHeadlinesForZones(ai, zonesSnapshot) {
  const compact = zonesSnapshot.map((z) => ({
    zoneId: z.id,
    region: z.regionLabel,
    theme: z.threatName,
    actualNews: z.actualNews || [],
  }));

  const zoneIds = compact.map((z) => z.zoneId).join(", ");

  const prompt = `You are a Bloomberg-style desk editor. You have been provided with ACTUAL news headlines from Yahoo Finance for various geopolitical zones. 
Write ONE headline sentence per zone (max 28 words) that summarizes these REAL news headlines. 
DO NOT invent causes or events. If there is no real news for a zone, return an empty string for that zone.

Data (JSON):
${JSON.stringify(compact, null, 0)}

You MUST return exactly one headline for each zoneId. Zone ids in order: ${zoneIds}

Return ONLY valid JSON, no markdown, in this shape:
{"headlines":[{"zoneId":"<id>","newsHeadline":"..."}]}
with ${compact.length} objects in the headlines array, one per zone above.`;

  const response = await ai.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2800,
    temperature: 0.2, // Lower temp for summarization
    response_format: { type: "json_object" },
  });

  let text = response.choices[0]?.message?.content?.trim() || "{}";
  if (text.startsWith("\`\`\`")) {
    text = text
      .replace(/^\`\`\`json?\s*/i, "")
      .replace(/\`\`\`$/g, "")
      .trim();
  }
  const parsed = JSON.parse(text);
  const list = parsed.headlines || [];
  const map = {};
  for (const row of list) {
    if (row.zoneId && row.newsHeadline && String(row.newsHeadline).trim().length > 0) {
      map[row.zoneId] = String(row.newsHeadline).trim() + " [AI Summarized]";
    }
  }
  return map;
}

function fallbackHeadline(zone) {
  const parts = (zone.topStocks || [])
    .filter((s) => Number.isFinite(s.stockDrop))
    .slice(0, 3)
    .map(
      (s) =>
        `${s.ticker} ${s.stockDrop >= 0 ? "+" : ""}${s.stockDrop.toFixed(2)}%`,
    );
  const summary = parts.length
    ? parts.join(", ")
    : "Live quotes loading or unavailable";
  return `${zone.regionLabel}: ${summary}.`;
}

let cachedThreatZonesPayload = null;
let lastThreatZonesFetchTime = 0;
const THREAT_ZONES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * @param {import('groq-sdk').default | null} ai - Groq client or null
 */
export async function getGlobeThreatZonesPayload(ai) {
  if (cachedThreatZonesPayload && (Date.now() - lastThreatZonesFetchTime < THREAT_ZONES_CACHE_TTL)) {
    return cachedThreatZonesPayload;
  }

  const zones = await zonesWithLiveQuotes();
  let headlineById = {};
  let aiPowered = false;

  // Pre-fetch real news for all zones (used for both AI summarization and frontend drill-down)
  // Also calculate historical correlation if events exist
  for (const z of zones) {
    const first = z.topStocks?.find((s) => s.ticker);
    if (first) {
      z.actualNews = await fetchYahooHeadlines(first.ticker, 3);
    } else {
      z.actualNews = [];
    }

    // Historical correlation metric
    z.historicalCorrelation = null;
    const origZone = GLOBE_THREAT_ZONE_DEFS.find((d) => d.id === z.id);
    if (origZone && origZone.historicalEvents && origZone.historicalEvents.length > 0) {
      const tickers = z.topStocks.map((s) => s.ticker);
      // Pick the first event for simplicity or average them
      const event = origZone.historicalEvents[0];
      const move = await fetchHistoricalAverageMove(tickers, event.date);
      if (move !== null) {
        z.historicalCorrelation = {
          event: event.name,
          date: event.date,
          movePct: move
        };
      }
    }
  }

  if (ai) {
    try {
      headlineById = await groqHeadlinesForZones(ai, zones);
      aiPowered = Object.keys(headlineById).length > 0;
    } catch (e) {
      console.error("[globe-threat-zones] Groq error:", e.message);
    }
  }

  for (const z of zones) {
    let h = headlineById[z.id];
    if (!h) {
      // Fallback: If AI fails or returns empty, use the first real headline or a numeric summary
      if (z.actualNews && z.actualNews.length > 0) {
        h = z.actualNews[0];
      } else {
        h = fallbackHeadline(z);
      }
    }
    z.newsHeadline = h;
  }

  cachedThreatZonesPayload = {
    zones,
    updatedAt: new Date().toISOString(),
    aiPowered,
    quotesSource: "yahoo_finance",
  };
  lastThreatZonesFetchTime = Date.now();
  return cachedThreatZonesPayload;
}
