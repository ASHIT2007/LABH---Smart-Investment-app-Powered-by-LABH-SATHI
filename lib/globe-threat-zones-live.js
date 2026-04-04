/**
 * Live Threat Globe: Yahoo quotes + Groq headlines (server-side only).
 */

import { GLOBE_THREAT_ZONE_DEFS } from "../data/globe-threat-zones.js";
import { fetchYahooChartQuote, fetchYahooHeadlines } from "./yahoo-live.js";

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
 * Ask Groq for one headline per zone using ONLY the live numbers provided (no fabrication).
 */
async function groqHeadlinesForZones(ai, zonesSnapshot) {
  const compact = zonesSnapshot.map((z) => ({
    zoneId: z.id,
    region: z.regionLabel,
    theme: z.threatName,
    moves: z.topStocks.map((s) => ({
      ticker: s.ticker,
      pct: s.stockDrop,
      px: s.price,
    })),
  }));

  const zoneIds = compact.map((z) => z.zoneId).join(", ");

  const prompt = `You are a Bloomberg-style desk editor. Given TODAY's live session data (percent vs prior close) for each geopolitical zone, write ONE headline sentence per zone (max 28 words) that ties the regional theme to the direction of the moves. Do not invent prices or percentages — only reflect the numbers given. If a ticker has null pct, omit it from the sentence.

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
    temperature: 0.35,
    response_format: { type: "json_object" },
  });

  let text = response.choices[0]?.message?.content?.trim() || "{}";
  if (text.startsWith("```")) {
    text = text
      .replace(/^```json?\s*/i, "")
      .replace(/```$/g, "")
      .trim();
  }
  const parsed = JSON.parse(text);
  const list = parsed.headlines || [];
  const map = {};
  for (const row of list) {
    if (row.zoneId && row.newsHeadline)
      map[row.zoneId] = String(row.newsHeadline).trim();
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

async function fallbackHeadlineFromRss(zone) {
  const first = zone.topStocks?.find((s) => s.ticker);
  if (!first) return fallbackHeadline(zone);
  const headlines = await fetchYahooHeadlines(first.ticker, 2);
  if (headlines.length) return headlines[0];
  return fallbackHeadline(zone);
}

/**
 * @param {import('groq-sdk').default | null} ai - Groq client or null
 */
export async function getGlobeThreatZonesPayload(ai) {
  const zones = await zonesWithLiveQuotes();
  let headlineById = {};
  let aiPowered = false;

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
      h = await fallbackHeadlineFromRss(z);
    }
    z.newsHeadline = h;
  }

  return {
    zones,
    updatedAt: new Date().toISOString(),
    aiPowered,
    quotesSource: "yahoo_finance",
  };
}
