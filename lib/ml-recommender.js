/**
 * ─── LABH ML RECOMMENDATION ENGINE ───
 * Multi-factor quantitative scoring + AI narrative generation.
 *
 * Each stock is scored across 5 dimensions:
 *   1. Momentum (25%) — price trend strength
 *   2. Value    (20%) — fundamental valuation
 *   3. Volatility (15%) — price stability
 *   4. Volume   (15%) — liquidity & institutional interest
 *   5. User Fit (25%) — personalized to the trader's history
 *
 * The composite LABH Score (0-100) drives the final ranking.
 */

import { analyzeTradingStyle } from "./user-analytics.js";

// ── Sector Classification Map ─────────────────────────────────────
const SECTOR_MAP = {
  // Indian
  HDFCBANK: "Banking",
  ICICIBANK: "Banking",
  SBIN: "Banking",
  BAJFINANCE: "Finance",
  INFY: "IT",
  TCS: "IT",
  WIPRO: "IT",
  RELIANCE: "Conglomerate",
  TATAMOTORS: "Automobile",
  MARUTI: "Automobile",
  ZOMATO: "Internet",
  ITC: "FMCG",
  HINDUNILVR: "FMCG",
  BHARTIARTL: "Telecom",
  LT: "Infrastructure",
  SUNPHARMA: "Pharma",
  PAYTM: "Fintech",
  POLICYBZR: "Fintech",
  ASIANPAINT: "Consumer",
  TITAN: "Consumer",
  // International
  AAPL: "Tech",
  MSFT: "Tech",
  GOOGL: "Tech",
  META: "Tech",
  AMZN: "E-Commerce",
  NVDA: "Semiconductor",
  AMD: "Semiconductor",
  INTC: "Semiconductor",
  TSM: "Semiconductor",
  PLTR: "AI/Data",
  AI: "AI/Data",
  TSLA: "EV/Auto",
  F: "Automobile",
  TM: "Automobile",
  JPM: "Banking",
  GS: "Banking",
  V: "Payments",
  LMT: "Defense",
  CRWD: "Cybersecurity",
  PANW: "Cybersecurity",
  JNJ: "Pharma",
  PFE: "Pharma",
  UNH: "Healthcare",
  PG: "FMCG",
  KO: "FMCG",
  WMT: "Retail",
  NKE: "Consumer",
  NFLX: "Entertainment",
  DIS: "Entertainment",
};

// Sector average P/E ratios (approximate, for relative comparison)
const SECTOR_AVG_PE = {
  Banking: 14,
  Finance: 25,
  IT: 28,
  Conglomerate: 25,
  Automobile: 18,
  Internet: 80,
  FMCG: 40,
  Telecom: 30,
  Infrastructure: 30,
  Pharma: 35,
  Fintech: 60,
  Consumer: 45,
  Tech: 30,
  "E-Commerce": 50,
  Semiconductor: 35,
  "AI/Data": 100,
  "EV/Auto": 55,
  Payments: 28,
  Defense: 18,
  Cybersecurity: 60,
  Healthcare: 20,
  Retail: 25,
  Entertainment: 50,
};

// ── 1. Momentum Score (0-100) ──────────────────────────────────────
function calculateMomentumScore(stock) {
  let score = 50; // neutral baseline

  // Factor A: Position within 52-week range (0-100)
  if (stock.week52High && stock.week52Low && stock.week52High > stock.week52Low) {
    const range = stock.week52High - stock.week52Low;
    const position = (stock.price - stock.week52Low) / range;
    // Sweet spot: 40-75% of range (not at bottom, not overextended)
    if (position >= 0.4 && position <= 0.75) {
      score += 25;
    } else if (position >= 0.2 && position < 0.4) {
      score += 15; // recovering — potential
    } else if (position > 0.75 && position <= 0.9) {
      score += 10; // strong but extended
    } else if (position > 0.9) {
      score -= 5; // near all-time-high, risky
    } else {
      score += 5; // near bottom, contrarian
    }
  }

  // Factor B: Recent daily change
  const change = stock.change || 0;
  if (change >= 2) score += 20;
  else if (change >= 1) score += 15;
  else if (change >= 0.3) score += 10;
  else if (change >= 0) score += 5;
  else if (change >= -1) score -= 5;
  else if (change >= -2) score -= 10;
  else score -= 15;

  return clamp(score, 0, 100);
}

// ── 2. Value Score (0-100) ─────────────────────────────────────────
function calculateValueScore(stock) {
  const pe = stock.peRatio;
  const sector = SECTOR_MAP[stock.sym] || "Conglomerate";
  const avgPE = SECTOR_AVG_PE[sector] || 25;

  // Negative P/E means unprofitable → low value score
  if (!pe || pe < 0) return 20;

  // Ratio of stock P/E to sector average
  const ratio = pe / avgPE;

  if (ratio <= 0.5) return 95; // deeply undervalued
  if (ratio <= 0.7) return 85;
  if (ratio <= 0.9) return 75;
  if (ratio <= 1.1) return 60; // fairly valued
  if (ratio <= 1.3) return 45;
  if (ratio <= 1.8) return 30;
  if (ratio <= 2.5) return 20;
  return 10; // extremely overvalued
}

// ── 3. Volatility Score (0-100, higher = MORE stable) ──────────────
function calculateVolatilityScore(stock) {
  let score = 50;

  if (stock.week52High && stock.week52Low && stock.price > 0) {
    const range = stock.week52High - stock.week52Low;
    const rangePct = (range / stock.price) * 100;

    // Lower range% = more stable = higher score
    if (rangePct <= 15) score = 90;
    else if (rangePct <= 25) score = 80;
    else if (rangePct <= 35) score = 70;
    else if (rangePct <= 50) score = 55;
    else if (rangePct <= 75) score = 35;
    else if (rangePct <= 100) score = 20;
    else score = 10;
  }

  // Daily change amplitude penalty
  const absChange = Math.abs(stock.change || 0);
  if (absChange > 4) score -= 15;
  else if (absChange > 3) score -= 10;
  else if (absChange > 2) score -= 5;

  return clamp(score, 0, 100);
}

// ── 4. Volume Score (0-100) ────────────────────────────────────────
function calculateVolumeScore(stock) {
  // Parse volume string like "18.5M", "3.2M", "65K"
  const volStr = stock.volume || "0";
  let volNum = 0;
  if (volStr.endsWith("M")) volNum = parseFloat(volStr) * 1e6;
  else if (volStr.endsWith("K")) volNum = parseFloat(volStr) * 1e3;
  else volNum = parseFloat(volStr) || 0;

  // Higher volume = more liquid = better
  if (volNum >= 50e6) return 95;
  if (volNum >= 20e6) return 85;
  if (volNum >= 10e6) return 75;
  if (volNum >= 5e6) return 65;
  if (volNum >= 2e6) return 55;
  if (volNum >= 1e6) return 45;
  if (volNum >= 500e3) return 35;
  return 20;
}

// ── 5. User Fit Score (0-100, personalized) ────────────────────────
function calculateUserFitScore(stock, user, allStocks) {
  if (!user || !user.trades || user.trades.length === 0) {
    // New user: favor stable, well-known, diversified picks
    return calculateNewUserFitScore(stock);
  }

  let score = 50;
  const sector = SECTOR_MAP[stock.sym] || "Other";
  const trades = user.trades || [];
  const portfolio = user.portfolio || [];

  // ── A. Sector Preference Analysis ──
  // Count how often the user trades in each sector
  const sectorFrequency = {};
  trades.forEach((t) => {
    const s = SECTOR_MAP[t.ticker] || "Other";
    sectorFrequency[s] = (sectorFrequency[s] || 0) + 1;
  });
  const totalTrades = trades.length;
  const sectorPref = (sectorFrequency[sector] || 0) / totalTrades;

  // ── B. Recent Activity Boost (Recency Weighting) ──
  // Check the last 3 trades to see if the user is moving into new sectors
  const recentTrades = trades.slice(-3);
  const isRecentSector = recentTrades.some(t => (SECTOR_MAP[t.ticker] || "Other") === sector);
  if (isRecentSector) {
    score += 15; // Focus on sectors the user is currently interested in
  }

  // Sector familiar boost
  if (sectorPref >= 0.3) score += 10; 
  else if (sectorPref >= 0.1) score += 5; 
  else score += 10; // diversification bonus

  // ── B. Portfolio Diversification ──
  const holdingSectors = new Set(
    portfolio.map((p) => SECTOR_MAP[p.ticker] || "Other")
  );
  const alreadyHoldsSector = holdingSectors.has(sector);

  if (!alreadyHoldsSector) {
    score += 15; // diversification bonus
  } else {
    // Check concentration — if >40% of portfolio in this sector, penalize
    const sectorHoldings = portfolio.filter(
      (p) => (SECTOR_MAP[p.ticker] || "Other") === sector
    );
    const sectorValue = sectorHoldings.reduce((sum, p) => {
      const s = allStocks[p.ticker];
      return sum + (s ? s.price * p.qty : 0);
    }, 0);
    const totalValue = portfolio.reduce((sum, p) => {
      const s = allStocks[p.ticker];
      return sum + (s ? s.price * p.qty : 0);
    }, 0);

    if (totalValue > 0) {
      const concentration = sectorValue / totalValue;
      if (concentration > 0.5) score -= 15; // too concentrated
      else if (concentration > 0.3) score -= 5;
      else score += 5;
    }
  }

  // ── C. Win Rate in Similar Stocks ──
  const sectorTrades = trades.filter(
    (t) => (SECTOR_MAP[t.ticker] || "Other") === sector
  );
  if (sectorTrades.length >= 2) {
    // Approximate win: sell price > buy price for same ticker
    const tickerPnL = {};
    sectorTrades.forEach((t) => {
      if (!tickerPnL[t.ticker]) tickerPnL[t.ticker] = { buyCost: 0, sellRev: 0 };
      if (t.type === "BUY") tickerPnL[t.ticker].buyCost += t.total;
      else tickerPnL[t.ticker].sellRev += t.total;
    });

    let wins = 0,
      total = 0;
    Object.values(tickerPnL).forEach((pnl) => {
      if (pnl.sellRev > 0 && pnl.buyCost > 0) {
        total++;
        if (pnl.sellRev >= pnl.buyCost) wins++;
      }
    });

    if (total > 0) {
      const winRate = wins / total;
      if (winRate >= 0.6) score += 10; // good track record
      else if (winRate < 0.3) score -= 5; // struggled here
    }
  }

  // ── D. Risk Level Adjustment ──
  const level = (user.level || "Beginner").toLowerCase();
  const volatilityScore = calculateVolatilityScore(stock);

  if (level === "beginner") {
    // Favor stable stocks
    if (volatilityScore >= 70) score += 10;
    else if (volatilityScore < 40) score -= 10;
  } else if (level === "expert") {
    // Experts can handle volatility, favor momentum
    const momentumScore = calculateMomentumScore(stock);
    if (momentumScore >= 70) score += 10;
  }

  // ── E. Already owned penalty ──
  if (portfolio.find((p) => p.ticker === stock.sym)) {
    score -= 10; // slight penalty — recommend new opportunities
  }

  return clamp(score, 0, 100);
}

// For brand new users with no trade history
function calculateNewUserFitScore(stock) {
  let score = 50;
  const pe = stock.peRatio || 0;
  const absChange = Math.abs(stock.change || 0);

  // Favor blue-chips: positive P/E, moderate valuation
  if (pe > 0 && pe < 35) score += 20;
  else if (pe >= 35 && pe < 60) score += 10;

  // Favor stability
  if (absChange < 1.5) score += 10;

  // Favor well-known names
  const blueChips = [
    "HDFCBANK", "TCS", "INFY", "RELIANCE", "ICICIBANK",
    "AAPL", "MSFT", "GOOGL", "AMZN", "JPM",
  ];
  if (blueChips.includes(stock.sym)) score += 15;

  return clamp(score, 0, 100);
}

// ── Composite Score & Ranking ──────────────────────────────────────
const WEIGHTS = {
  momentum: 0.25,
  value: 0.2,
  volatility: 0.15,
  volume: 0.15,
  userFit: 0.25,
};

function scoreStock(stock, user, allStocks) {
  const factors = {
    momentum: calculateMomentumScore(stock),
    value: calculateValueScore(stock),
    volatility: calculateVolatilityScore(stock),
    volume: calculateVolumeScore(stock),
    userFit: calculateUserFitScore(stock, user, allStocks),
  };

  const composite = Math.round(
    factors.momentum * WEIGHTS.momentum +
      factors.value * WEIGHTS.value +
      factors.volatility * WEIGHTS.volatility +
      factors.volume * WEIGHTS.volume +
      factors.userFit * WEIGHTS.userFit
  );

  return { ...factors, composite: clamp(composite, 0, 100) };
}

// ── Categorization ─────────────────────────────────────────────────
function categorize(scored) {
  // Sort by composite descending
  const sorted = [...scored].sort((a, b) => b.scores.composite - a.scores.composite);

  const topPicks = sorted.slice(0, 3);

  const valuePicks = [...scored]
    .sort((a, b) => b.scores.value - a.scores.value)
    .filter((s) => !topPicks.find((t) => t.sym === s.sym))
    .slice(0, 2);

  const momentumPicks = [...scored]
    .sort((a, b) => b.scores.momentum - a.scores.momentum)
    .filter(
      (s) =>
        !topPicks.find((t) => t.sym === s.sym) &&
        !valuePicks.find((t) => t.sym === s.sym)
    )
    .slice(0, 2);

  const diversificationPicks = [...scored]
    .sort((a, b) => b.scores.userFit - a.scores.userFit)
    .filter(
      (s) =>
        !topPicks.find((t) => t.sym === s.sym) &&
        !valuePicks.find((t) => t.sym === s.sym) &&
        !momentumPicks.find((t) => t.sym === s.sym)
    )
    .slice(0, 2);

  return {
    topPicks,
    valuePicks,
    momentumPicks,
    diversificationPicks,
  };
}

// ── AI Narrative Generation ────────────────────────────────────────
async function generateNarratives(categories, ai, userProfile) {
  const allPicks = [
    ...categories.topPicks,
    ...categories.valuePicks,
    ...categories.momentumPicks,
    ...categories.diversificationPicks,
  ];

  if (!ai) {
    allPicks.forEach((pick) => {
      pick.reasoning = generateTemplateFallback(pick);
    });
    return;
  }

  // Build profile context for the AI
  const profileContext = `User Profile: Style=${userProfile.tradingStyle}, Risk=${userProfile.riskProfile}, Bias=${userProfile.sectorBias}, Trades=${userProfile.tradeCount}.`;

  // Build prompt for batch AI reasoning
  const pickSummaries = allPicks
    .map(
      (p, i) =>
        `${i + 1}. ${p.sym} (${p.name}): Sector=${p.sector}, Price=₹${p.price}, Change=${p.change}%, LABH Score=${p.scores.composite}/100 (Momentum=${p.scores.momentum}, Value=${p.scores.value}, UserFit=${p.scores.userFit})`
    )
    .join("\n");

  try {
    const response = await ai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            `You are a professional stock analyst for LABH. ${profileContext} Generate concise, data-driven reasoning for each stock pick. Explicitly mention how it fits the user's trading style or recent sector interests. No disclaimers. Pure, sharp analysis.`,
        },
        {
          role: "user",
          content: `Analyze these stock picks for this specific user. Return ONLY a JSON array of strings, one per stock, in the same order.\n\n${pickSummaries}`,
        },
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    let content = response.choices[0].message.content.trim();
    if (content.startsWith("```json"))
      content = content.replace(/```json/g, "").replace(/```/g, "");
    else if (content.startsWith("```")) content = content.replace(/```/g, "");

    const reasons = JSON.parse(content);
    allPicks.forEach((pick, i) => {
      pick.reasoning = reasons[i] || generateTemplateFallback(pick);
    });
  } catch (e) {
    console.error("[ML-Recommender] AI narrative error:", e.message);
    allPicks.forEach((pick) => {
      pick.reasoning = generateTemplateFallback(pick);
    });
  }
}

function generateTemplateFallback(pick) {
  const sector = SECTOR_MAP[pick.sym] || "market";
  const s = pick.scores;

  if (s.composite >= 75) {
    return `Strong buy signal — ${pick.sym} shows exceptional momentum (${s.momentum}/100) combined with solid fundamentals in the ${sector} sector. LABH Score: ${s.composite}.`;
  } else if (s.composite >= 60) {
    return `${pick.sym} offers a balanced risk-reward profile with a value score of ${s.value}/100 and steady institutional volume. Well-suited for medium-term growth.`;
  } else {
    return `${pick.sym} in ${sector} presents a diversification opportunity. Current valuation and market position suggest potential for portfolio balance.`;
  }
}

// ── User Profile Analysis ──────────────────────────────────────────
function analyzeUserProfile(user, allStocks) {
  if (!user) return { riskProfile: "Unknown", tradingStyle: "New Trader", sectorBias: "None", tradeCount: 0 };

  const trades = user.trades || [];
  const portfolio = user.portfolio || [];
  const tradeCount = trades.length;

  // Risk Profile
  let riskProfile = "Conservative";
  if (tradeCount > 20) riskProfile = "Aggressive";
  else if (tradeCount > 8) riskProfile = "Moderate";

  // Check portfolio volatility
  const avgVolatility =
    portfolio.length > 0
      ? portfolio.reduce((sum, p) => {
          const s = allStocks[p.ticker];
          return sum + (s ? calculateVolatilityScore(s) : 50);
        }, 0) / portfolio.length
      : 50;

  if (avgVolatility < 40) riskProfile = "Aggressive";
  else if (avgVolatility > 70) riskProfile = "Conservative";

  // Trading Style (Behavioral ML Clustering)
  let tradingStyle = analyzeTradingStyle(trades);

  // Sector Bias
  const sectorCounts = {};
  trades.forEach((t) => {
    const s = SECTOR_MAP[t.ticker] || "Other";
    sectorCounts[s] = (sectorCounts[s] || 0) + 1;
  });
  const topSector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0];
  const sectorBias = topSector ? topSector[0] : "None";

  // Portfolio stats
  const holdingsCount = portfolio.length;
  const sectorsHeld = new Set(portfolio.map((p) => SECTOR_MAP[p.ticker] || "Other")).size;

  return {
    riskProfile,
    tradingStyle,
    sectorBias,
    tradeCount,
    holdingsCount,
    sectorsHeld,
    level: user.level || "Beginner",
  };
}

// ── Main Entry Point ───────────────────────────────────────────────
export async function generateRecommendations(stocksData, user, ai) {
  const allStocks = stocksData; // key-value object
  const stockList = Object.values(allStocks).filter(
    (s) => s.price > 0 // only stocks with live prices
  );

  // Score every stock
  const scored = stockList.map((stock) => ({
    ...stock,
    sector: SECTOR_MAP[stock.sym] || "Other",
    scores: scoreStock(stock, user, allStocks),
  }));

  // Categorize
  const categories = categorize(scored);

  // Analyze user profile
  const userProfile = analyzeUserProfile(user, allStocks);

  // Generate AI narratives
  await generateNarratives(categories, ai, userProfile);

  return {
    categories,
    userProfile,
    generatedAt: new Date().toISOString(),
    totalStocksAnalyzed: stockList.length,
    aiPowered: !!ai,
  };
}

// ── Utility ────────────────────────────────────────────────────────
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
