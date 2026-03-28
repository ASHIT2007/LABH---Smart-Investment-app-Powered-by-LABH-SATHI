export const users = [
    { id: '1', name: 'Demo User', email: 'demo@labh.com', password: 'password', balance: 100000, portfolio: [], level: 'Beginner' }
];

export const interlocks = [];

// Logo.dev API — auto-fetches company logos by domain
// Sign up at https://logo.dev for a free API key for production use
// Works without a token on localhost for development
const LOGO_DEV_TOKEN = process.env.LOGO_DEV_TOKEN || ''; // Set in .env file
const logoUrl = (domain) => `https://img.logo.dev/${domain}?${LOGO_DEV_TOKEN ? 'token=' + LOGO_DEV_TOKEN + '&' : ''}size=128&format=png`;

export const STOCKS_DATA = {
    HDFCBANK: { sym: 'HDFCBANK', name: 'HDFC Bank Ltd', price: 1400.50, change: -1.2, exchange: 'NSE', mktCap: '₹10.6L Cr', peRatio: 16.4, week52High: 1757.50, week52Low: 1363.45, volume: '18.5M', logo: logoUrl('hdfcbank.com') },
    INFY: { sym: 'INFY', name: 'Infosys Ltd', price: 1650.10, change: 0.8, exchange: 'NSE', mktCap: '₹6.8L Cr', peRatio: 24.1, week52High: 1733.00, week52Low: 1215.45, volume: '7.2M', logo: logoUrl('infosys.com') },
    RELIANCE: { sym: 'RELIANCE', name: 'Reliance Industries', price: 2900.20, change: 1.5, exchange: 'NSE', mktCap: '₹19.9L Cr', peRatio: 28.5, week52High: 3024.90, week52Low: 2220.30, volume: '6.4M', logo: logoUrl('ril.com') },
    TCS: { sym: 'TCS', name: 'Tata Consultancy', price: 3800.40, change: -0.4, exchange: 'NSE', mktCap: '₹14.2L Cr', peRatio: 31.2, week52High: 4254.75, week52Low: 3070.25, volume: '2.1M', logo: logoUrl('tcs.com') },
    TATAMOTORS: { sym: 'TATAMOTORS', name: 'Tata Motors', price: 950.25, change: 2.1, exchange: 'NSE', mktCap: '₹3.4L Cr', peRatio: 17.1, week52High: 1065.60, week52Low: 400.40, volume: '11.8M', logo: logoUrl('tatamotors.com') },
    ZOMATO: { sym: 'ZOMATO', name: 'Zomato Ltd', price: 165.40, change: 4.5, exchange: 'NSE', mktCap: '₹1.4L Cr', peRatio: 145.2, week52High: 175.50, week52Low: 49.00, volume: '65.4M', logo: logoUrl('zomato.com') },
    ITC: { sym: 'ITC', name: 'ITC Ltd', price: 420.35, change: 0.2, exchange: 'NSE', mktCap: '₹5.2L Cr', peRatio: 25.1, week52High: 499.70, week52Low: 399.30, volume: '14.2M', logo: logoUrl('itcportal.com') },
    ICICIBANK: { sym: 'ICICIBANK', name: 'ICICI Bank Ltd', price: 1085.60, change: -0.6, exchange: 'NSE', mktCap: '₹7.6L Cr', peRatio: 17.8, week52High: 1310.00, week52Low: 900.15, volume: '12.3M', logo: logoUrl('icicibank.com') },
    SBIN: { sym: 'SBIN', name: 'State Bank of India', price: 752.40, change: 1.3, exchange: 'NSE', mktCap: '₹6.7L Cr', peRatio: 10.2, week52High: 912.10, week52Low: 555.25, volume: '22.5M', logo: logoUrl('sbi.co.in') },
    BAJFINANCE: { sym: 'BAJFINANCE', name: 'Bajaj Finance Ltd', price: 6890.75, change: -0.9, exchange: 'NSE', mktCap: '₹4.3L Cr', peRatio: 32.5, week52High: 8192.00, week52Low: 5875.50, volume: '3.8M', logo: logoUrl('bajajfinserv.in') },
    BHARTIARTL: { sym: 'BHARTIARTL', name: 'Bharti Airtel Ltd', price: 1520.30, change: 0.7, exchange: 'NSE', mktCap: '₹9.1L Cr', peRatio: 75.3, week52High: 1779.00, week52Low: 1100.00, volume: '5.6M', logo: logoUrl('airtel.in') },
    HINDUNILVR: { sym: 'HINDUNILVR', name: 'Hindustan Unilever', price: 2340.50, change: -0.3, exchange: 'NSE', mktCap: '₹5.5L Cr', peRatio: 55.2, week52High: 2769.65, week52Low: 2136.00, volume: '2.4M', logo: logoUrl('hul.co.in') },
    LT: { sym: 'LT', name: 'Larsen & Toubro Ltd', price: 3450.80, change: 1.8, exchange: 'NSE', mktCap: '₹4.7L Cr', peRatio: 33.6, week52High: 3900.00, week52Low: 2870.10, volume: '4.1M', logo: logoUrl('larsentoubro.com') },
    SUNPHARMA: { sym: 'SUNPHARMA', name: 'Sun Pharmaceutical', price: 1720.90, change: 2.4, exchange: 'NSE', mktCap: '₹4.1L Cr', peRatio: 38.7, week52High: 1960.00, week52Low: 1208.00, volume: '6.8M', logo: logoUrl('sunpharma.com') },
    PAYTM: { sym: 'PAYTM', name: 'One 97 Communications', price: 385.20, change: -2.1, exchange: 'NSE', mktCap: '₹0.24L Cr', peRatio: -15.3, week52High: 998.30, week52Low: 310.00, volume: '32.1M', logo: logoUrl('paytm.com') },
    POLICYBZR: { sym: 'POLICYBZR', name: 'PB Fintech Ltd', price: 1480.60, change: 3.2, exchange: 'NSE', mktCap: '₹0.67L Cr', peRatio: -120.5, week52High: 1657.00, week52Low: 560.00, volume: '8.4M', logo: logoUrl('policybazaar.com') },
    WIPRO: { sym: 'WIPRO', name: 'Wipro Ltd', price: 420.50, change: 0.6, exchange: 'NSE', mktCap: '₹2.2L Cr', peRatio: 19.8, week52High: 530.00, week52Low: 380.20, volume: '9.1M', logo: logoUrl('wipro.com') },
    ASIANPAINT: { sym: 'ASIANPAINT', name: 'Asian Paints Ltd', price: 2780.30, change: -0.5, exchange: 'NSE', mktCap: '₹2.7L Cr', peRatio: 52.1, week52High: 3395.00, week52Low: 2670.10, volume: '3.2M', logo: logoUrl('asianpaints.com') },
    MARUTI: { sym: 'MARUTI', name: 'Maruti Suzuki India', price: 12450.80, change: 1.1, exchange: 'NSE', mktCap: '₹3.9L Cr', peRatio: 28.3, week52High: 13680.00, week52Low: 9830.55, volume: '1.5M', logo: logoUrl('marutisuzuki.com') },
    TITAN: { sym: 'TITAN', name: 'Titan Company Ltd', price: 3280.60, change: -1.3, exchange: 'NSE', mktCap: '₹2.9L Cr', peRatio: 65.4, week52High: 3887.00, week52Low: 2895.00, volume: '2.8M', logo: logoUrl('titancompany.in') },

    // ─── INTERNATIONAL STOCKS ───

    // Tech
    AAPL: { sym: 'AAPL', name: 'Apple Inc', price: 178.50, change: 0.8, exchange: 'NASDAQ', mktCap: '$2.8T', peRatio: 28.9, week52High: 199.62, week52Low: 142.00, volume: '55M', logo: logoUrl('apple.com'), intl: true },
    MSFT: { sym: 'MSFT', name: 'Microsoft Corp', price: 415.20, change: 1.2, exchange: 'NASDAQ', mktCap: '$3.1T', peRatio: 35.4, week52High: 430.82, week52Low: 309.45, volume: '22M', logo: logoUrl('microsoft.com'), intl: true },
    GOOGL: { sym: 'GOOGL', name: 'Alphabet Inc', price: 155.80, change: 0.5, exchange: 'NASDAQ', mktCap: '$1.9T', peRatio: 24.1, week52High: 174.71, week52Low: 115.83, volume: '25M', logo: logoUrl('google.com'), intl: true },
    META: { sym: 'META', name: 'Meta Platforms Inc', price: 505.30, change: -0.7, exchange: 'NASDAQ', mktCap: '$1.3T', peRatio: 28.5, week52High: 542.81, week52Low: 274.38, volume: '18M', logo: logoUrl('meta.com'), intl: true },
    AMZN: { sym: 'AMZN', name: 'Amazon.com Inc', price: 186.40, change: 1.5, exchange: 'NASDAQ', mktCap: '$1.9T', peRatio: 58.2, week52High: 201.20, week52Low: 118.35, volume: '48M', logo: logoUrl('amazon.com'), intl: true },

    // AI
    NVDA: { sym: 'NVDA', name: 'NVIDIA Corp', price: 875.60, change: 2.8, exchange: 'NASDAQ', mktCap: '$2.2T', peRatio: 68.5, week52High: 974.00, week52Low: 262.20, volume: '42M', logo: logoUrl('nvidia.com'), intl: true },
    PLTR: { sym: 'PLTR', name: 'Palantir Technologies', price: 24.50, change: 3.1, exchange: 'NYSE', mktCap: '$54B', peRatio: 245.0, week52High: 27.50, week52Low: 13.68, volume: '65M', logo: logoUrl('palantir.com'), intl: true },
    AI: { sym: 'AI', name: 'C3.ai Inc', price: 28.80, change: -1.4, exchange: 'NYSE', mktCap: '$3.5B', peRatio: -12.5, week52High: 48.87, week52Low: 20.51, volume: '8M', logo: logoUrl('c3.ai'), intl: true },

    // Automotive
    TSLA: { sym: 'TSLA', name: 'Tesla Inc', price: 248.90, change: -1.8, exchange: 'NASDAQ', mktCap: '$790B', peRatio: 62.3, week52High: 299.29, week52Low: 152.37, volume: '95M', logo: logoUrl('tesla.com'), intl: true },
    F: { sym: 'F', name: 'Ford Motor Co', price: 12.40, change: 0.3, exchange: 'NYSE', mktCap: '$50B', peRatio: 12.1, week52High: 14.85, week52Low: 9.63, volume: '52M', logo: logoUrl('ford.com'), intl: true },
    TM: { sym: 'TM', name: 'Toyota Motor Corp', price: 230.50, change: 0.6, exchange: 'NYSE', mktCap: '$310B', peRatio: 10.8, week52High: 250.00, week52Low: 160.30, volume: '4M', logo: logoUrl('toyota.com'), intl: true },

    // Banking & Finance
    JPM: { sym: 'JPM', name: 'JPMorgan Chase', price: 198.30, change: 0.9, exchange: 'NYSE', mktCap: '$570B', peRatio: 11.5, week52High: 205.88, week52Low: 135.19, volume: '9M', logo: logoUrl('jpmorganchase.com'), intl: true },
    GS: { sym: 'GS', name: 'Goldman Sachs', price: 415.80, change: 1.1, exchange: 'NYSE', mktCap: '$140B', peRatio: 15.2, week52High: 440.00, week52Low: 289.36, volume: '3M', logo: logoUrl('goldmansachs.com'), intl: true },
    V: { sym: 'V', name: 'Visa Inc', price: 282.60, change: 0.4, exchange: 'NYSE', mktCap: '$580B', peRatio: 30.5, week52High: 290.96, week52Low: 227.20, volume: '7M', logo: logoUrl('visa.com'), intl: true },

    // Security & Defense
    LMT: { sym: 'LMT', name: 'Lockheed Martin', price: 455.20, change: -0.3, exchange: 'NYSE', mktCap: '$110B', peRatio: 16.8, week52High: 468.05, week52Low: 398.76, volume: '1.5M', logo: logoUrl('lockheedmartin.com'), intl: true },
    CRWD: { sym: 'CRWD', name: 'CrowdStrike Holdings', price: 310.40, change: 2.2, exchange: 'NASDAQ', mktCap: '$74B', peRatio: 410.0, week52High: 364.95, week52Low: 140.41, volume: '5M', logo: logoUrl('crowdstrike.com'), intl: true },
    PANW: { sym: 'PANW', name: 'Palo Alto Networks', price: 305.90, change: 1.6, exchange: 'NASDAQ', mktCap: '$100B', peRatio: 48.2, week52High: 380.84, week52Low: 196.28, volume: '6M', logo: logoUrl('paloaltonetworks.com'), intl: true },

    // Hardware & Semiconductors
    AMD: { sym: 'AMD', name: 'Advanced Micro Devices', price: 178.30, change: 1.9, exchange: 'NASDAQ', mktCap: '$288B', peRatio: 280.0, week52High: 227.30, week52Low: 93.12, volume: '55M', logo: logoUrl('amd.com'), intl: true },
    INTC: { sym: 'INTC', name: 'Intel Corp', price: 42.80, change: -0.8, exchange: 'NASDAQ', mktCap: '$180B', peRatio: -5.6, week52High: 51.28, week52Low: 26.86, volume: '40M', logo: logoUrl('intel.com'), intl: true },
    TSM: { sym: 'TSM', name: 'Taiwan Semiconductor', price: 145.60, change: 1.3, exchange: 'NYSE', mktCap: '$755B', peRatio: 25.8, week52High: 150.00, week52Low: 84.06, volume: '15M', logo: logoUrl('tsmc.com'), intl: true },

    // Medicine & Healthcare
    JNJ: { sym: 'JNJ', name: 'Johnson & Johnson', price: 158.40, change: -0.2, exchange: 'NYSE', mktCap: '$382B', peRatio: 10.5, week52High: 175.97, week52Low: 143.13, volume: '8M', logo: logoUrl('jnj.com'), intl: true },
    PFE: { sym: 'PFE', name: 'Pfizer Inc', price: 27.30, change: 0.5, exchange: 'NYSE', mktCap: '$154B', peRatio: 18.2, week52High: 33.75, week52Low: 25.20, volume: '32M', logo: logoUrl('pfizer.com'), intl: true },
    UNH: { sym: 'UNH', name: 'UnitedHealth Group', price: 525.80, change: 0.7, exchange: 'NYSE', mktCap: '$490B', peRatio: 22.1, week52High: 554.70, week52Low: 436.38, volume: '4M', logo: logoUrl('unitedhealthgroup.com'), intl: true },

    // Daily Essentials & Consumer
    PG: { sym: 'PG', name: 'Procter & Gamble', price: 162.50, change: 0.1, exchange: 'NYSE', mktCap: '$384B', peRatio: 25.8, week52High: 170.68, week52Low: 141.45, volume: '7M', logo: logoUrl('pg.com'), intl: true },
    KO: { sym: 'KO', name: 'Coca-Cola Co', price: 60.20, change: 0.3, exchange: 'NYSE', mktCap: '$260B', peRatio: 23.5, week52High: 64.99, week52Low: 51.55, volume: '12M', logo: logoUrl('coca-cola.com'), intl: true },
    WMT: { sym: 'WMT', name: 'Walmart Inc', price: 168.90, change: 0.6, exchange: 'NYSE', mktCap: '$455B', peRatio: 28.3, week52High: 170.00, week52Low: 143.15, volume: '8M', logo: logoUrl('walmart.com'), intl: true },
    NKE: { sym: 'NKE', name: 'Nike Inc', price: 102.30, change: -1.1, exchange: 'NYSE', mktCap: '$156B', peRatio: 28.9, week52High: 128.64, week52Low: 88.66, volume: '10M', logo: logoUrl('nike.com'), intl: true },

    // Entertainment & Streaming
    NFLX: { sym: 'NFLX', name: 'Netflix Inc', price: 628.50, change: 1.4, exchange: 'NASDAQ', mktCap: '$273B', peRatio: 47.5, week52High: 639.00, week52Low: 344.73, volume: '6M', logo: logoUrl('netflix.com'), intl: true },
    DIS: { sym: 'DIS', name: 'Walt Disney Co', price: 112.40, change: -0.5, exchange: 'NYSE', mktCap: '$205B', peRatio: 72.3, week52High: 123.74, week52Low: 78.73, volume: '11M', logo: logoUrl('disney.com'), intl: true }
};
