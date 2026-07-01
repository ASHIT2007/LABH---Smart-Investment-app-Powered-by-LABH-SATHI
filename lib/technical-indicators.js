const SECTOR_MAP = {
  Technology: ["INFY", "TCS", "WIPRO", "HCLTECH", "TECHM", "AAPL", "MSFT", "GOOGL", "NVDA", "AI", "CRWD", "PANW", "AMD", "INTC", "TSM"],
  Banking: ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "JPM", "GS"],
  Automotive: ["TATAMOTORS", "M&M", "MARUTI", "BAJAJ-AUTO", "TSLA", "F", "TM"],
  Energy: ["RELIANCE", "ONGC", "POWERGRID", "NTPC"],
  FMCG: ["ITC", "HUL", "NESTLEIND", "BRITANNIA", "PG", "KO", "WMT"],
  Pharma: ["SUNPHARMA", "CIPLA", "DRREDDY", "DIVISLAB", "JNJ", "PFE", "UNH"],
  Metals: ["TATASTEEL", "HINDALCO", "JSWSTEEL"],
  Telecom: ["BHARTIARTL", "IDEA"],
  Infrastructure: ["LT", "ADANIPORTS", "GMRINFRA"],
  Consumer: ["TITAN", "ASIANPAINT", "PIDILITIND", "NKE", "NFLX", "DIS"],
};

export function getSector(ticker) {
  for (const [sector, tickers] of Object.entries(SECTOR_MAP)) {
    if (tickers.includes(ticker)) return sector;
  }
  return "Other";
}

// Helper: Simple Moving Average
function calcSMA(data, period) {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Helper: Exponential Moving Average
function calcEMA(data, period, previousEMA = null) {
  if (data.length < period) return null;
  const k = 2 / (period + 1);
  if (previousEMA === null) {
    // Start with SMA
    const initialSlice = data.slice(0, period);
    let ema = initialSlice.reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * k + ema;
    }
    return ema;
  } else {
    const current = data[data.length - 1];
    return (current - previousEMA) * k + previousEMA;
  }
}

// Return array of EMAs
function calcEMAArray(data, period) {
  if (data.length < period) return [];
  const emas = [];
  const initialSlice = data.slice(0, period);
  let ema = initialSlice.reduce((a, b) => a + b, 0) / period;
  // emas[period-1] = ema
  for (let i = 0; i < period - 1; i++) emas.push(null);
  emas.push(ema);
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * (2 / (period + 1)) + ema;
    emas.push(ema);
  }
  return emas;
}

export function computeIndicators(ohlcv) {
  const { closes, highs, lows, volumes } = ohlcv;
  const n = closes.length;

  if (n < 2) return null;

  // 1. SMA
  const sma5 = calcSMA(closes, 5);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const sma100 = calcSMA(closes, 100);
  const sma200 = calcSMA(closes, 200);

  // 2. RSI (14-period)
  let rsi14 = null;
  if (n > 14) {
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= 14; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / 14;
    let avgLoss = losses / 14;

    for (let i = 15; i < n; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) {
        avgGain = (avgGain * 13 + diff) / 14;
        avgLoss = (avgLoss * 13) / 14;
      } else {
        avgGain = (avgGain * 13) / 14;
        avgLoss = (avgLoss * 13 - diff) / 14;
      }
    }
    
    if (avgLoss === 0) {
      rsi14 = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi14 = 100 - (100 / (1 + rs));
    }
  }

  // 3. MACD (12, 26, 9)
  let macd = null;
  if (n >= 35) {
    const ema12Arr = calcEMAArray(closes, 12);
    const ema26Arr = calcEMAArray(closes, 26);
    
    const macdLines = [];
    for (let i = 0; i < n; i++) {
      if (ema12Arr[i] !== null && ema26Arr[i] !== null) {
        macdLines.push(ema12Arr[i] - ema26Arr[i]);
      }
    }
    
    if (macdLines.length >= 9) {
      const macdLine = macdLines[macdLines.length - 1];
      const signalLine = calcEMA(macdLines, 9);
      if (signalLine !== null) {
        macd = {
          line: macdLine,
          signal: signalLine,
          histogram: macdLine - signalLine
        };
      }
    }
  }

  // 4. Bollinger Bands (20, 2)
  let bollingerBands = null;
  if (n >= 20) {
    const middle = sma20;
    const slice = closes.slice(-20);
    const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / 20;
    const stdDev = Math.sqrt(variance);
    const upper = middle + 2 * stdDev;
    const lower = middle - 2 * stdDev;
    bollingerBands = {
      upper,
      middle,
      lower,
      bandwidth: middle ? ((upper - lower) / middle) * 100 : 0
    };
  }

  // 5. VWAP (simplified for daily data - last bar TP)
  const lastHigh = highs[n - 1];
  const lastLow = lows[n - 1];
  const lastClose = closes[n - 1];
  const vwap = (lastHigh + lastLow + lastClose) / 3;

  // 6. Support/Resistance (last 20 sessions)
  let support = null;
  let resistance = null;
  if (n >= 20) {
    const recentLows = lows.slice(-20);
    const recentHighs = highs.slice(-20);
    support = Math.min(...recentLows);
    resistance = Math.max(...recentHighs);
  }

  // 7. Volatility (30 days)
  let volatility = null;
  if (n >= 31) {
    const returns = [];
    for (let i = n - 30; i < n; i++) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }
    const mean = returns.reduce((a, b) => a + b, 0) / 30;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 30;
    const daily = Math.sqrt(variance);
    volatility = {
      daily: daily * 100,
      annualized: daily * Math.sqrt(252) * 100
    };
  }

  // 8. Max Drawdown
  let maxDrawdown = 0;
  let peak = closes[0];
  for (let i = 1; i < n; i++) {
    if (closes[i] > peak) {
      peak = closes[i];
    }
    const dd = (peak - closes[i]) / peak;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }
  }
  maxDrawdown = -maxDrawdown * 100;

  // 9. SMA Crossovers (50 & 200 over last 10 sessions)
  const smaCrossovers = { goldenCross: false, deathCross: false };
  if (n >= 200 + 10) {
    let wasBelow = null;
    let wasAbove = null;
    let isCurrentlyAbove = null;
    
    // Check the last 10 days
    for (let i = 10; i >= 0; i--) {
      const slice50 = closes.slice(n - 50 - i, n - i);
      const slice200 = closes.slice(n - 200 - i, n - i);
      const s50 = slice50.reduce((a, b) => a + b, 0) / 50;
      const s200 = slice200.reduce((a, b) => a + b, 0) / 200;
      
      if (i > 0) {
        if (s50 < s200) wasBelow = true;
        if (s50 > s200) wasAbove = true;
      } else {
        isCurrentlyAbove = (s50 > s200);
      }
    }
    
    if (wasBelow && isCurrentlyAbove) smaCrossovers.goldenCross = true;
    if (wasAbove && !isCurrentlyAbove) smaCrossovers.deathCross = true;
  }

  return {
    sma: { sma5, sma20, sma50, sma100, sma200 },
    rsi14,
    macd,
    bollingerBands,
    vwap,
    support,
    resistance,
    volatility,
    maxDrawdown,
    smaCrossovers
  };
}

export function formatIndicatorsForPrompt(symbol, indicators) {
  if (!indicators) return `COMPUTED TECHNICAL INDICATORS FOR ${symbol}: None calculated.`;

  const { sma, rsi14, macd, bollingerBands, vwap, support, resistance, volatility, maxDrawdown, smaCrossovers } = indicators;

  const fmt = (val) => val === null ? 'N/A' : `₹${val.toFixed(2)}`;
  const fmtNum = (val) => val === null ? 'N/A' : val.toFixed(2);
  const fmtPct = (val) => val === null ? 'N/A' : `${val.toFixed(2)}%`;

  let rsiLabel = 'Neutral';
  if (rsi14 !== null) {
    if (rsi14 >= 70) rsiLabel = 'Overbought';
    else if (rsi14 <= 30) rsiLabel = 'Oversold';
  }

  let macdLabel = 'N/A';
  if (macd !== null) {
    macdLabel = macd.histogram > 0 ? 'Bullish Momentum' : 'Bearish Momentum';
  }

  let crossoverStr = "None detected in last 10 sessions";
  if (smaCrossovers.goldenCross) crossoverStr = "Golden Cross detected";
  else if (smaCrossovers.deathCross) crossoverStr = "Death Cross detected";

  return `COMPUTED TECHNICAL INDICATORS FOR ${symbol}:
- SMA-5: ${fmt(sma.sma5)} | SMA-20: ${fmt(sma.sma20)} | SMA-50: ${fmt(sma.sma50)} | SMA-100: ${fmt(sma.sma100)} | SMA-200: ${fmt(sma.sma200)}
- RSI(14): ${fmtNum(rsi14)} (${rsiLabel})
- MACD: Line=${macd ? fmtNum(macd.line) : 'N/A'}, Signal=${macd ? fmtNum(macd.signal) : 'N/A'}, Histogram=${macd ? fmtNum(macd.histogram) : 'N/A'} (${macdLabel})
- Bollinger Bands: Upper=${fmt(bollingerBands?.upper)}, Middle=${fmt(bollingerBands?.middle)}, Lower=${fmt(bollingerBands?.lower)}, Bandwidth=${fmtPct(bollingerBands?.bandwidth)}
- VWAP: ${fmt(vwap)}
- Support: ${fmt(support)} | Resistance: ${fmt(resistance)}
- Recent Crossovers: ${crossoverStr}
- 30-Day Volatility: ${fmtPct(volatility?.daily)} daily / ${fmtPct(volatility?.annualized)} annualized
- Max Drawdown: ${fmtPct(maxDrawdown)}`;
}

export function computePortfolioMetrics(portfolio, stocksData) {
  let totalInvested = 0;
  let currentValue = 0;
  const sectorValues = {};
  const holdings = [];

  for (const pos of portfolio) {
    const invested = pos.qty * pos.avgPrice;
    totalInvested += invested;
    
    const stock = stocksData[pos.ticker];
    const price = stock ? stock.price : pos.avgPrice;
    const current = pos.qty * price;
    currentValue += current;
    
    const sector = stock && stock.industry ? stock.industry : getSector(pos.ticker);
    sectorValues[sector] = (sectorValues[sector] || 0) + current;
    
    holdings.push({ ticker: pos.ticker, value: current });
  }

  const totalPnL = currentValue - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  holdings.sort((a, b) => b.value - a.value);
  const topHoldingConcentration = holdings.length > 0 && currentValue > 0 
    ? { ticker: holdings[0].ticker, percent: (holdings[0].value / currentValue) * 100 }
    : { ticker: 'None', percent: 0 };

  const sectorBreakdown = {};
  if (currentValue > 0) {
    for (const [sector, val] of Object.entries(sectorValues)) {
      sectorBreakdown[sector] = (val / currentValue) * 100;
    }
  }

  return {
    totalInvested,
    currentValue,
    totalPnL,
    totalPnLPercent,
    topHoldingConcentration,
    sectorBreakdown
  };
}

export function formatPortfolioMetricsForPrompt(metrics) {
  const { totalInvested, currentValue, totalPnL, totalPnLPercent, topHoldingConcentration, sectorBreakdown } = metrics;
  
  const sign = totalPnL >= 0 ? '+' : '';
  const sectorsStr = Object.entries(sectorBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([sec, pct]) => `${sec} ${pct.toFixed(1)}%`)
    .join(", ");

  return `PORTFOLIO METRICS:
- Total Invested: ₹${totalInvested.toFixed(2)}
- Current Value: ₹${currentValue.toFixed(2)}
- Total P&L: ${sign}₹${totalPnL.toFixed(2)} (${sign}${totalPnLPercent.toFixed(2)}%)
- Top Holding Concentration: ${topHoldingConcentration.ticker} at ${topHoldingConcentration.percent.toFixed(1)}% of portfolio
- Sector Breakdown: ${sectorsStr || 'N/A'}`;
}
