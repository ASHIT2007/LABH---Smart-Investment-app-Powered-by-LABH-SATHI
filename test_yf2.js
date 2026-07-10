import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function test() {
  try {
    const timeseries = await yahooFinance.fundamentalsTimeSeries('AAPL', {
      period1: '2023-01-01',
      module: 'financials'
    });
    console.log(JSON.stringify(timeseries, null, 2));
    
    const quoteSummary = await yahooFinance.quoteSummary('AAPL', {
      modules: [
        'majorHoldersBreakdown'
      ]
    });
    console.log(JSON.stringify(quoteSummary, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
