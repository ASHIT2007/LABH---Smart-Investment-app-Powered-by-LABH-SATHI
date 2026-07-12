/**
 * user-analytics.js
 * Behavioral ML & Trading Coach Engine
 * Provides heuristics for style clustering and cognitive bias detection.
 */

/**
 * Clustering algorithm to determine a user's Trading Persona.
 * @param {Array} trades - Array of historical trades.
 * @returns {String} Persona label
 */
export function analyzeTradingStyle(trades) {
  if (!trades || trades.length < 3) return "New Investor";

  let totalHoldTimeHours = 0;
  let buyCount = 0;
  let sellCount = 0;
  let totalTrades = trades.length;

  // Since we only have sequential logs, we approximate hold time 
  // by looking at the time difference between buys and sells of the same stock.
  const activePositions = {};
  let closedPositionsCount = 0;

  trades.forEach((t) => {
    if (t.type === "BUY") {
      buyCount++;
      if (!activePositions[t.ticker]) activePositions[t.ticker] = [];
      activePositions[t.ticker].push(new Date(t.date).getTime());
    } else if (t.type === "SELL") {
      sellCount++;
      if (activePositions[t.ticker] && activePositions[t.ticker].length > 0) {
        const buyTime = activePositions[t.ticker].shift(); // FIFO
        const sellTime = new Date(t.date).getTime();
        totalHoldTimeHours += (sellTime - buyTime) / (1000 * 60 * 60);
        closedPositionsCount++;
      }
    }
  });

  const avgHoldTime = closedPositionsCount > 0 ? totalHoldTimeHours / closedPositionsCount : 0;
  const turnoverRate = sellCount / (buyCount || 1);

  // Clustering Logic (Heuristics)
  if (closedPositionsCount === 0) {
    return buyCount > 5 ? "Accumulator" : "Cautious Starter";
  }

  if (avgHoldTime < 24) {
    return turnoverRate > 0.8 ? "Aggressive Day Trader" : "Swing Trader";
  } else if (avgHoldTime >= 24 && avgHoldTime < 168) { // 1 week
    return "Momentum Trader";
  } else {
    return turnoverRate < 0.3 ? "Value Investor" : "Position Trader";
  }
}

/**
 * Detects 'Panic Selling' cognitive bias.
 * Triggered when a user sells a stock they bought recently at a loss.
 * @param {Array} trades - User's trade history
 * @param {String} sym - Ticker symbol being sold
 * @param {Number} sellPrice - The price the stock is being sold at
 * @param {Number} currentPrice - The current market price of the stock
 * @returns {Object|null} - Bias details if detected, else null
 */
export function detectCognitiveBias(trades, sym, sellPrice, currentPrice) {
  if (!trades || trades.length === 0) return null;

  // Find the most recent BUY for this symbol
  const recentBuy = [...trades].reverse().find(t => t.type === "BUY" && t.ticker === sym);
  
  if (!recentBuy) return null;

  const buyTime = new Date(recentBuy.date).getTime();
  const now = Date.now();
  const holdTimeHours = (now - buyTime) / (1000 * 60 * 60);
  
  const priceDropPct = ((recentBuy.price - sellPrice) / recentBuy.price) * 100;

  // Bias Criteria: Held for less than 48 hours AND sold at a >2% loss
  if (holdTimeHours < 48 && priceDropPct >= 2.0) {
    return {
      type: "PANIC_SELL",
      description: "Loss Aversion / Panic Sell",
      holdTimeHours: holdTimeHours.toFixed(1),
      dropPct: priceDropPct.toFixed(2),
      buyPrice: recentBuy.price,
      sellPrice: sellPrice,
      sym: sym
    };
  }

  return null;
}

/**
 * Detects 'Revenge Trading' pattern.
 * Triggered when a user has 3+ consecutive losing trades and immediately
 * tries to buy again (especially a volatile stock).
 * @param {Array} trades - User's trade history
 * @param {Object} stockData - The stock being purchased (from STOCKS_DATA)
 * @returns {Object|null} - Bias details if detected, else null
 */
export function detectRevengeTrade(trades, stockData) {
  if (!trades || trades.length < 3) return null;

  // Look at the last 6 trades to find consecutive losses
  const recentTrades = trades.slice(-6);
  
  // Find consecutive losing SELL trades at the end
  let consecutiveLosses = 0;
  let totalLossPct = 0;
  
  // Walk backwards through trades to count consecutive losing sells
  for (let i = recentTrades.length - 1; i >= 0; i--) {
    const t = recentTrades[i];
    if (t.type !== "SELL") continue;
    
    // Find the matching BUY for this sell
    const matchingBuy = trades.find(
      b => b.type === "BUY" && b.ticker === t.ticker && new Date(b.date) < new Date(t.date)
    );
    
    if (matchingBuy && t.price < matchingBuy.price) {
      consecutiveLosses++;
      const lossPct = ((matchingBuy.price - t.price) / matchingBuy.price) * 100;
      totalLossPct += lossPct;
    } else {
      break; // Streak broken
    }
  }

  if (consecutiveLosses < 2) return null;

  // Check if the most recent loss was within last 2 hours (emotional window)
  const lastTrade = trades[trades.length - 1];
  const timeSinceLastTrade = (Date.now() - new Date(lastTrade.date).getTime()) / (1000 * 60 * 60);
  
  if (timeSinceLastTrade > 4) return null; // Cool-off period passed

  // Check volatility of the stock they want to buy
  const absChange = Math.abs(stockData?.change || 0);
  const isVolatile = absChange > 1.5;

  if (consecutiveLosses >= 3 || (consecutiveLosses >= 2 && isVolatile)) {
    return {
      type: "REVENGE_TRADE",
      description: "Revenge Trading Pattern",
      consecutiveLosses,
      avgLossPct: (totalLossPct / consecutiveLosses).toFixed(2),
      timeSinceLastLoss: timeSinceLastTrade.toFixed(1),
      targetStock: stockData?.sym || "Unknown",
      targetVolatility: absChange.toFixed(2)
    };
  }

  return null;
}
